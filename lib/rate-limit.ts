// Límite de uso con ventana fija en Postgres. No necesita Redis y sobra para
// este volumen: lo que evita es que una persona (o un script) queme la cuota de
// la máquina o, más adelante, el presupuesto de la capa de IA.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reinicioEn: number;
}

export async function consumirCupo(
  clave: string,
  maximo: number,
  ventanaSegundos: number
): Promise<ResultadoLimite> {
  const ahora = new Date();
  const inicioVentana = new Date(
    Math.floor(ahora.getTime() / (ventanaSegundos * 1000)) * ventanaSegundos * 1000
  );

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
    restantes: Math.max(0, maximo - contador),
    reinicioEn: Math.ceil(
      (inicioVentana.getTime() + ventanaSegundos * 1000 - ahora.getTime()) / 1000
    ),
  };
}
