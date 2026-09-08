#!/usr/bin/env node
/**
 * Pipeline diario del Cerebro Regulatorio.
 *
 * Pensado para el Programador de tareas de Windows (una vez al día), NO para
 * correr desde Claude Code: el paso de `git push` queda deliberadamente fuera
 * del sandbox del asistente (ver README de este mismo directorio).
 *
 *   1. Corre vigilancia-isp/check-normativa.js (scrape + diff contra el
 *      listado oficial del ISP).
 *   2. Descarga a ANAMED_Normativa/<categoria>/ los PDF de normas nuevas o
 *      modificadas que aún no están en disco.
 *  2b. Reconcilia el listado COMPLETO contra el disco y reintenta lo que falte.
 *      Sin este paso, una norma que falló su descarga en su día no se vuelve a
 *      intentar nunca (deja de aparecer en el diff). Resultado en
 *      registro-cambios/estado/reintentos.json. Nunca aborta el pipeline.
 *   3. Le pide a Ollama local un resumen en español de qué cambió y por qué
 *      le importaría a un profesional de asuntos regulatorios (no clasifica
 *      ni redacta metadatos: el listado oficial del ISP ya trae categoría,
 *      tipo, número, descripción y fecha estructurados).
 *   4. Reconstruye el corpus (build_corpus.py).
 *   5. COMPUERTA DE CALIDAD: corre eval_retrieval.py. Si el recall cae bajo el
 *      gate o el motor deja de abstenerse en consultas fuera del corpus, se
 *      aborta ANTES de copiar y publicar. Sin esta compuerta el pipeline podía
 *      degradar la recuperación y desplegarla igual: fue exactamente así como
 *      el recall bajó de 100% a 94% sin que nadie se enterara.
 *   6. Copia a web/data/corpus.jsonl + git add/commit/push en web/ — dispara el
 *      redeploy automático de Vercel vía su integración con GitHub.
 *
 * Todo el proceso queda registrado en logs/actualizacion-YYYY-MM-DD.log.
 * Un fallo duro (scrape abortado, build_corpus roto, compuerta reprobada)
 * termina con exit code 1 para que el Programador de tareas lo marque como
 * fallido en su historial.
 *
 * `--forzar-publicacion` publica aunque la compuerta repruebe. Existe para una
 * emergencia concreta y deja rastro en el log; no es el modo normal.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Raíz del repo. Antes se subían tres niveles hasta la carpeta del PC y se
// concatenaba el literal "Asuntos-Regulatorios": eso ataba el pipeline al árbol
// de un computador concreto y hacía imposible correrlo en CI. Ahora la raíz es
// el repo mismo, así que funciona igual en el PC y en el runner.
const REG_DIR = path.resolve(__dirname, "..", "..");
const ROOT = REG_DIR;
const VIGILANCIA_DIR = path.join(REG_DIR, "vigilancia-isp");
const ANAMED_DIR = process.env.REGULAMED_ANAMED_DIR || path.join(REG_DIR, "ANAMED_Normativa");
const CEREBRO_DIR = path.join(REG_DIR, "APP-Regulatoria", "cerebro");
const WEB_DIR = path.join(REG_DIR, "APP-Regulatoria", "web");
const LOG_DIR = path.join(VIGILANCIA_DIR, "logs");

const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = "qwen3:4b-instruct";
const GATE_RECALL = 90; // recall@5 mínimo para publicar (gate de Fase 1 del PRD)
const FORZAR = process.argv.includes("--forzar-publicacion");
// GitHub Actions (y cualquier CI decente) exporta CI=true. En CI cambian tres
// cosas: no hay Ollama, el commit lo hace el workflow, y los PDF pueden vivir
// en el directorio de caché en vez de en el árbol del repo.
const EN_CI = process.env.CI === "true" || process.env.CI === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Mapa: categoría tal como aparece en la web del ISP -> carpeta local en
// ANAMED_Normativa/. Si una categoría nueva no está mapeada, cae en "otros"
// y queda marcada para revisión manual.
const CATEGORIA_MAP = {
  "medicamentos": "medicamentos",
  "cosmeticos": "cosmeticos",
  "establecimientos, autorizacion y fiscalizacion": "establecimientos_autorizacion_y_fiscalizacion",
  "importacion y exportacion / control y vigilancia": "importacion_y_exportacion_control_y_vigilancia",
  "laboratorio nacional de control": "laboratorio_nacional_de_control",
  "farmacovigilancia": "farmacovigilancia",
  "ensayos clinicos": "ensayos_clinicos",
  "codigo sanitario": "codigo_sanitario",
};

const TIPOS = [
  "Decreto con Fuerza de Ley",
  "Decreto Supremo",
  "Decreto Exento",
  "Norma Técnica",
  "Resolución Exenta",
  "Circular",
  "Decreto",
  "Ley",
  "Oficio",
];

function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function normKey(s) {
  return stripAccents(s).toLowerCase().replace(/\s+/g, " ").trim();
}
function folderFor(categoria) {
  return CATEGORIA_MAP[normKey(categoria)] || "otros";
}
function formatNumero(numero) {
  const digits = (numero || "").replace(/\D/g, "");
  if (!digits) return numero || "";
  // Separador de miles estilo chileno, igual a los nombres de archivo existentes.
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const log = [];
function say(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  log.push(line);
}

// Nombre de archivo tal como lo publica el ISP. Es la clave con la que
// build_corpus.py empareja el PDF con su norma oficial (resuelve 162 de 163),
// así que conviene conservarla en vez de renombrar.
function urlBasename(u) {
  try {
    const limpio = decodeURIComponent((u || "").split("?")[0].split("#")[0]);
    return limpio.split("/").pop().trim().toLowerCase();
  } catch (e) {
    return "";
  }
}

// --- ¿ya tenemos un PDF para esta norma? ---
// Indexa por nombre de archivo Y por tipo+número. El nombre de archivo es la
// clave fiable: dos normas DISTINTAS pueden compartir tipo y número (el listado
// del ISP tiene dos "Resolución Exenta 2.053", una de Medicamentos y otra de
// Farmacovigilancia), y con la clave tipo+número sola la segunda nunca se
// descargaba porque parecía ya estar en disco.
function buildExistingIndex() {
  const porArchivo = new Set();
  const porNorma = new Set();
  const categorias = fs.readdirSync(ANAMED_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const cat of categorias) {
    const dir = path.join(ANAMED_DIR, cat.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith(".pdf")) continue;
      porArchivo.add(f.toLowerCase());
      const stem = f.replace(/\.pdf$/i, "");
      for (const tipo of TIPOS) {
        if (normKey(stem).startsWith(normKey(tipo))) {
          const resto = stem.slice(tipo.length).trim();
          const m = resto.match(/(\d[\d.\-]*)/);
          const numero = m ? m[1].replace(/\./g, "") : "";
          porNorma.add(`${normKey(tipo)}|${numero}`);
          break;
        }
      }
    }
  }
  return { porArchivo, porNorma };
}

function yaExiste(idx, record) {
  const base = urlBasename(record.enlace);
  if (base.endsWith(".pdf")) return idx.porArchivo.has(base);
  // Enlaces que no son PDF (BCN/LeyChile): solo queda la clave tipo+número.
  return idx.porNorma.has(`${normKey(record.tipo)}|${(record.numero || "").replace(/\D/g, "")}`);
}

function downloadPdf(record) {
  const folder = folderFor(record.categoria);
  const dir = path.join(ANAMED_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const base = urlBasename(record.enlace);
  const filename = base.endsWith(".pdf")
    ? base
    : `${record.tipo} ${formatNumero(record.numero)}.pdf`.trim();
  const dest = path.join(dir, filename);
  execFileSync("curl", ["-sL", "--max-time", "60", "-A", UA, "-o", dest, record.enlace]);
  const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  if (size < 1024) {
    fs.rmSync(dest, { force: true });
    throw new Error(`descarga sospechosamente pequeña (${size} bytes): ${record.enlace}`);
  }
  return dest;
}

function ollamaResumen(diff) {
  const items = [...diff.nuevas.map((r) => ({ ...r, estado: "nueva" })), ...diff.modificadas.map((m) => ({ ...m.despues, estado: "modificada" }))];
  if (!items.length) return null;
  const listado = items
    .map((r, i) => `${i + 1}. [${r.estado}] ${r.tipo} ${r.numero} — ${r.descripcion} (${r.categoria}, ${r.fecha})`)
    .join("\n");
  const prompt = `Eres un asistente de vigilancia regulatoria farmacéutica en Chile. A continuación una lista de normas nuevas o modificadas detectadas hoy en el listado oficial ANAMED del ISP. Escribe un resumen breve en español (máx. 8 líneas), en lenguaje humano, agrupando por relevancia para un profesional de asuntos regulatorios (QF/QA). No inventes contenido que no esté en la lista; si algo no está claro, dilo.\n\n${listado}`;

  try {
    const res = execFileSync(
      "curl",
      [
        "-s",
        "--max-time",
        "120",
        OLLAMA_URL,
        "-d",
        JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      ],
      { maxBuffer: 8 * 1024 * 1024 }
    );
    const parsed = JSON.parse(res.toString("utf-8"));
    return parsed?.message?.content?.trim() || null;
  } catch (e) {
    say(`[warn] Ollama no disponible o falló la síntesis del resumen: ${e.message}`);
    return null;
  }
}

function runGit(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

// La evaluación devuelve exit code 1 cuando reprueba, así que execFileSync
// lanza; el JSON viene igual por stdout y es lo que interesa registrar.
function correrEvaluacion() {
  const args = ["eval_retrieval.py", "--k", "5", "--gate", String(GATE_RECALL), "--json"];
  const opts = { cwd: CEREBRO_DIR, encoding: "utf-8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } };
  let salida;
  try {
    salida = execFileSync("python", args, opts);
  } catch (e) {
    salida = (e.stdout || "").toString();
    if (!salida.trim()) {
      say(`  [error] no se pudo correr eval_retrieval.py: ${e.message}`);
      return null;
    }
  }
  try {
    return JSON.parse(salida.trim().split("\n").pop());
  } catch (e) {
    say(`  [error] salida de eval_retrieval.py ilegible: ${e.message}`);
    return null;
  }
}

function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);

  say("=== Pipeline diario Cerebro Regulatorio ===");

  say("Paso 1/6: vigilancia ISP (scrape + diff)…");
  const { run } = require(path.join(VIGILANCIA_DIR, "check-normativa.js"));
  const { baseline, diff, total } = run();
  const nCambios = diff.nuevas.length + diff.modificadas.length + diff.eliminadas.length;
  say(`  total normas: ${total} · nuevas: ${diff.nuevas.length} · modificadas: ${diff.modificadas.length} · eliminadas: ${diff.eliminadas.length}`);

  say("Paso 2/6: descarga de PDF nuevos/modificados…");
  const existing = buildExistingIndex();
  const candidatos = [...diff.nuevas, ...diff.modificadas.map((m) => m.despues)];
  let descargados = 0;
  let fallidos = 0;
  for (const r of candidatos) {
    if (!r.enlace) {
      say(`  [skip] sin enlace a PDF: ${r.tipo} ${r.numero}`);
      continue;
    }
    if (yaExiste(existing, r)) {
      say(`  [skip] ya existe en disco: ${r.tipo} ${r.numero}`);
      continue;
    }
    try {
      const dest = downloadPdf(r);
      say(`  [ok] descargado: ${dest}`);
      descargados++;
    } catch (e) {
      say(`  [error] no se pudo descargar ${r.tipo} ${r.numero}: ${e.message}`);
      fallidos++;
    }
  }
  say(`  descargados: ${descargados} · fallidos: ${fallidos}`);

  // --- Paso 2b: reconciliación completa listado ↔ disco -----------------------
  // El paso 2 solo mira las normas que CAMBIARON hoy. Una norma que quedó sin
  // descargar en su momento (enlace con espacio final, 404 pasajero, ISP caído)
  // no se reintenta nunca más: dejó de estar en el diff y se volvió invisible.
  // Así es como el listado llegó a 124 normas contra 120 documentos sin que
  // nadie se enterara. Este paso cruza el listado COMPLETO contra el disco y
  // reintenta lo que falte.
  //
  // Nunca aborta el pipeline: si algo falla se registra y se sigue. El
  // resultado queda en registro-cambios/estado/reintentos.json, que es lo que
  // lee la revisión semanal para reportar la normativa pendiente.
  say("Paso 2b/6: reintento de normas del listado que faltan en disco…");
  try {
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(VIGILANCIA_DIR, "snapshots", "latest.json"), "utf-8")
    );
    // Misma clave que usa registro-cambios/revisar-semanal.js. La categoría va
    // incluida a propósito: el listado tiene dos "Resolución Exenta 2.053"
    // distintas y sin ella se pisarían entre sí.
    const claveNorma = (r) =>
      `${normKey(r.categoria)}|${normKey(r.tipo)}|${(r.numero || "").replace(/\D/g, "") || normKey(r.numero)}`;

    const idx = buildExistingIndex();
    const resultados = {};
    const noRecuperables = [];
    const vistos = new Set();
    let recuperados = 0;

    for (const r of snapshot.records || []) {
      const clave = claveNorma(r);
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const base = urlBasename(r.enlace);
      if (!base.endsWith(".pdf")) {
        // El ISP enlaza a la ficha de BCN/LeyChile: no hay PDF que bajar. No es
        // un fallo, es una norma sin archivo publicado. Se registra y se deja
        // la decisión de fuente a un humano: un texto que no viene del ISP no
        // puede heredar la vigencia que certifica el listado de ANAMED.
        if (!yaExiste(idx, r)) {
          noRecuperables.push({
            clave,
            norma: `${r.tipo} ${r.numero}`,
            categoria: r.categoria,
            enlace: r.enlace,
            motivo: "el ISP enlaza a BCN/LeyChile, no publica PDF",
          });
        }
        continue;
      }
      if (idx.porArchivo.has(base)) continue;

      try {
        const dest = downloadPdf(r);
        say(`  [recuperado] ${r.tipo} ${r.numero} → ${dest}`);
        idx.porArchivo.add(base);
        resultados[clave] = { norma: `${r.tipo} ${r.numero}`, enlace: r.enlace, ok: true, destino: dest };
        recuperados++;
        descargados++;
      } catch (e) {
        say(`  [pendiente] ${r.tipo} ${r.numero}: ${e.message}`);
        resultados[clave] = { norma: `${r.tipo} ${r.numero}`, enlace: r.enlace, ok: false, error: e.message };
      }
    }

    const estadoDir = path.join(REG_DIR, "registro-cambios", "estado");
    fs.mkdirSync(estadoDir, { recursive: true });
    fs.writeFileSync(
      path.join(estadoDir, "reintentos.json"),
      JSON.stringify(
        {
          fecha: stamp,
          ejecutado_por: "actualizar-diario.js (paso 2b)",
          recuperados,
          pendientes: Object.values(resultados).filter((x) => !x.ok).length,
          resultados,
          no_recuperables: noRecuperables,
        },
        null,
        2
      ),
      "utf-8"
    );
    say(`  recuperados: ${recuperados} · siguen pendientes: ${Object.values(resultados).filter((x) => !x.ok).length} · sin PDF publicado: ${noRecuperables.length}`);
  } catch (e) {
    say(`  [warn] el reintento de faltantes no se pudo completar: ${e.message}`);
  }

  say("Paso 3/6: resumen del día con Ollama local…");
  const resumen = nCambios > 0 && !EN_CI ? ollamaResumen(diff) : null;
  if (resumen) {
    const resumenPath = path.join(LOG_DIR, `resumen-${stamp}.md`);
    fs.writeFileSync(resumenPath, `# Resumen de vigilancia ANAMED — ${stamp}\n\n${resumen}\n`);
    say(`  resumen guardado en ${resumenPath}`);
  } else {
    say("  sin cambios que resumir (o Ollama no disponible).");
  }

  say("Paso 4/6: reconstrucción del corpus…");
  execFileSync("python", ["build_corpus.py"], { cwd: CEREBRO_DIR, stdio: "inherit" });

  say("Paso 5/6: compuerta de calidad (recall + abstención)…");
  const evalRes = correrEvaluacion();
  if (evalRes) {
    say(
      `  recall@${evalRes.k}: ${evalRes.hits}/${evalRes.total} = ${evalRes.recall}% (gate ${evalRes.gate}%)` +
        ` · abstención: ${evalRes.fuera_ok}/${evalRes.fuera_total} = ${evalRes.abstencion}%`
    );
    if (evalRes.fallos && evalRes.fallos.length) say(`  fallos de recall: ${evalRes.fallos.join(", ")}`);
    if (evalRes.falsas_abstenciones && evalRes.falsas_abstenciones.length) {
      say(`  falsas abstenciones: ${evalRes.falsas_abstenciones.join(", ")}`);
    }
  }
  if (!evalRes || !evalRes.pasa) {
    if (FORZAR) {
      say("  [warn] compuerta REPROBADA — se publica igual por --forzar-publicacion.");
    } else {
      say("  [abort] compuerta REPROBADA: no se copia ni se publica el corpus.");
      say("          El corpus local quedó reconstruido; revisa con: python eval_retrieval.py --k 5");
      throw new Error("compuerta de calidad reprobada");
    }
  } else {
    say("  compuerta aprobada.");
  }

  say("Paso 6/6: publicación (copia + commit + push, redeploy en Railway)…");
  const corpusSrc = path.join(CEREBRO_DIR, "corpus", "corpus.jsonl");
  const corpusDest = path.join(WEB_DIR, "data", "corpus.jsonl");
  fs.mkdirSync(path.dirname(corpusDest), { recursive: true });
  fs.copyFileSync(corpusSrc, corpusDest);
  say(`  corpus copiado a ${corpusDest}`);

  // La web necesita saber CUÁNDO se generó el corpus, no solo qué contiene.
  // Sin esta fecha, /api/estado no puede distinguir un corpus de hoy de uno de
  // hace tres meses, y un corpus viejo pasa el healthcheck igual de sano. Es la
  // falla que tuvo el proyecto 8 días sin que nadie lo notara.
  const metaSrc = path.join(CEREBRO_DIR, "corpus", "metadata.json");
  if (fs.existsSync(metaSrc)) {
    const meta = JSON.parse(fs.readFileSync(metaSrc, "utf-8"));
    fs.writeFileSync(
      path.join(WEB_DIR, "data", "estado-corpus.json"),
      JSON.stringify(
        {
          generado: meta.generado,
          snapshot_fetched_at: meta.snapshot_fetched_at,
          documentos: (meta.documentos || []).length,
          normas_listado_oficial: meta.normas_listado_oficial,
          publicado_por: EN_CI ? "github-actions" : "pc-local",
        },
        null,
        2
      ),
      "utf-8"
    );
    say("  estado-corpus.json actualizado.");
  }

  // En CI el commit lo hace el workflow (tiene el token y sabe empujar a la
  // rama correcta). Acá solo se prepara el árbol y se sale.
  if (EN_CI) {
    say("  corriendo en CI: el commit y el push los hace el workflow.");
    say("=== Fin del pipeline ===");
    return;
  }

  try {
    const status = runGit(["status", "--porcelain"], REG_DIR);
    if (!status) {
      say("  sin cambios para commitear.");
    } else {
      runGit(["add", "-A"], REG_DIR);
      runGit(["commit", "-m", `chore(corpus): actualización diaria ${stamp} (+${diff.nuevas.length}/~${diff.modificadas.length}/-${diff.eliminadas.length})`], REG_DIR);
      runGit(["push"], REG_DIR);
      say("  push realizado.");
    }
  } catch (e) {
    say(`  [warn] no se pudo hacer commit/push (¿remote configurado?): ${e.message}`);
  }

  say("=== Fin del pipeline ===");
  fs.writeFileSync(path.join(LOG_DIR, `actualizacion-${stamp}.log`), log.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  say(`FATAL: ${e.message}`);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(path.join(LOG_DIR, `actualizacion-${stamp}.log`), log.join("\n") + "\n");
  process.exit(1);
}
