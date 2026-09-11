#!/usr/bin/env node
/**
 * revisar-semanal.js — Revisión semanal de la información regulatoria en uso.
 *
 * Responde tres preguntas que hoy nadie contestaba:
 *
 *   1. ¿Qué cambió en el listado oficial del ISP desde la última revisión?
 *      El pipeline diario detecta cambios, pero escribe el detalle en
 *      snapshots/last-diff.json, que se SOBRESCRIBE al día siguiente. Acá el
 *      diff se hace contra una referencia propia (estado/snapshot-referencia.json)
 *      y el detalle campo por campo se guarda para siempre en cambios.jsonl.
 *
 *   2. ¿Qué normativa está en el listado pero NO disponible en disco?
 *      Es el hueco conocido del corpus. Se registra con el motivo concreto
 *      (enlace que no es PDF, descarga fallida) y desde cuándo está pendiente.
 *
 *   3. ¿El pipeline diario sigue corriendo?
 *      (Desde sept. 2026 corre en GitHub Actions, no en el PC. El testigo de
 *      primera línea es el monitor externo sobre /api/estado; esta revisión es
 *      la segunda mirada, con interpretación.)
 *      Una vigilancia que se cayó en silencio es peor que no tenerla: el corpus
 *      se ve igual de sano mientras envejece. Se revisa la antigüedad del
 *      snapshot, de los logs y del corpus.
 *
 * NO requiere red: se apoya en lo que dejó el pipeline diario (que sí la tiene).
 * NO toca ANAMED_Normativa/ ni el corpus. Solo lee y escribe en esta carpeta.
 *
 *   node revisar-semanal.js            # revisa, registra y escribe el informe
 *   node revisar-semanal.js --dry-run  # no escribe nada
 */

const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry-run");

const AQUI = __dirname;
const REG_DIR = path.resolve(AQUI, "..");                       // Asuntos-Regulatorios
const VIGILANCIA = path.join(REG_DIR, "vigilancia-isp");
const ANAMED = path.join(REG_DIR, "ANAMED_Normativa");
const CORPUS = path.join(REG_DIR, "APP-Regulatoria", "cerebro", "corpus");

const F = {
  snapshotISP: path.join(VIGILANCIA, "snapshots", "latest.json"),
  historial: path.join(VIGILANCIA, "historial.json"),
  logs: path.join(VIGILANCIA, "logs"),
  metadata: path.join(CORPUS, "metadata.json"),
  referencia: path.join(AQUI, "estado", "snapshot-referencia.json"),
  reintentos: path.join(AQUI, "estado", "reintentos.json"),
  cambios: path.join(AQUI, "cambios.jsonl"),
  pendientes: path.join(AQUI, "pendientes.md"),
  informes: path.join(AQUI, "informes"),
};

const AHORA = new Date();
const HOY = AHORA.toISOString().slice(0, 10);

// --- utilidades ---------------------------------------------------------------

function leerJSON(p, porDefecto = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    return porDefecto;
  }
}

function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function normKey(s) {
  return stripAccents(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Clave estable de una norma. Categoría incluida a propósito: el listado tiene
 *  dos "Resolución Exenta 2.053" distintas, una de Medicamentos y otra de
 *  Farmacovigilancia. Sin la categoría se pisarían entre ellas. */
function claveNorma(r) {
  return `${normKey(r.categoria)}|${normKey(r.tipo)}|${(r.numero || "").replace(/\D/g, "") || normKey(r.numero)}`;
}

function urlBasename(u) {
  try {
    const limpio = decodeURIComponent((u || "").split("?")[0].split("#")[0]).trim();
    return limpio.split("/").pop().trim().toLowerCase();
  } catch (e) {
    return "";
  }
}

/** Semana ISO — para nombrar el informe (2026-W37). */
function semanaISO(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const sem = Math.ceil(((t - inicio) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(sem).padStart(2, "0")}`;
}

function diasDesde(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d)) return null;
  return Math.floor((AHORA - d) / 86400000);
}

// --- 1. Diff del listado oficial ----------------------------------------------

const CAMPOS_VIGILADOS = ["descripcion", "fecha", "enlace", "modificaciones", "materia"];

function diffListado(refRecords, actRecords) {
  const ref = new Map((refRecords || []).map((r) => [claveNorma(r), r]));
  const act = new Map((actRecords || []).map((r) => [claveNorma(r), r]));

  const nuevas = [];
  const modificadas = [];
  const eliminadas = [];

  for (const [k, r] of act) if (!ref.has(k)) nuevas.push(r);
  for (const [k, r] of ref) if (!act.has(k)) eliminadas.push(r);

  for (const [k, despues] of act) {
    const antes = ref.get(k);
    if (!antes) continue;
    const campos = {};
    for (const campo of CAMPOS_VIGILADOS) {
      const a = (antes[campo] || "").trim();
      const b = (despues[campo] || "").trim();
      if (a !== b) campos[campo] = { antes: a, despues: b };
    }
    if (Object.keys(campos).length) modificadas.push({ clave: k, antes, despues, campos });
  }

  return { nuevas, modificadas, eliminadas };
}

// --- 2. Listado oficial vs. PDFs en disco -------------------------------------

function pdfsEnDisco() {
  const set = new Set();
  if (!fs.existsSync(ANAMED)) return set;
  for (const cat of fs.readdirSync(ANAMED, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(ANAMED, cat.name))) {
      if (f.toLowerCase().endsWith(".pdf")) set.add(f.toLowerCase());
    }
  }
  return set;
}

// Lo que el corpus ya tiene indexado, visto desde el propio corpus.jsonl.
//
// Antes esta revisión solo miraba los PDF en disco, así que toda norma que el
// ISP enlaza a BCN/LeyChile quedaba "pendiente" para siempre, aunque el
// pipeline ya la hubiera incorporado por otra vía (el Código Sanitario desde el
// XML de BCN, el DS 3 y el DE 945 desde su ficha). pendientes.md decía que el
// cerebro no podía responder sobre normas que sí respondía.
//
// Se identifica la norma por el idNorma de LeyChile (estable, no depende de si
// el listado dice "Decreto Exento" y el texto "DFL") y los PDF por nombre de
// archivo. Solo se leen metadatos de cada fila, nunca el texto legal.
function idNormaBCN(u) {
  const m = String(u || "").match(/[?&]idNorma=([0-9]+)/i);
  return m ? m[1] : null;
}

function coberturaCorpus() {
  const idNormas = new Set();
  const pdfs = new Set();
  const archivo = path.join(CORPUS, "corpus.jsonl");
  if (!fs.existsSync(archivo)) return { idNormas, pdfs, disponible: false };
  const lineas = fs.readFileSync(archivo, "utf-8").split("\n");
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    let fila;
    try {
      fila = JSON.parse(linea);
    } catch (e) {
      continue;
    }
    const id = idNormaBCN(fila.fuente_url);
    if (id) idNormas.add(id);
    for (const u of [fila.fuente_url, fila.pdf_path]) {
      const base = urlBasename(u);
      if (base.endsWith(".pdf")) pdfs.add(base);
    }
  }
  return { idNormas, pdfs, disponible: true };
}

function detectarFaltantes(records) {
  const disco = pdfsEnDisco();
  const corpus = coberturaCorpus();
  const vistos = new Set();
  const faltantes = [];

  for (const r of records) {
    const k = claveNorma(r);
    if (vistos.has(k)) continue;
    vistos.add(k);

    const base = urlBasename(r.enlace);
    if (base.endsWith(".pdf")) {
      if (disco.has(base) || corpus.pdfs.has(base)) continue;
      faltantes.push({
        clave: k,
        tipo: r.tipo,
        numero: r.numero,
        categoria: r.categoria,
        descripcion: r.descripcion,
        enlace: r.enlace,
        archivo_esperado: base,
        motivo: "PDF publicado por el ISP que no está en disco (descarga pendiente o fallida)",
        recuperable: true,
      });
    } else {
      const id = idNormaBCN(r.enlace);
      if (id && corpus.idNormas.has(id)) continue;
      faltantes.push({
        clave: k,
        tipo: r.tipo,
        numero: r.numero,
        categoria: r.categoria,
        descripcion: r.descripcion,
        enlace: r.enlace,
        archivo_esperado: null,
        motivo: "El ISP enlaza a BCN/LeyChile (página web), no publica PDF, y el texto aún no está en el corpus",
        recuperable: false,
      });
    }
  }
  return faltantes;
}

// --- 3. Salud del corpus y del pipeline ---------------------------------------

function saludCorpus(records) {
  const meta = leerJSON(F.metadata);
  const historial = leerJSON(F.historial, []);
  const ultimaCorrida = historial.length ? historial[historial.length - 1] : null;

  let ultimoLog = null;
  try {
    const logs = fs.readdirSync(F.logs).filter((f) => f.startsWith("actualizacion-")).sort();
    ultimoLog = logs.length ? logs[logs.length - 1] : null;
  } catch (e) {}

  let gate = null;
  if (ultimoLog) {
    const txt = fs.readFileSync(path.join(F.logs, ultimoLog), "utf-8");
    const m = txt.match(/recall@5:\s*([^\n]+)/);
    gate = {
      log: ultimoLog,
      linea: m ? m[1].trim() : null,
      aprobada: /compuerta aprobada/i.test(txt),
      reprobada: /compuerta reprobada|no publica|abortad/i.test(txt),
    };
  }

  const docs = (meta && meta.documentos) || [];
  const noVerificada = docs.filter((d) => d.vigencia !== "vigente").map((d) => ({
    doc_id: d.doc_id,
    vigencia: d.vigencia,
  }));
  const conAlertasOCR = docs.filter((d) => (d.chunks_con_alerta_ocr || 0) > 0).length;

  return {
    snapshot_fetched_at: (leerJSON(F.snapshotISP) || {}).fetchedAt || null,
    dias_desde_snapshot: diasDesde((leerJSON(F.snapshotISP) || {}).fetchedAt),
    corpus_generado: meta ? meta.generado : null,
    dias_desde_corpus: diasDesde(meta ? meta.generado : null),
    documentos_indexados: docs.length,
    normas_listado_oficial: meta ? meta.normas_listado_oficial : null,
    normas_en_snapshot: records.length,
    vigencia_no_verificada: noVerificada,
    documentos_con_alertas_ocr: conAlertasOCR,
    ultima_corrida_pipeline: ultimaCorrida,
    dias_desde_pipeline: ultimaCorrida ? diasDesde(ultimaCorrida.timestamp) : null,
    gate,
  };
}

function alertas(salud, faltantes) {
  const out = [];
  if (salud.dias_desde_snapshot === null) {
    out.push({ nivel: "critico", texto: "No hay snapshot del listado oficial: la vigilancia nunca corrió o el archivo desapareció." });
  } else if (salud.dias_desde_snapshot >= 7) {
    out.push({
      nivel: "critico",
      texto: `El listado oficial no se refresca hace ${salud.dias_desde_snapshot} días. El workflow "Corpus diario" de GitHub Actions no está corriendo o falla: revisar la pestaña Actions del repo. El corpus se ve sano pero está envejeciendo en silencio.`,
    });
  } else if (salud.dias_desde_snapshot > 3) {
    out.push({ nivel: "aviso", texto: `Último scrape del ISP hace ${salud.dias_desde_snapshot} días.` });
  }

  if (salud.dias_desde_corpus !== null && salud.dias_desde_snapshot !== null && salud.dias_desde_corpus - salud.dias_desde_snapshot > 2) {
    out.push({ nivel: "aviso", texto: "El corpus es más viejo que el snapshot: hubo scrapes que no llegaron a reconstruir el índice." });
  }

  if (salud.gate && salud.gate.reprobada) {
    out.push({ nivel: "critico", texto: `La compuerta de calidad reprobó en ${salud.gate.log}: no se publicó. Revisar eval_retrieval.py.` });
  }

  const recuperables = faltantes.filter((f) => f.recuperable);
  if (recuperables.length) {
    out.push({
      nivel: "aviso",
      texto: `${recuperables.length} norma(s) con PDF publicado por el ISP siguen sin descargar. Son recuperables: ver pendientes.md.`,
    });
  }

  if (salud.vigencia_no_verificada.length) {
    out.push({
      nivel: "info",
      texto: `${salud.vigencia_no_verificada.length} documento(s) indexado(s) sin vigencia certificada por el listado oficial.`,
    });
  }
  return out;
}

// --- Escritura ----------------------------------------------------------------

function appendJSONL(entradas) {
  if (DRY || !entradas.length) return;
  fs.appendFileSync(F.cambios, entradas.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf-8");
}

function historialPendiente(clave) {
  // ¿Desde cuándo está pendiente? Se busca la primera vez que se registró.
  try {
    const lineas = fs.readFileSync(F.cambios, "utf-8").trim().split("\n").filter(Boolean);
    for (const l of lineas) {
      const e = JSON.parse(l);
      if (e.tipo_evento === "pendiente" && e.clave === clave) return e.fecha;
    }
  } catch (err) {}
  return HOY;
}

function escribirPendientes(faltantes, desde) {
  const recuperables = faltantes.filter((f) => f.recuperable);
  const noPublicadas = faltantes.filter((f) => !f.recuperable);
  const reintentos = leerJSON(F.reintentos);

  let md = `# Normativa pendiente — no disponible en el corpus\n\n`;
  md += `> Regenerado el ${HOY} por \`revisar-semanal.js\`. **No es fuente normativa.**\n\n`;
  md += `El Cerebro Regulatorio **no puede responder** sobre estas normas: están en el\n`;
  md += `listado oficial del ISP pero su texto no está indexado. Si una consulta toca\n`;
  md += `estas materias, la respuesta correcta es declarar la ausencia, no aproximar.\n\n`;

  md += `## Recuperables (${recuperables.length}) — el ISP publica el PDF\n\n`;
  if (!recuperables.length) {
    md += `Ninguna. Todo lo que el ISP publica como PDF está en disco.\n\n`;
  } else {
    md += `| Norma | Categoría | Pendiente desde | Motivo |\n|---|---|---|---|\n`;
    for (const f of recuperables) {
      md += `| ${f.tipo} ${f.numero} | ${f.categoria} | ${desde[f.clave] || HOY} | ${f.motivo} |\n`;
    }
    md += `\n`;
    for (const f of recuperables) {
      md += `- **${f.tipo} ${f.numero}** — ${f.descripcion}\n  - Enlace: ${f.enlace}\n  - Archivo esperado: \`${f.archivo_esperado}\`\n`;
      const r = reintentos && reintentos.resultados && reintentos.resultados[f.clave];
      if (r) md += `  - Último reintento (${reintentos.fecha}): ${r.ok ? "descargado ✅" : `falló — ${r.error}`}\n`;
    }
    md += `\n`;
  }

  md += `## Sin PDF publicado (${noPublicadas.length}) — el ISP enlaza a BCN/LeyChile\n\n`;
  if (!noPublicadas.length) {
    md += `Ninguna.\n\n`;
  } else {
    md += `Estas normas no tienen archivo que descargar: el listado apunta a la ficha web\n`;
    md += `de LeyChile. Incorporarlas exige una decisión manual sobre la fuente del texto,\n`;
    md += `porque un texto que no viene del ISP no puede heredar la vigencia que certifica\n`;
    md += `el listado oficial de ANAMED.\n\n`;
    md += `| Norma | Categoría | Pendiente desde | Enlace |\n|---|---|---|---|\n`;
    for (const f of noPublicadas) {
      md += `| ${f.tipo} ${f.numero} | ${f.categoria} | ${desde[f.clave] || HOY} | ${f.enlace} |\n`;
    }
    md += `\n`;
  }

  if (!DRY) fs.writeFileSync(F.pendientes, md, "utf-8");
  return md;
}

function escribirInforme(diff, faltantes, salud, avisos, esBaseline, desde) {
  const sem = semanaISO(AHORA);
  const dest = path.join(F.informes, `${sem}.md`);

  let md = `# Revisión regulatoria semanal — ${sem}\n\n`;
  md += `_Ejecutada el ${HOY}. Fuente: listado oficial ANAMED del ISP, snapshot del ${(salud.snapshot_fetched_at || "").slice(0, 10) || "—"}._\n\n`;

  if (esBaseline) {
    md += `## Línea base\n\nPrimera revisión: se estableció la referencia con ${salud.normas_en_snapshot} filas del listado oficial. Los cambios se detectan desde la próxima revisión.\n\n`;
  }

  if (avisos.length) {
    md += `## Alertas\n\n`;
    for (const a of avisos) {
      const icono = a.nivel === "critico" ? "🔴" : a.nivel === "aviso" ? "🟡" : "🔵";
      md += `- ${icono} ${a.texto}\n`;
    }
    md += `\n`;
  } else {
    md += `## Alertas\n\nNinguna. Vigilancia al día y compuerta de calidad aprobada.\n\n`;
  }

  md += `## Cambios en el listado oficial\n\n`;
  if (!esBaseline && !diff.nuevas.length && !diff.modificadas.length && !diff.eliminadas.length) {
    md += `Sin cambios desde la revisión anterior.\n\n`;
  }

  if (diff.nuevas.length) {
    md += `### Nuevas (${diff.nuevas.length})\n\n`;
    for (const r of diff.nuevas) {
      md += `- **${r.tipo} ${r.numero}** (${r.categoria}, ${r.fecha}) — ${r.descripcion}\n  - ${r.enlace}\n`;
    }
    md += `\n`;
  }

  if (diff.modificadas.length) {
    md += `### Modificadas (${diff.modificadas.length})\n\n`;
    for (const m of diff.modificadas) {
      md += `- **${m.despues.tipo} ${m.despues.numero}** (${m.despues.categoria})\n`;
      for (const [campo, v] of Object.entries(m.campos)) {
        md += `  - \`${campo}\`: «${v.antes || "—"}» → «${v.despues || "—"}»\n`;
      }
    }
    md += `\n`;
  }

  if (diff.eliminadas.length) {
    md += `### Ya no aparecen en el listado (${diff.eliminadas.length})\n\n`;
    md += `⚠️ Una norma que sale del listado **no** queda automáticamente derogada, pero su\n`;
    md += `vigencia deja de estar certificada por el ISP. Revisar antes de seguir citándola.\n\n`;
    for (const r of diff.eliminadas) {
      md += `- **${r.tipo} ${r.numero}** (${r.categoria}) — ${r.descripcion}\n`;
    }
    md += `\n`;
  }

  md += `## Estado del corpus\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| Filas en el listado oficial | ${salud.normas_en_snapshot} |\n`;
  md += `| Normas únicas del listado | ${salud.normas_listado_oficial ?? "—"} |\n`;
  md += `| Documentos indexados | ${salud.documentos_indexados} |\n`;
  md += `| Normativa pendiente (sin indexar) | ${faltantes.length} — ${faltantes.filter((f) => f.recuperable).length} recuperable(s) |\n`;
  md += `| Sin vigencia certificada | ${salud.vigencia_no_verificada.length} |\n`;
  md += `| Documentos con alertas de OCR | ${salud.documentos_con_alertas_ocr} |\n`;
  md += `| Corpus reconstruido | ${salud.corpus_generado || "—"} (hace ${salud.dias_desde_corpus ?? "—"} días) |\n`;
  md += `| Último scrape del ISP | ${(salud.snapshot_fetched_at || "—").slice(0, 10)} (hace ${salud.dias_desde_snapshot ?? "—"} días) |\n`;
  md += `| Compuerta de calidad | ${salud.gate ? (salud.gate.linea || (salud.gate.aprobada ? "aprobada" : "—")) : "—"} |\n\n`;

  if (faltantes.length) {
    md += `## Normativa pendiente\n\nDetalle completo y antigüedad en [pendientes.md](../pendientes.md).\n\n`;
    for (const f of faltantes) {
      md += `- ${f.recuperable ? "🟡" : "⬜"} **${f.tipo} ${f.numero}** (${f.categoria}) — pendiente desde ${desde[f.clave] || HOY}. ${f.motivo}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n_Este informe describe metadatos del listado oficial. No contiene texto legal citable y no forma parte del corpus del Cerebro Regulatorio._\n`;

  if (!DRY) fs.writeFileSync(dest, md, "utf-8");
  return { dest, md, sem };
}

// --- Main ---------------------------------------------------------------------

function main() {
  const snapshot = leerJSON(F.snapshotISP);
  if (!snapshot || !Array.isArray(snapshot.records) || snapshot.records.length < 50) {
    console.error("[error] Snapshot del listado oficial ausente o sospechosamente corto. Se aborta sin tocar nada.");
    console.log(JSON.stringify({ ok: false, motivo: "snapshot_invalido" }));
    process.exit(1);
  }

  const referencia = leerJSON(F.referencia);
  const esBaseline = !referencia;
  const diff = esBaseline
    ? { nuevas: [], modificadas: [], eliminadas: [] }
    : diffListado(referencia.records, snapshot.records);

  const faltantes = detectarFaltantes(snapshot.records);
  const salud = saludCorpus(snapshot.records);
  const avisos = alertas(salud, faltantes);

  // ¿Desde cuándo está pendiente cada faltante? (primera aparición en el JSONL)
  const desde = {};
  for (const f of faltantes) desde[f.clave] = historialPendiente(f.clave);

  // --- Registro append-only ---
  const entradas = [];
  const revisionId = `${HOY}-${semanaISO(AHORA)}`;

  for (const r of diff.nuevas) {
    entradas.push({
      tipo_evento: "norma_nueva", fecha: HOY, revision: revisionId, clave: claveNorma(r),
      norma: `${r.tipo} ${r.numero}`, categoria: r.categoria, descripcion: r.descripcion,
      fecha_norma: r.fecha, enlace: r.enlace,
    });
  }
  for (const m of diff.modificadas) {
    entradas.push({
      tipo_evento: "norma_modificada", fecha: HOY, revision: revisionId, clave: m.clave,
      norma: `${m.despues.tipo} ${m.despues.numero}`, categoria: m.despues.categoria,
      campos: m.campos,
    });
  }
  for (const r of diff.eliminadas) {
    entradas.push({
      tipo_evento: "norma_fuera_del_listado", fecha: HOY, revision: revisionId, clave: claveNorma(r),
      norma: `${r.tipo} ${r.numero}`, categoria: r.categoria, descripcion: r.descripcion,
      nota: "Salió del listado oficial: su vigencia deja de estar certificada por el ISP.",
    });
  }
  for (const f of faltantes) {
    if (desde[f.clave] === HOY) {
      entradas.push({
        tipo_evento: "pendiente", fecha: HOY, revision: revisionId, clave: f.clave,
        norma: `${f.tipo} ${f.numero}`, categoria: f.categoria, enlace: f.enlace,
        motivo: f.motivo, recuperable: f.recuperable,
      });
    }
  }
  entradas.push({
    tipo_evento: "revision", fecha: HOY, revision: revisionId,
    baseline: esBaseline,
    totales: {
      filas_listado: snapshot.records.length,
      nuevas: diff.nuevas.length,
      modificadas: diff.modificadas.length,
      eliminadas: diff.eliminadas.length,
      pendientes: faltantes.length,
      documentos_indexados: salud.documentos_indexados,
    },
    snapshot_fetched_at: salud.snapshot_fetched_at,
    corpus_generado: salud.corpus_generado,
    alertas: avisos,
  });

  appendJSONL(entradas);
  escribirPendientes(faltantes, desde);
  const informe = escribirInforme(diff, faltantes, salud, avisos, esBaseline, desde);

  if (!DRY) {
    fs.writeFileSync(
      F.referencia,
      JSON.stringify(
        { revisadoEl: HOY, fetchedAt: snapshot.fetchedAt, contentHash: snapshot.contentHash, total: snapshot.total, records: snapshot.records },
        null, 2
      ),
      "utf-8"
    );
  }

  // Resumen legible por máquina para la tarea programada.
  console.log(JSON.stringify({
    ok: true,
    dry_run: DRY,
    revision: revisionId,
    semana: informe.sem,
    baseline: esBaseline,
    informe: path.relative(REG_DIR, informe.dest),
    cambios: {
      nuevas: diff.nuevas.map((r) => `${r.tipo} ${r.numero} — ${r.descripcion}`),
      modificadas: diff.modificadas.map((m) => ({ norma: `${m.despues.tipo} ${m.despues.numero}`, campos: Object.keys(m.campos) })),
      eliminadas: diff.eliminadas.map((r) => `${r.tipo} ${r.numero}`),
    },
    pendientes: faltantes.map((f) => ({ norma: `${f.tipo} ${f.numero}`, categoria: f.categoria, recuperable: f.recuperable, desde: desde[f.clave] })),
    salud,
    alertas: avisos,
  }, null, 2));
}

main();
