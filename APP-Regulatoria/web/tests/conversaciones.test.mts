// Pertenencia en /historial (encargo C2): nunca se muestra una fila de otra
// persona, aunque llegue en el resultado. Y el contexto del hilo son las 3
// últimas preguntas, con una respuesta breve.

import assert from "node:assert/strict";
import { test } from "node:test";

import { agruparHistorial, turnosParaContexto, type FilaHistorial } from "../lib/conversaciones-agrupar.ts";

const fila = (p: Partial<FilaHistorial>): FilaHistorial => ({
  conversacionId: "c1",
  conversacionCreada: new Date("2026-10-01T10:00:00Z"),
  userId: "yo",
  consultaId: "q1",
  pregunta: "¿pregunta?",
  respuesta: "respuesta",
  fuentes: [],
  creada: new Date("2026-10-01T10:01:00Z"),
  ...p,
});

test("agruparHistorial descarta las filas de otra persona", () => {
  const r = agruparHistorial(
    [fila({}), fila({ consultaId: "ajena", userId: "otro", pregunta: "secreto" }), fila({ conversacionId: "c2", userId: "otro" })],
    "yo"
  );
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].turnos.map((t) => t.consultaId), ["q1"]);
  assert.ok(!JSON.stringify(r).includes("secreto"));
});

test("agruparHistorial ordena: conversaciones nuevas primero, turnos en orden", () => {
  const r = agruparHistorial(
    [
      fila({ consultaId: "b", creada: new Date("2026-10-01T10:05:00Z") }),
      fila({ consultaId: "a", creada: new Date("2026-10-01T10:02:00Z") }),
      fila({ conversacionId: "c2", conversacionCreada: new Date("2026-10-02T09:00:00Z"), consultaId: "z" }),
      fila({ conversacionId: "vacia", consultaId: null, pregunta: null, creada: null }),
    ],
    "yo"
  );
  assert.deepEqual(r.map((c) => c.id), ["c2", "c1"]);
  assert.deepEqual(r[1].turnos.map((t) => t.consultaId), ["a", "b"]);
});

test("turnosParaContexto: las 3 últimas, respuesta breve", () => {
  const previas = [1, 2, 3, 4].map((n) => ({ pregunta: `p${n}`, respuestaLlm: n === 4 ? "x".repeat(500) : null }));
  const t = turnosParaContexto(previas);
  assert.deepEqual(t.map((x) => x.pregunta), ["p2", "p3", "p4"]);
  assert.equal(t[2].respuesta.length, 300);
  assert.equal(t[0].respuesta, "(sin respuesta redactada)");
});
