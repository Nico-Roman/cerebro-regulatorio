// Pruebas de la economía de los planes. Si alguien cambia un precio, un cupo o
// el costo del proveedor y deja un plan con pérdida, esto falla antes del
// despliegue: es la regla "que sea rentable" escrita como código.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PACKS,
  PLANES,
  TOPE_DIARIO_PACK,
  costoCreditoClp,
  costoUsd,
  creditosPorCosto,
  decidirFuente,
  margenPeorCaso,
  netoClp,
  restantes,
  type EstadoUso,
} from "../lib/planes.ts";

const estado = (p: Partial<EstadoUso> = {}): EstadoUso => ({
  plan: PLANES.profesional,
  usadosCiclo: 0,
  usadosHoyPlan: 0,
  usadosHoyPack: 0,
  saldoPack: 0,
  ...p,
});

test("los cupos son los que decidió Nico", () => {
  assert.equal(PLANES.gratis.creditosMes, 65);
  assert.equal(PLANES.profesional.creditosMes, 2_000);
  assert.equal(PLANES.profesional.precioMensualClp, 10_000);
  assert.equal(PLANES.director_tecnico.creditosMes, 40_000);
  assert.equal(PLANES.director_tecnico.precioMensualClp, 100_000);
});

const GPT_OSS = { usdMillonEntrada: 0.15, usdMillonSalida: 0.6 };
const CARO = { usdMillonEntrada: 3, usdMillonSalida: 15 };

test("un crédito es un costo: el modelo barato cobra 1, el caro cobra más", () => {
  // Consulta medida en septiembre: ~2.500 de entrada y ~160 de salida.
  assert.equal(creditosPorCosto(costoUsd(2_500, 160, GPT_OSS)), 1);
  assert.equal(creditosPorCosto(costoUsd(4_000, 600, GPT_OSS)), 1);
  assert.equal(creditosPorCosto(costoUsd(2_500, 160, CARO)), 10);
  assert.equal(creditosPorCosto(0.002), 2);
  assert.equal(creditosPorCosto(0), 1);
  assert.equal(creditosPorCosto(NaN), 1);
});

test("Profesional deja al menos 50 % de margen aunque se gaste entero", () => {
  const m = margenPeorCaso(PLANES.profesional.precioMensualClp, PLANES.profesional.creditosMes);
  assert.ok(m >= 0.5, `margen ${m}`);
});

test("Director Técnico es rentable aunque se gaste entero", () => {
  const m = margenPeorCaso(PLANES.director_tecnico.precioMensualClp, PLANES.director_tecnico.creditosMes);
  assert.ok(m >= 0.5, `margen ${m}`);
});

test("cambiar de modelo no rompe el margen: el crédito es un tope de costo", () => {
  // Con cualquier modelo, un crédito nunca cuesta más que USD_POR_CREDITO: el
  // peor caso ya está en margenPeorCaso con costoCreditoClp().
  for (const p of [PLANES.profesional, PLANES.director_tecnico]) {
    assert.ok(margenPeorCaso(p.precioMensualClp, p.creditosMes) >= 0.5, p.id);
  }
});

test("los packs dejan ≥ 75 % y cuestan más por crédito que el plan Profesional", () => {
  const precioCreditoPlan = PLANES.profesional.precioMensualClp / PLANES.profesional.creditosMes;
  for (const pack of Object.values(PACKS)) {
    assert.ok(margenPeorCaso(pack.precioClp, pack.creditos) >= 0.75, pack.id);
    assert.ok(pack.precioClp / pack.creditos > precioCreditoPlan, pack.id);
  }
});

test("el neto descuenta IVA y comisión", () => {
  const n = netoClp(10_000);
  assert.ok(n > 8_000 && n < 8_100, String(n));
});

test("primero se gasta el plan, después el pack", () => {
  assert.deepEqual(decidirFuente(estado({ saldoPack: 100 })), { permitido: true, fuente: "plan" });
  assert.deepEqual(decidirFuente(estado({ usadosCiclo: 2_000, saldoPack: 100 })), {
    permitido: true,
    fuente: "pack",
  });
  // Tope diario del plan alcanzado, pero hay pack: sigue con pack.
  assert.deepEqual(decidirFuente(estado({ usadosHoyPlan: 150, saldoPack: 1 })), {
    permitido: true,
    fuente: "pack",
  });
});

test("sin plan ni pack, se niega con el motivo correcto", () => {
  const mes = decidirFuente(estado({ usadosCiclo: 2_000 }));
  assert.equal(mes.permitido, false);
  assert.equal(mes.permitido === false && mes.motivo, "sin_creditos");

  const dia = decidirFuente(estado({ usadosHoyPlan: 150 }));
  assert.equal(dia.permitido === false && dia.motivo, "limite_diario");

  const pack = decidirFuente(estado({ usadosCiclo: 2_000, saldoPack: 50, usadosHoyPack: TOPE_DIARIO_PACK }));
  assert.equal(pack.permitido === false && pack.motivo, "limite_diario");
});

test("el plan gratis corta a los 10 del día y a los 65 del mes", () => {
  const g = (p: Partial<EstadoUso>) => decidirFuente(estado({ plan: PLANES.gratis, ...p }));
  assert.equal(g({ usadosHoyPlan: 9 }).permitido, true);
  assert.equal(g({ usadosHoyPlan: 10 }).permitido, false);
  assert.equal(g({ usadosCiclo: 65 }).permitido, false);
});

test("restantes nunca muestra negativos ni más del día que del mes", () => {
  assert.deepEqual(restantes(estado({ usadosCiclo: 1_990, usadosHoyPlan: 5 })), { mes: 10, hoy: 10, pack: 0 });
  assert.deepEqual(restantes(estado({ usadosCiclo: 2_001, saldoPack: -1 })), { mes: 0, hoy: 0, pack: 0 });
});
