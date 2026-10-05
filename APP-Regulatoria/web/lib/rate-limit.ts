// Límite de uso con ventana fija en Postgres. No necesita Redis y sobra para
// este volumen: lo que evita es que una persona (o un script) queme la cuota de
// la máquina o, más adelante, el presupuesto de la capa de IA.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { desfaseZona } from "@/lib/agenda/tiempo";

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reinicioEn: number;
}

// Las ventanas se alinean a la hora de Chile, no a UTC. Con UTC la cuota
// "diaria" se reiniciaba a las 21:00 (o 20:00 en invierno): quien la agotaba en
// la tarde la recuperaba esa misma noche. Para ventanas de una hora o menos da
// igual, porque el desfase chileno es de horas enteras; importa en las de un día.
const ZONA_CUOTAS = "America/Santiago";

/**
 * Inicio de la ventana que contiene a `ahora`, contado en hora chilena. El
 * desfase se calcula para este instante, así que sigue los cambios de horario;
 * el día del cambio la ventana dura 23 o 25 horas, que es lo que dura ese día.
 */
export function inicioDeVentana(ahora: Date, ventanaSegundos: number): Date {
  const ventanaMs = ventanaSegundos * 1000;
  const desfaseMs = desfaseZona(ahora, ZONA_CUOTAS) * 60_000;
  return new Date(Math.floor((ahora.getTime() + desfaseMs) / ventanaMs) * ventanaMs - desfaseMs);
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
    restantes: Math.max(0, maximo - contador),
    reinicioEn: Math.max(
      1,
      Math.ceil((inicioVentana.getTime() + ventanaSegundos * 1000 - ahora.getTime()) / 1000)
    ),
  };
}

/** Devuelve una unidad al cupo de la ventana actual (p. ej., una pregunta que no se entregó). */
export async function devolverCupo(clave: string, ventanaSegundos: number): Promise<void> {
  const inicio = inicioDeVentana(new Date(), ventanaSegundos).toISOString();
  await db.execute(sql`
    UPDATE rate_limit SET contador = contador - 1
    WHERE clave = ${clave} AND ventana_inicio = ${inicio} AND contador > 0
  `);
}

/** Cuánto se usó en la ventana actual, sin consumir. */
export async function cupoUsado(clave: string, ventanaSegundos: number): Promise<number> {
  const inicio = inicioDeVentana(new Date(), ventanaSegundos).toISOString();
  const { rows } = await db.execute<{ contador: number }>(sql`
    SELECT contador FROM rate_limit WHERE clave = ${clave} AND ventana_inicio = ${inicio}
  `);
  return Number(rows[0]?.contador ?? 0);
}
