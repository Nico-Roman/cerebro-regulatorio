// Evaluación del asistente (encargo C, fase 1) sobre cerebro/preguntas-reales-100.json.
//
//   node --experimental-strip-types --no-warnings scripts/eval-asistente.mjs
//   node ... scripts/eval-asistente.mjs --solo a01,a04 --salida informe.md
//   node ... scripts/eval-asistente.mjs --sin-linea-base     # la mitad del costo
//   node ... scripts/eval-asistente.mjs --presupuesto-min 35 # informe parcial si no alcanza
//
// Corre lo mismo que /api/responder —planificación, recuperación con el motor
// TypeScript real, redacción con el prompt real y verificación— sin servidor
// ni base de datos. Necesita el modelo: lee LLM_API_KEY, LLM_BASE_URL y
// LLM_MODEL del entorno o de .env.local, y nunca los imprime. No corre en el
// CI de la web: lo corre .github/workflows/eval-asistente.yml con la clave
// guardada como secreto.
//
// Compara contra la línea base: la misma evaluación SIN planificación (solo la
// pregunta original, como antes del encargo C). Informa por modo y por fuente:
//   top 3          la norma esperada está entre los 3 primeros pasajes que llegan
//                  al redactor (solo preguntas con norma esperada)
//   encontrado falso  respondió cuando lo correcto era abstenerse, o respondió
//                  citando solo normas que no son la esperada
//   abstenciones   correctas (se esperaba) y falsas (había respuesta)
//   sin cita       oraciones que imponen algo sin una cita válida
//   latencia p50/p95 y costo total (planificación + redacción)
// La meta del fin de semana (0 encontrados falsos, 80 % en el top 3) se mide
// solo sobre las preguntas con revisado_por_nico: true.

import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SET = path.join(WEB, "..", "cerebro", "preguntas-reales-100.json");

registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) {
      const base = path.join(WEB, esp.slice(2));
      return next(pathToFileURL(fs.existsSync(`${base}.ts`) ? `${base}.ts` : base).href, ctx);
    }
    return next(esp, ctx);
  },
});

function cargarEnvLocal() {
  const ruta = path.join(WEB, ".env.local");
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, "utf-8").split(/\r?\n/)) {
    const m = linea.match(/^\s*(LLM_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argumento = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

cargarEnvLocal();
if (!process.env.LLM_API_KEY) {
  console.error("Falta LLM_API_KEY (en el entorno o en .env.local).");
  process.exit(1);
}

const { crearIndice, loadCorpus, responder } = await import("../lib/search.ts");
const { pasajesDesdeResultados, redactarRespuesta } = await import("../lib/ia/redactar.ts");
const { MAX_PASAJES, admitePlanificacion, planificarBusquedas, unirPasajes } = await import("../lib/ia/planificar.ts");
const { ErrorProveedor, configDesdeEntorno } = await import("../lib/ia/proveedor.ts");

const PASAJES_POR_BUSQUEDA = 6; // mismo valor que app/api/responder/route.ts
const config = configDesdeEntorno();
const idx = crearIndice(loadCorpus());
const conLineaBase = !process.argv.includes("--sin-linea-base");
const solo = argumento("--solo")?.split(",");

let preguntas = JSON.parse(fs.readFileSync(SET, "utf-8")).preguntas.filter((p) => p.pregunta?.trim());
if (solo) preguntas = preguntas.filter((p) => solo.includes(p.id));
const limite = Number.parseInt(argumento("--limite") ?? "", 10);
if (Number.isFinite(limite)) preguntas = preguntas.slice(0, limite);
// Con el cupo del tier gratuito agotado, cada 429 espera hasta 2 min y las 100
// preguntas no caben en el job: pasado el presupuesto se deja de preguntar y
// el informe sale parcial, en vez de que el job muera sin informe.
const presupuestoMin = Number.parseFloat(argumento("--presupuesto-min") ?? "");
const plazo = Number.isFinite(presupuestoMin) ? Date.now() + presupuestoMin * 60_000 : Infinity;

const esperada = (p, numero) => (p.numeros_aceptables || []).some((rx) => new RegExp(`^(?:${rx})$`).test(numero || ""));
const debeAbstenerse = (p) =>
  Boolean(p.abstencion_esperada) || Boolean(p.requiere_categoria && !idx.tieneCategoria(p.requiere_categoria));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reintenta los 429 del proveedor: la evaluación no debe medir el tope del tier. */
async function conReintento(fn) {
  for (let intento = 0; ; intento++) {
    try {
      return await fn();
    } catch (e) {
      const ms = Math.min(120, (e instanceof ErrorProveedor && e.reintentarEnSeg) || 20) * 1000;
      if (e instanceof ErrorProveedor && e.status === 429 && intento < 4 && Date.now() + ms < plazo) {
        await espera(ms);
        continue;
      }
      throw e;
    }
  }
}

async function evaluar(p, planificar) {
  const opts = { k: PASAJES_POR_BUSQUEDA };
  const original = responder(p.pregunta, opts, idx);
  let plan = { busquedas: [p.pregunta], planificado: false, costoUsd: 0, latenciaMs: 0, error: null };
  let filas;
  if (!admitePlanificacion(original)) {
    filas = [];
  } else if (planificar) {
    plan = await planificarBusquedas(p.pregunta, { config });
    const respuestas = [original, ...plan.busquedas.slice(1).map((b) => responder(b, opts, idx))];
    filas = unirPasajes(respuestas, MAX_PASAJES);
  } else {
    filas = unirPasajes([original], MAX_PASAJES);
  }

  const top3 = filas.slice(0, 3).some((f) => esperada(p, f._numero));
  const fila = {
    id: p.id,
    fuente: p.fuente,
    revisado: Boolean(p.revisado_por_nico),
    conNorma: (p.numeros_aceptables || []).length > 0 && !debeAbstenerse(p),
    debeAbstenerse: debeAbstenerse(p),
    top3,
    busquedas: plan.planificado ? plan.busquedas.slice(1) : [],
    planError: plan.error,
    abstuvo: true,
    encontradoFalso: false,
    falsaAbstencion: false,
    sinCita: 0,
    citadas: [],
    texto: "",
    latenciaMs: plan.latenciaMs,
    costoUsd: plan.costoUsd,
    error: null,
  };

  if (filas.length) {
    try {
      const pasajes = pasajesDesdeResultados(filas);
      const salida = await conReintento(() => redactarRespuesta(p.pregunta, pasajes, config));
      const r = salida.redaccion;
      fila.abstuvo = r.abstuvo;
      fila.sinCita = r.afirmacionesSinCita.length;
      fila.citadas = r.fuentes.map((f) => ({ cita: f.cita, numero: filas[f.n - 1]?._numero || "" }));
      fila.texto = r.texto;
      fila.latenciaMs += salida.latenciaMs;
      fila.costoUsd += salida.costoUsd;
    } catch (e) {
      fila.error = e instanceof Error ? e.message.slice(0, 160) : String(e);
    }
  }

  if (!fila.abstuvo && !fila.error) {
    fila.encontradoFalso =
      fila.debeAbstenerse || (fila.conNorma && !fila.citadas.some((c) => esperada(p, c.numero)));
  }
  fila.falsaAbstencion = fila.abstuvo && !fila.error && fila.conNorma;
  return fila;
}

const percentil = (xs, q) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(q * o.length))];
};

function resumen(filas) {
  const conNorma = filas.filter((f) => f.conNorma);
  return {
    n: filas.length,
    top3: conNorma.filter((f) => f.top3).length,
    conNorma: conNorma.length,
    encontradosFalsos: filas.filter((f) => f.encontradoFalso).length,
    abstencionesCorrectas: filas.filter((f) => f.abstuvo && f.debeAbstenerse).length,
    debenAbstenerse: filas.filter((f) => f.debeAbstenerse).length,
    falsasAbstenciones: filas.filter((f) => f.falsaAbstencion).length,
    sinCita: filas.reduce((a, f) => a + f.sinCita, 0),
    p50: percentil(filas.map((f) => f.latenciaMs), 0.5),
    p95: percentil(filas.map((f) => f.latenciaMs), 0.95),
    costo: filas.reduce((a, f) => a + f.costoUsd, 0),
    errores: filas.filter((f) => f.error).length,
    planificadas: filas.filter((f) => f.busquedas.length).length,
  };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : "—");

function tabla(titulo, grupos) {
  const L = [
    `### ${titulo}`,
    "",
    "| | preguntas | top 3 | «encontrado» falsos | abstenciones correctas | falsas abstenciones | afirmaciones sin cita | p50 | p95 | costo US$ |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [nombre, fs_] of grupos) {
    const s = resumen(fs_);
    L.push(
      `| ${nombre} | ${s.n} | ${s.top3}/${s.conNorma} (${pct(s.top3, s.conNorma)}) | ${s.encontradosFalsos} | ${s.abstencionesCorrectas}/${s.debenAbstenerse} | ${s.falsasAbstenciones} | ${s.sinCita} | ${(s.p50 / 1000).toFixed(1)} s | ${(s.p95 / 1000).toFixed(1)} s | ${s.costo.toFixed(4)} |`
    );
  }
  return L.join("\n");
}

const gravedad = (f) => (f.encontradoFalso ? 3 : f.conNorma && !f.top3 ? 2 : f.falsaAbstencion ? 1 : f.sinCita ? 0.5 : 0);

const conPlan = [];
const base = [];
for (const [i, p] of preguntas.entries()) {
  if (Date.now() > plazo) break;
  conPlan.push(await evaluar(p, true));
  if (conLineaBase) base.push(await evaluar(p, false));
  // Una línea por pregunta: en el log de Actions los puntos sin salto de línea
  // no se ven hasta el final, y un job cortado no mostraba nada.
  process.stderr.write(`${i + 1}/${preguntas.length} ${p.id}${conPlan.at(-1).error ? " (error del proveedor)" : ""}\n`);
}
const faltantes = preguntas.length - conPlan.length;

const porFuente = (filas) =>
  [...new Set(filas.map((f) => f.fuente))].map((fu) => [fu, filas.filter((f) => f.fuente === fu)]);
const revisadas = conPlan.filter((f) => f.revisado);
const meta = resumen(revisadas);
const sPlan = resumen(conPlan);

const peores = [...conPlan]
  .filter((f) => gravedad(f) > 0)
  .sort((a, b) => gravedad(b) - gravedad(a))
  .slice(0, 10);
const pregunta = Object.fromEntries(preguntas.map((p) => [p.id, p]));

const informe = [
  `# Evaluación del asistente — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Modelo: \`${config.modelo}\` · preguntas con texto: ${preguntas.length} · planificación usada en ${sPlan.planificadas}/${sPlan.n}` +
    ` · errores del proveedor: ${sPlan.errores}`,
  "",
  ...(faltantes
    ? [
        `**Informe parcial:** se agotó el presupuesto de ${presupuestoMin} min con ${conPlan.length} de ${preguntas.length} ` +
          "preguntas evaluadas (casi siempre, el cupo del proveedor). Las cifras son solo de esas.",
        "",
      ]
    : []),
  `**Meta (solo revisadas por Nico, ${meta.n}):** «encontrado» falsos ${meta.encontradosFalsos} (meta 0) · ` +
    `norma correcta en el top 3 ${meta.top3}/${meta.conNorma} = ${pct(meta.top3, meta.conNorma)} (meta 80 %, mínimo 60 preguntas).`,
  "",
  tabla(
    "Planificación vs. línea base",
    conLineaBase ? [["con planificación", conPlan], ["línea base (sin planificar)", base]] : [["con planificación", conPlan]]
  ),
  "",
  tabla("Por fuente (con planificación)", porFuente(conPlan)),
  "",
  "### Las 10 peores",
  "",
  ...(peores.length
    ? peores.map((f, i) => {
        const p = pregunta[f.id];
        const motivo = f.encontradoFalso
          ? "«encontrado» falso"
          : f.conNorma && !f.top3
            ? "norma esperada fuera del top 3"
            : f.falsaAbstencion
              ? "falsa abstención"
              : "afirmaciones sin cita";
        return [
          `${i + 1}. **${f.id}** (${f.fuente}) — ${motivo}`,
          `   - Pregunta: ${p.pregunta}`,
          `   - Esperado: ${p.norma_esperada || "abstención"}${p.cita_esperada ? ` · ${p.cita_esperada}` : ""}`,
          `   - Salió: ${f.abstuvo ? "se abstuvo" : f.citadas.map((c) => c.cita).join("; ") || "sin citas"}` +
            (f.busquedas.length ? ` · búsquedas: ${f.busquedas.map((b) => `«${b}»`).join(", ")}` : ""),
          f.texto ? `   - Respuesta: ${f.texto.replace(/\s+/g, " ").slice(0, 240)}…` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
    : ["Ninguna falla."]),
  "",
].join("\n");

const salida = argumento("--salida");
if (salida) {
  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  fs.writeFileSync(salida, informe);
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, informe + "\n");
process.stdout.write(informe + "\n");
