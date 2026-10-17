// Límite de uso con ventana fija en Postgres. No necesita Redis y sobra para
// este volumen: lo que evita es que una persona (o un script) queme la cuota de
// la máquina o, más adelante, el presupuesto de la capa de IA.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inicioDeVentana } from "@/lib/ventana";

export { inicioDeVentana };

export interface ResultadoLimite {
  permitido: boolean;
  /** Uso de la ventana después de este consumo. */
  contador: number;
  restantes: number;
  reinicioEn: number;
}

export async function consumirCupo(
  clave: string,
  maximo: number,
  ventanaSegundos: number
): Promise<ResultadoLimite> {
  const ahora = new Date();
  const inicioVentana = inicioDeVentana(ahora, ventanaSegundos);

  // Un solo round-trip: inserta la ventana o incrementa el contador si la fila
  // ya pertenece a esta ventana; si es de una ventana vieja, la reinicia.
  const { rows } = await db.execute<{ contador: number }>(sql`
    INSERT INTO rate_limit (clave, ventana_inicio, contador)
    VALUES (${clave}, ${inicioVentana.toISOString()}, 1)
    ON CONFLICT (clave) DO UPDATE SET
      contador = CASE
        WHEN rate_limit.ventana_inicio = ${inicioVentana.toISOString()}
        THEN rate_limit.contador + 1
        ELSE 1
      END,
      ventana_inicio = ${inicioVentana.toISOString()}
    RETURNING contador
  `);

  const contador = Number(rows[0]?.contador ?? 1);
  return {
    permitido: contador <= maximo,
    contador,
    restantes: Math.max(0, maximo - contador),
    reinicioEn: Math.max(
      1,
      Math.ceil((inicioVentana.getTime() + ventanaSegundos * 1000 - ahora.getTime()) / 1000)
    ),
  };
}

/** Cuánto se usó en la ventana actual, sin consumir. */
export async function cupoUsado(clave: string, ventanaSegundos: number): Promise<number> {
  const inicio = inicioDeVentana(new Date(), ventanaSegundos).toISOString();
  const { rows } = await db.execute<{ contador: number }>(sql`
    SELECT contador FROM rate_limit WHERE clave = ${clave} AND ventana_inicio = ${inicio}
  `);
  return Number(rows[0]?.contador ?? 0);
}
