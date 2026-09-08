// Evalúa la capa de IA contra las preguntas doradas ANTES de encenderla para
// todos. La pregunta que responde es una sola: ¿la respuesta redactada cita la
// norma correcta, o cita cualquier cosa?
//
//   REGULAMED_URL=https://regulamed.cl \
//   REGULAMED_COOKIE="better-auth.session_token=..." \
//   node scripts/eval-ia.mjs
//
// La cookie sale de tu propia sesión (DevTools → Application → Cookies). Se usa
// porque /api/search y /api/responder exigen sesión, que es justamente lo que
// queríamos de la Fase 2. No la dejes escrita en ningún archivo.
//
// Criterio de aprobación: >= 90% de respuestas que citan una fuente aceptable,
// y 0 respuestas que afirmen algo cuando el motor declaró ausencia.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DORADAS = path.join(AQUI, "..", "..", "cerebro", "preguntas-doradas.json");

const BASE = process.env.REGULAMED_URL || "http://localhost:3000";
const COOKIE = process.env.REGULAMED_COOKIE;

if (!COOKIE) {
  console.error("Falta REGULAMED_COOKIE (la cookie de sesión de tu cuenta).");
  process.exit(1);
}

const { preguntas } = JSON.parse(fs.readFileSync(DORADAS, "utf-8"));

function citaAceptable(texto, fuentes) {
  const plano = texto.toLowerCase();
  return fuentes.some((f) => {
    const numero = String(f.numero).toLowerCase();
    const tipo = String(f.tipo).toLowerCase().split(" ")[0];
    return plano.includes(numero) && plano.includes(tipo);
  });
}

const resultados = [];

for (const p of preguntas) {
  const busqueda = await fetch(
    `${BASE}/api/search?q=${encodeURIComponent(p.pregunta)}&k=6`,
    { headers: { cookie: COOKIE } }
  );

  if (!busqueda.ok) {
    console.error(`[${p.id}] la búsqueda respondió ${busqueda.status}`);
    resultados.push({ id: p.id, estado: "error_busqueda" });
    continue;
  }

  const datos = await busqueda.json();
  if (!datos.consultaId) {
    resultados.push({ id: p.id, estado: "sin_registro" });
    continue;
  }

  const respuesta = await fetch(`${BASE}/api/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ consultaId: datos.consultaId }),
  });

  const salida = await respuesta.json();

  if (salida.ausencia) {
    // Abstenerse no es un fallo: es el comportamiento correcto cuando la
    // evidencia no alcanza. Se cuenta aparte para poder mirarlo.
    resultados.push({ id: p.id, estado: "abstuvo", motivo: salida.motivo });
    continue;
  }

  if (!salida.respuesta) {
    resultados.push({ id: p.id, estado: "error", detalle: salida.error });
    continue;
  }

  const acierta = citaAceptable(salida.respuesta, p.fuentes_aceptables || []);
  resultados.push({
    id: p.id,
    estado: acierta ? "cita_correcta" : "cita_incorrecta",
    respuesta: salida.respuesta.slice(0, 300),
  });
}

const total = resultados.length;
const correctas = resultados.filter((r) => r.estado === "cita_correcta").length;
const incorrectas = resultados.filter((r) => r.estado === "cita_incorrecta");
const abstuvo = resultados.filter((r) => r.estado === "abstuvo").length;

console.log("\n─── Evaluación de la capa de IA ───");
console.log(`Preguntas: ${total}`);
console.log(`Cita correcta: ${correctas}`);
console.log(`Se abstuvo: ${abstuvo}`);
console.log(`Cita incorrecta: ${incorrectas.length}`);

for (const r of incorrectas) {
  console.log(`\n  [${r.id}] ${r.respuesta}`);
}

// El denominador excluye las abstenciones: abstenerse es correcto, y castigarlo
// empujaría a bajar la compuerta de confianza, que es lo que no queremos.
const evaluables = total - abstuvo;
const tasa = evaluables ? correctas / evaluables : 0;
console.log(`\nTasa de cita correcta: ${(tasa * 100).toFixed(1)}%`);
process.exit(tasa >= 0.9 && incorrectas.length === 0 ? 0 : 1);
