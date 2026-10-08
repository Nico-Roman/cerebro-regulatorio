// Pruebas de la sección EE.UU. (21 CFR, FDA) del buscador.
//
// Lo que no puede pasar, y por eso se prueba: que un pasaje del 21 CFR salga
// sin decir que no rige en Chile, que la sección FDA marque algo en verde antes
// de calibrarse, y que encenderla cambie lo que responde el buscador chileno.
// Leen los corpus publicados en data/, igual que la web en producción.

import assert from "node:assert/strict";
import { test } from "node:test";
import { AVISO_JURISDICCION_FDA, leerJurisdiccion, responder } from "../lib/search.ts";

test("leerJurisdiccion solo acepta 'fda'; todo lo demás es Chile", () => {
  assert.equal(leerJurisdiccion("fda"), "fda");
  assert.equal(leerJurisdiccion("cl"), "cl");
  assert.equal(leerJurisdiccion("FDA"), "cl");
  assert.equal(leerJurisdiccion(null), "cl");
  assert.equal(leerJurisdiccion("../etc"), "cl");
});

test("una respuesta del 21 CFR trae el aviso de jurisdicción y la cita estadounidense", () => {
  const r = responder("What are the responsibilities of the quality control unit?", { jurisdiccion: "fda" });
  assert.notEqual(r.estado, "ausente");
  assert.equal(r.avisos[0], AVISO_JURISDICCION_FDA);
  assert.match(r.principal?.cita ?? "", /^21 CFR § 211\.22$/);
  assert.match(r.principal?.categoria ?? "", /^EE\.UU\. \(FDA\)/);
});

test("la sección FDA no marca respuestas en verde hasta calibrarse", () => {
  // Antes del tope, esta pregunta salía en verde con una sección de bioequivalencia.
  for (const q of ["What is a combination product?", "orphan drug designation request", "informed consent elements"]) {
    assert.notEqual(responder(q, { jurisdiccion: "fda" }).estado, "encontrado", q);
  }
});

test("la sección FDA se abstiene fuera de su alcance y pide inglés", () => {
  const chile = responder("How do I register a glucometer in Chile?", { jurisdiccion: "fda" });
  assert.equal(chile.estado, "ausente");
  const espanol = responder("requisitos de la unidad de control de calidad", { jurisdiccion: "fda" });
  assert.equal(espanol.estado, "ausente");
  assert.match(espanol.motivo, /escribe la pregunta en inglés/);
});

test("el número de parte no lleva separador de miles", () => {
  const r = responder("donor eligibility determination for human cells and tissues", { jurisdiccion: "fda" });
  const filas = [r.principal, ...r.relacionadas].filter((f) => f !== null);
  const parte1271 = filas.find((f) => f._numero === "1271");
  assert.ok(parte1271, "esperaba un pasaje de la Parte 1271");
  assert.equal(parte1271.norma, "21 CFR Part 1271");
});

test("sin jurisdicción el buscador sigue siendo el chileno y nunca devuelve el 21 CFR", () => {
  for (const q of ["¿Qué es una droguería?", "requisitos de buenas prácticas de manufactura", "electronic signature"]) {
    const r = responder(q);
    for (const f of [r.principal, ...r.relacionadas]) {
      if (f) assert.ok(!f.cita.startsWith("21 CFR"), q + " -> " + f.cita);
    }
    assert.ok(!r.avisos.includes(AVISO_JURISDICCION_FDA), q);
  }
});
