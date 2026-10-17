// Pruebas del asistente, fase 1 (encargo C): la planificación de búsquedas
// (parseo, límites y respaldo), la unión de pasajes y la verificación por
// afirmación. Sin modelo real: el proveedor se simula con un servidor local.

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

await import("./_alias.mjs");
const P = await import("../lib/ia/planificar.ts");
const V = await import("../lib/ia/verificar.ts");
const R = await import("../lib/ia/redactar.ts");

// ── Proveedor simulado ──────────────────────────────────────────────────────
let respuestaModelo = "";
let demoraMs = 0;
const servidor = http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    setTimeout(() => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: respuestaModelo } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }));
    }, demoraMs);
  });
});
let config: import("../lib/ia/proveedor.ts").ConfigIa;
before(async () => {
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", () => ok()));
  const { port } = servidor.address() as { port: number };
  config = {
    modeloId: null, proveedor: "prueba", baseUrl: `http://127.0.0.1:${port}/v1`, modelo: "prueba",
    apiKey: "x", usdMillonEntrada: 0.15, usdMillonSalida: 0.6, origen: "entorno",
  };
});
after(() => {
  servidor.closeAllConnections();
  servidor.close();
});

// ── parsearPlan ─────────────────────────────────────────────────────────────
test("parsearPlan limpia viñetas, números y comillas, y descarta explicaciones", () => {
  const plan = P.parsearPlan(
    "Aquí tienes las búsquedas:\n1. notificación de sospechas de reacciones adversas\n- «plazo de notificación reacciones serias»\n• farmacovigilancia titular registro sanitario",
    "¿cuánto tengo para avisar una reacción grave?"
  );
  assert.deepEqual(plan, [
    "notificación de sospechas de reacciones adversas",
    "plazo de notificación reacciones serias",
    "farmacovigilancia titular registro sanitario",
  ]);
});

test("parsearPlan: como máximo 4, sin duplicados ni la pregunta original", () => {
  const plan = P.parsearPlan("a b\nA B\nc d\ne f\ng h\ni j\nla pregunta original", "la pregunta original");
  assert.deepEqual(plan, ["a b", "c d", "e f", "g h"]);
});

test("parsearPlan devuelve [] si no hay nada usable", () => {
  assert.deepEqual(P.parsearPlan(""), []);
  assert.deepEqual(P.parsearPlan("ok\n\n:"), []);
});

// ── planificarBusquedas ─────────────────────────────────────────────────────
test("planificarBusquedas: la pregunta original va primero y después el plan", async () => {
  respuestaModelo = "registro sanitario vigencia cinco años\nrenovación registro sanitario";
  demoraMs = 0;
  const plan = await P.planificarBusquedas("¿cuánto dura el registro?", { config });
  assert.equal(plan.planificado, true);
  assert.deepEqual(plan.busquedas, [
    "¿cuánto dura el registro?",
    "registro sanitario vigencia cinco años",
    "renovación registro sanitario",
  ]);
  assert.ok(plan.costoUsd > 0);
});

test("planificarBusquedas: plan vacío → respaldo con la pregunta original", async () => {
  respuestaModelo = "";
  const plan = await P.planificarBusquedas("¿qué es una droguería?", { config });
  assert.equal(plan.planificado, false);
  assert.equal(plan.error, "plan_vacio");
  assert.deepEqual(plan.busquedas, ["¿qué es una droguería?"]);
});

test("planificarBusquedas: más de 3 s → respaldo, sin esperar al proveedor", async () => {
  respuestaModelo = "algo que llega tarde";
  demoraMs = 5000;
  const inicio = Date.now();
  const plan = await P.planificarBusquedas("¿qué es una droguería?", { config });
  assert.equal(plan.planificado, false);
  assert.equal(plan.error, "tiempo_agotado");
  assert.ok(Date.now() - inicio < 4500);
  demoraMs = 0;
});

test("planificarBusquedas: proveedor caído → respaldo", async () => {
  const plan = await P.planificarBusquedas("x y", { config: { ...config, baseUrl: "http://127.0.0.1:9/v1" } });
  assert.equal(plan.planificado, false);
  assert.deepEqual(plan.busquedas, ["x y"]);
});

// ── unirPasajes ─────────────────────────────────────────────────────────────
type Fila = import("../lib/search.ts").ResultadoPublico;
type Resp = import("../lib/search.ts").Respuesta;
const fila = (id: string, puntaje: number): Fila =>
  ({ cita: id, norma: "", titulo: "", articulo: "", pagina: null, categoria: "", frase: "", resaltar: [], texto: id,
     fuente_url: "", es_ocr: false, avisos: [], _cobertura_frase: 0, _tiene_dato: false, _doc_id: id, _numero: "",
     _tipo: "", _puntaje: puntaje, _chunk_id: id }) as Fila;
const resp = (estado: Resp["estado"], filas: Fila[]): Resp =>
  ({ pregunta: "", tipo: "", estado, titular: "", motivo: "", principal: filas[0] ?? null, relacionadas: filas.slice(1),
     avisos: [], conceptos_fuera: [] }) as Resp;

test("unirPasajes: sin duplicados, por puntaje, máximo 8 y sin las búsquedas ausentes", () => {
  const unidos = P.unirPasajes([
    resp("parcial", [fila("a", 0.5), fila("b", 0.4)]),
    resp("parcial", [fila("b", 0.9), fila("c", 0.3)]),
    resp("ausente", [fila("z", 5)]),
    resp("parcial", Array.from({ length: 10 }, (_, i) => fila(`x${i}`, 0.1))),
  ]);
  assert.equal(unidos.length, 8);
  assert.deepEqual(unidos.slice(0, 3).map((f) => [f.cita, f._puntaje]), [["b", 0.9], ["a", 0.5], ["c", 0.3]]);
  assert.ok(!unidos.some((f) => f.cita === "z"));
});

test("unirPasajes: el principal de una pregunta «encontrado» queda primero", () => {
  const unidos = P.unirPasajes([resp("encontrado", [fila("verificado", 0.6)]), resp("parcial", [fila("otra materia", 0.95)])]);
  assert.equal(unidos[0].cita, "verificado");
});

test("admitePlanificacion: no rescata materias excluidas ni palabras que no están en la base", () => {
  assert.equal(P.admitePlanificacion(resp("parcial", [])), true);
  assert.equal(P.admitePlanificacion({ ...resp("ausente", []), fuera_de_alcance: "veterinaria" }), false);
  assert.equal(P.admitePlanificacion({ ...resp("ausente", []), conceptos_fuera: ["gicona"] }), false);
  assert.equal(P.admitePlanificacion(resp("ausente", [])), true);
});

// ── Verificación por afirmación ─────────────────────────────────────────────
test("oraciones no parte en «art. 217» ni en «Res. Ex. 1651»", () => {
  assert.deepEqual(V.oraciones("Lo dice el art. 217 del DS 3. También la Res. Ex. 1651 lo exige."), [
    "Lo dice el art. 217 del DS 3.",
    "También la Res. Ex. 1651 lo exige.",
  ]);
});

test("afirmacionesSinCita marca obligaciones, prohibiciones y plazos sin cita válida", () => {
  const texto = [
    "El titular debe notificar en 72 horas [P1].",
    "Además deberá informar al Ministerio.",
    "Se prohíbe la publicidad [P9].",
    "El plazo de respuesta es de 30 días.",
    "La farmacovigilancia es una actividad de salud pública.",
  ].join(" ");
  assert.deepEqual(V.afirmacionesSinCita(texto, 6), [
    "Además deberá informar al Ministerio.",
    "Se prohíbe la publicidad [P9].",
    "El plazo de respuesta es de 30 días.",
  ]);
});

test("resolverCitas devuelve las afirmaciones sin cita como subcadenas del texto resuelto", () => {
  const pasajes = [{ cita: "DS 3 · art. 217", norma: "DS 3", titulo: "", texto: "72 horas", vigencia: "vigente", fuenteUrl: "" }];
  const r = R.resolverCitas("El titular debe notificar en 72 horas [P1]. Además debe avisar a la SEREMI.", pasajes);
  assert.deepEqual(r.afirmacionesSinCita, ["Además debe avisar a la SEREMI."]);
  for (const o of r.afirmacionesSinCita) assert.ok(r.texto.includes(o));
  assert.ok(r.texto.includes("[DS 3 · art. 217]"));
});

test("afirmacionesSinCitaResueltas reconoce las citas ya resueltas", () => {
  assert.deepEqual(
    V.afirmacionesSinCitaResueltas("El titular debe notificar [DS 3 · art. 217]. Debe además avisar [cita no verificable]."),
    ["Debe además avisar [cita no verificable]."]
  );
});
