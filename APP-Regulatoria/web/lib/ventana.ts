// Ventanas fijas de los límites de uso, alineadas a la hora de Chile. Puro y
// sin base de datos: lib/rate-limit.ts lo usa para guardar el contador y las
// pruebas lo ejercitan directo.

import { desfaseZona } from "./agenda/tiempo.ts";

// Las ventanas se alinean a la hora de Chile, no a UTC. Con UTC la cuota
// "diaria" se reiniciaba a las 21:00 (o 20:00 en invierno): quien la agotaba en
// la tarde la recuperaba esa misma noche. Para ventanas de una hora o menos da
// igual, porque el desfase chileno es de horas enteras; importa en las de un día.
export const ZONA_CUOTAS = "America/Santiago";

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
