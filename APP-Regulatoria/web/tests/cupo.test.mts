// Pruebas del cupo diario (regla del 24-09-2026): cada mensaje enviado cuenta,
// el 11.º del día no se procesa, el administrador no tiene tope y el día se
// cuenta en hora de Chile, no en UTC.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PREGUNTAS_DIARIAS, decidirCupo } from "../lib/ia/cupo.ts";
import { inicioDeVentana } from "../lib/ventana.ts";

const DIA = 86_400;

test("el cupo por defecto es 10 preguntas al día", () => {
  assert.equal(PREGUNTAS_DIARIAS, 10);
});

test("cada mensaje cuenta: del 1 al 10 pasan y el 11 se bloquea", () => {
  for (let n = 1; n <= 10; n++) {
    const d = decidirCupo(n, false);
    assert.equal(d.permitido, true, `la pregunta ${n} debe pasar`);
    assert.equal(d.restantesHoy, 10 - n);
  }
  const once = decidirCupo(11, false);
  assert.equal(once.permitido, false);
  assert.equal(once.restantesHoy, 0);
  // Los intentos siguientes también se rechazan y el saldo no baja de cero.
  assert.deepEqual(decidirCupo(25, false), { permitido: false, restantesHoy: 0 });
});

test("el administrador no tiene tope ni saldo", () => {
  assert.deepEqual(decidirCupo(500, true), { permitido: true, restantesHoy: null });
});

test("la ventana diaria empieza a medianoche de Chile en horario de invierno (UTC-4)", () => {
  // 15-07-2026 20:30 en Santiago = 16-07-2026 00:30 UTC. En UTC ya sería otro
  // día; en Chile sigue siendo el 15, y la ventana empieza el 15 a las 04:00 UTC.
  const ahora = new Date("2026-07-16T00:30:00Z");
  assert.equal(inicioDeVentana(ahora, DIA).toISOString(), "2026-07-15T04:00:00.000Z");
});

test("la ventana diaria empieza a medianoche de Chile en horario de verano (UTC-3)", () => {
  const ahora = new Date("2026-12-10T02:59:00Z"); // 09-12 23:59 en Santiago
  assert.equal(inicioDeVentana(ahora, DIA).toISOString(), "2026-12-09T03:00:00.000Z");
  const despues = new Date("2026-12-10T03:00:00Z"); // 10-12 00:00 en Santiago
  assert.equal(inicioDeVentana(despues, DIA).toISOString(), "2026-12-10T03:00:00.000Z");
});

test("las preguntas de la tarde chilena y las de la noche caen en la misma ventana", () => {
  // Con ventanas en UTC, el cupo agotado a las 19:00 volvía a las 21:00.
  const tarde = new Date("2026-09-24T22:00:00Z"); // 19:00 en Santiago (UTC-3)
  const noche = new Date("2026-09-25T02:30:00Z"); // 23:30 en Santiago
  assert.equal(inicioDeVentana(tarde, DIA).getTime(), inicioDeVentana(noche, DIA).getTime());
});
