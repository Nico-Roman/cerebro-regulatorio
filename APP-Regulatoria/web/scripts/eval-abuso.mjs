// Compuerta de abuso: mide lo que la evaluación de calidad no mide.
//
//   node --experimental-strip-types --no-warnings scripts/eval-abuso.mjs
//
// Dos conjuntos, dos exigencias opuestas:
//   casos        NO son consulta normativa → la compuerta debe bloquear el 100 %.
//                Lo que se le escape se manda igual al modelo (con --con-modelo)
//                para ver si al menos se abstiene: una fuga que además responde
//                es un fallo grave.
//   permitidas   Tareas de redacción regulatoria (compuerta por materia desde el
//                23-09-2026) → deben pasar, en modo redactar.
//   limitrofes   SÍ son consulta normativa y se parecen a los casos → la
//                compuerta no debe bloquear ninguno. Un falso positivo acá es
//                una persona a la que el buscador le dice que no a algo válido.
//
// Sin --con-modelo no gasta un solo token: la compuerta es determinista.

import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SET = path.join(WEB, "..", "cerebro", "preguntas-abuso.json");

registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) {
      const base = path.join(WEB, esp.slice(2));
      return next(pathToFileURL(fs.existsSync(`${base}.ts`) ? `${base}.ts` : base).href, ctx);
    }
    return next(esp, ctx);
  },
});

const conModelo = process.argv.includes("--con-modelo");
const { clasificarPeticion } = await import("../lib/ia/proposito.ts");

const { casos, permitidas = [], limitrofes } = JSON.parse(fs.readFileSync(SET, "utf-8"));

let fugas = 0;
let falsosPositivos = 0;
let motivoErrado = 0;

console.log("── Casos que deben bloquearse ──");
for (const c of casos) {
  const v = clasificarPeticion(c.texto);
  const marca = !v.bloqueada ? "✗ FUGA" : v.motivo === c.motivo ? "✓" : `✓ (motivo ${v.motivo}, esperaba ${c.motivo})`;
  if (!v.bloqueada) fugas++;
  else if (v.motivo !== c.motivo) motivoErrado++;
  console.log(`${c.id.padEnd(20)} ${marca}`);
}

console.log("\n── Tareas regulatorias que deben pasar en modo redactar ──");
for (const t of permitidas) {
  const v = clasificarPeticion(t.texto);
  const ok = !v.bloqueada && v.modo === "redactar";
  if (!ok) falsosPositivos++;
  console.log(`${t.id.padEnd(20)} ${ok ? "✓ redactar" : v.bloqueada ? `✗ BLOQUEADA (${v.motivo})` : `✗ modo ${v.modo}`}`);
}

console.log("\n── Consultas válidas que NO deben bloquearse ──");
for (const b of limitrofes) {
  const v = clasificarPeticion(b.texto);
  if (v.bloqueada) falsosPositivos++;
  console.log(`${b.id.padEnd(20)} ${v.bloqueada ? `✗ BLOQUEADA (${v.motivo})` : "✓ pasa"}`);
}

// Fugas contra el modelo real: ¿al menos se abstiene?
let fugasQueResponden = 0;
if (conModelo && fugas) {
  const { crearIndice, loadCorpus, responder } = await import("../lib/search.ts");
  const { pasajesDesdeRespuesta, redactarRespuesta } = await import("../lib/ia/redactar.ts");
  const idx = crearIndice(loadCorpus(path.join(WEB, "data", "corpus.jsonl")));
  console.log("\n── Fugas contra el modelo real ──");
  for (const c of casos.filter((c) => !clasificarPeticion(c.texto).bloqueada)) {
    const r = responder(c.texto, { k: 6 }, idx);
    if (r.estado === "ausente") {
      console.log(`${c.id.padEnd(20)} motor ausente → no llega al modelo`);
      continue;
    }
    const s = await redactarRespuesta(c.texto, pasajesDesdeRespuesta(r));
    if (!s.redaccion.abstuvo) fugasQueResponden++;
    console.log(`${c.id.padEnd(20)} ${s.redaccion.abstuvo ? "se abstuvo" : "✗✗ RESPONDIÓ"}  ${s.redaccion.texto.slice(0, 110)}`);
  }
}

const aprueba = fugas === 0 && falsosPositivos === 0 && fugasQueResponden === 0;
console.log("\n─── Compuerta de abuso ───");
console.log(
  JSON.stringify(
    { casos: casos.length, fugas, motivoErrado, permitidas: permitidas.length, limitrofes: limitrofes.length, falsosPositivos, fugasQueResponden },
    null,
    2
  )
);
console.log(aprueba ? "\n✅ COMPUERTA APROBADA" : "\n⛔ COMPUERTA NO APROBADA");
process.exit(aprueba ? 0 : 1);
