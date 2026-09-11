// Verificación de paridad: corre el motor TypeScript (lib/search.ts) sobre las
// preguntas que recibe por stdin y devuelve, por pregunta, la misma "firma"
// que calcula eval_respuestas.py con el motor Python. Si difieren, la compuerta
// del pipeline reprueba: lo que se evalúa en Python tiene que ser exactamente
// lo que sirve la web.
//
// No se usa desde la web. Lo invoca eval_respuestas.py así:
//   node --experimental-strip-types --no-warnings scripts/paridad-motor.mjs < entrada.json
// con entrada = {"preguntas": [...], "corpus": "ruta/a/corpus.jsonl"}.

import fs from "node:fs";
import { crearIndice, loadCorpus, responder } from "../lib/search.ts";

const entrada = JSON.parse(fs.readFileSync(0, "utf-8"));
const idx = crearIndice(loadCorpus(entrada.corpus));

const salida = {};
for (const pregunta of entrada.preguntas) {
  const r = responder(pregunta, {}, idx);
  const filas = (r.principal ? [r.principal] : []).concat(r.relacionadas);
  salida[pregunta] = {
    estado: r.estado,
    tipo: r.tipo,
    avisos: r.avisos,
    filas: filas.map((f) => [f.cita, f.frase, f.resaltar, f.avisos]),
  };
}
process.stdout.write(JSON.stringify(salida));
