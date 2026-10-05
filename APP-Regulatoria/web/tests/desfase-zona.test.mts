// Regresión del 01-10-2026: desfaseZona arrastraba los milisegundos del reloj
// (-180,0108 min en vez de -180), así que el inicio de cada ventana de los
// límites de uso salía distinto en cada petición y el contador de `rate_limit`
// volvía a 1 siempre. Ningún tope se cumplía: ni el de búsquedas por hora, ni
// el del formulario de contacto, ni el de reservas, ni el de respuestas con IA.
//
// La prueba va contra desfaseZona y repite la cuenta de la ventana a mano, sin
// importar lib/rate-limit.ts, que arrastra la base de datos.

import assert from "node:assert/strict";
import { test } from "node:test";

import { desfaseZona } from "../lib/agenda/tiempo.ts";

const ZONA = "America/Santiago";

/** La misma cuenta que hace el limitador para alinear la ventana a hora de Chile. */
function inicioDeVentana(ahora: Date, ventanaSegundos: number): Date {
  const ventanaMs = ventanaSegundos * 1000;
  const desfaseMs = desfaseZona(ahora, ZONA) * 60_000;
  return new Date(Math.floor((ahora.getTime() + desfaseMs) / ventanaMs) * ventanaMs - desfaseMs);
}

test("desfaseZona da minutos enteros aunque el instante traiga milisegundos", () => {
  assert.equal(desfaseZona(new Date("2026-10-05T21:10:00.000Z"), ZONA), -180);
  assert.equal(desfaseZona(new Date("2026-10-05T21:10:00.007Z"), ZONA), -180);
  assert.equal(desfaseZona(new Date("2026-10-05T21:10:00.999Z"), ZONA), -180);
  // Horario de invierno: UTC-4.
  assert.equal(desfaseZona(new Date("2026-07-15T15:00:00.431Z"), ZONA), -240);
});

test("dos peticiones de la misma hora caen en la misma ventana", () => {
  const a = new Date("2026-10-05T21:10:00.007Z");
  const b = new Date("2026-10-05T21:48:59.650Z");
  assert.equal(inicioDeVentana(a, 3600).toISOString(), "2026-10-05T21:00:00.000Z");
  assert.equal(inicioDeVentana(a, 3600).getTime(), inicioDeVentana(b, 3600).getTime());
});

test("dos peticiones del mismo día chileno caen en la misma ventana diaria", () => {
  const manana = new Date("2026-10-05T12:00:00.123Z"); // 09:00 en Santiago
  const noche = new Date("2026-10-06T02:30:00.987Z"); // 23:30 en Santiago, mismo día
  assert.equal(inicioDeVentana(manana, 86_400).toISOString(), "2026-10-05T03:00:00.000Z");
  assert.equal(inicioDeVentana(manana, 86_400).getTime(), inicioDeVentana(noche, 86_400).getTime());
});
