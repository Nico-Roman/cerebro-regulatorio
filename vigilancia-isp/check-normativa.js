#!/usr/bin/env node
/**
 * Vigilancia de la Normativa ANAMED del ISP (https://www.ispch.gob.cl/normativa-anamed/)
 *
 * Uso:  node check-normativa.js
 *
 * Cada ejecución:
 *   1. Descarga la página oficial (vía curl, con user-agent de navegador).
 *   2. Parsea las 8 tablas de normativa a registros estructurados.
 *   3. Compara contra el último snapshot (snapshots/latest.json) y detecta
 *      normas nuevas, modificadas (a nivel de campo) y eliminadas.
 *   4. Guarda el snapshot, actualiza historial.json y regenera dashboard.html.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const URL = 'https://www.ispch.gob.cl/normativa-anamed/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BASE = __dirname;
const SNAP_DIR = path.join(BASE, 'snapshots');
const LATEST = path.join(SNAP_DIR, 'latest.json');
const HISTORIAL = path.join(BASE, 'historial.json');
const TEMPLATE = path.join(BASE, 'template.html');
const DASHBOARD = path.join(BASE, 'dashboard.html');
const MIN_RECORDS = 50; // si el parseo entrega menos, algo cambió en el sitio: abortar sin pisar datos

// ---------- descarga ----------
function fetchHtml() {
  return execFileSync('curl', ['-s', '--max-time', '120', '-A', UA, URL], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

// ---------- parseo ----------
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#8220;': '“', '&#8221;': '”', '&#8216;': '‘', '&#8217;': '’', '&#8211;': '–', '&#8212;': '—', '&#039;': "'", '&#176;': '°', '&#186;': 'º' };

function cleanText(html) {
  let t = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  for (const [k, v] of Object.entries(ENTITIES)) t = t.split(k).join(v);
  return t.replace(/\s+/g, ' ').trim();
}

function absUrl(href) {
  if (!href) return '';
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return 'https://www.ispch.gob.cl' + href;
  return href;
}

function parsePage(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const records = [];
  for (const table of tables) {
    const catMatch = table.match(/<thead[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    const categoria = catMatch ? cleanText(catMatch[1]) : 'Sin categoría';
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      if (/<th[\s>]/i.test(row)) continue; // fila de título de categoría
      const cells = row.match(/<td[\s\S]*?<\/td>/gi) || [];
      if (cells.length < 5) continue;
      const texts = cells.map(cleanText);
      if (/^materia$/i.test(texts[0])) continue; // fila de encabezados de columna
      const hrefMatch = row.match(/href="([^"]+)"/i);
      // la columna "Modificaciones" es la última celda sin enlace
      let modificaciones = '';
      for (let i = cells.length - 1; i >= 5; i--) {
        if (!/href=/i.test(cells[i])) { modificaciones = texts[i]; break; }
      }
      records.push({
        categoria,
        materia: texts[0] || '',
        tipo: texts[1] || '',
        numero: texts[2] || '',
        descripcion: texts[3] || '',
        fecha: texts[4] || '',
        enlace: absUrl(hrefMatch ? hrefMatch[1] : ''),
        modificaciones,
      });
    }
  }
  return records;
}

// ---------- diff ----------
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[“”‘’"']/g, '').replace(/\s+/g, ' ').trim();
}
const shortKey = (r) => [norm(r.categoria), norm(r.tipo), norm(r.numero)].join('|');
const fullKey = (r) => shortKey(r) + '|' + norm(r.descripcion).slice(0, 80);
const CAMPOS = ['descripcion', 'fecha', 'enlace', 'modificaciones'];

function fieldDiff(a, b) {
  return CAMPOS.filter((c) => (a[c] || '') !== (b[c] || ''));
}

function computeDiff(oldRecs, newRecs) {
  const nuevas = [], modificadas = [], eliminadas = [];
  const oldLeft = [...oldRecs], newLeft = [...newRecs];

  // pasada 1: match exacto por clave completa (cat+tipo+número+descripción)
  const oldByFull = new Map();
  for (const r of oldLeft) {
    const k = fullKey(r);
    if (!oldByFull.has(k)) oldByFull.set(k, []);
    oldByFull.get(k).push(r);
  }
  const newUnmatched = [];
  for (const n of newLeft) {
    const bucket = oldByFull.get(fullKey(n));
    if (bucket && bucket.length) {
      const o = bucket.shift();
      o._matched = true;
      const cambios = fieldDiff(o, n);
      if (cambios.length) modificadas.push({ antes: o, despues: n, campos: cambios });
    } else {
      newUnmatched.push(n);
    }
  }
  // pasada 2: match por clave corta (cat+tipo+número) — descripción editada
  const oldRest = oldLeft.filter((r) => !r._matched);
  const oldByShort = new Map();
  for (const r of oldRest) {
    const k = shortKey(r);
    if (!oldByShort.has(k)) oldByShort.set(k, []);
    oldByShort.get(k).push(r);
  }
  for (const n of newUnmatched) {
    const bucket = oldByShort.get(shortKey(n));
    if (bucket && bucket.length) {
      const o = bucket.shift();
      o._matched = true;
      modificadas.push({ antes: o, despues: n, campos: fieldDiff(o, n) });
    } else {
      nuevas.push(n);
    }
  }
  for (const r of oldRest) if (!r._matched) eliminadas.push(r);
  for (const r of oldLeft) delete r._matched;
  return { nuevas, modificadas, eliminadas };
}

// ---------- main ----------
function run() {
  const ahora = new Date().toISOString();
  console.log(`[${ahora}] Descargando ${URL} ...`);
  const html = fetchHtml();
  const records = parsePage(html);
  console.log(`Registros parseados: ${records.length}`);
  if (records.length < MIN_RECORDS) {
    throw new Error(`solo ${records.length} registros (< ${MIN_RECORDS}). ` +
      'La estructura del sitio pudo haber cambiado o la descarga falló. No se actualiza nada.');
  }

  const contentHash = crypto.createHash('sha256')
    .update(JSON.stringify(records.map((r) => fullKey(r) + '|' + r.fecha + '|' + r.enlace + '|' + r.modificaciones)))
    .digest('hex');

  fs.mkdirSync(SNAP_DIR, { recursive: true });
  let prev = null;
  if (fs.existsSync(LATEST)) prev = JSON.parse(fs.readFileSync(LATEST, 'utf8'));

  const baseline = !prev;
  const diff = prev ? computeDiff(prev.records, records) : { nuevas: [], modificadas: [], eliminadas: [] };
  const nCambios = diff.nuevas.length + diff.modificadas.length + diff.eliminadas.length;

  const snapshot = { fetchedAt: ahora, sourceUrl: URL, contentHash, total: records.length, records };

  // snapshot con timestamp solo cuando hay cambios (o es la línea base); latest.json siempre
  if (baseline || nCambios > 0) {
    const stamp = ahora.replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(path.join(SNAP_DIR, `snapshot-${stamp}.json`), JSON.stringify(snapshot, null, 2));
  }
  fs.writeFileSync(LATEST, JSON.stringify(snapshot, null, 2));

  let historial = [];
  if (fs.existsSync(HISTORIAL)) historial = JSON.parse(fs.readFileSync(HISTORIAL, 'utf8'));
  historial.push({
    timestamp: ahora,
    total: records.length,
    nuevas: diff.nuevas.length,
    modificadas: diff.modificadas.length,
    eliminadas: diff.eliminadas.length,
    baseline,
    contentHash,
  });
  if (historial.length > 500) historial = historial.slice(-500);
  fs.writeFileSync(HISTORIAL, JSON.stringify(historial, null, 2));

  // diff de la corrida actual, para que otros procesos (pipeline diario) sepan
  // qué normas nuevas/modificadas requieren descarga de PDF sin tener que
  // recalcularlo comparando snapshots a mano.
  fs.writeFileSync(path.join(SNAP_DIR, 'last-diff.json'), JSON.stringify({ fetchedAt: ahora, baseline, ...diff }, null, 2));

  // dashboard
  const payload = {
    generadoEl: ahora,
    fuente: URL,
    baseline,
    prevFetchedAt: prev ? prev.fetchedAt : null,
    registros: records,
    diff,
    historial,
  };
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const dashboard = template.replace('/*__DATA__*/null', () => JSON.stringify(payload));
  fs.writeFileSync(DASHBOARD, dashboard);

  console.log(baseline
    ? `Línea base establecida: ${records.length} normas.`
    : nCambios === 0
      ? 'Sin cambios desde la última revisión.'
      : `CAMBIOS: +${diff.nuevas.length} nuevas, ~${diff.modificadas.length} modificadas, -${diff.eliminadas.length} eliminadas.`);
  console.log(`Dashboard: ${DASHBOARD}`);

  return { baseline, diff, records, total: records.length };
}

module.exports = { run };

if (require.main === module) {
  run();
}
