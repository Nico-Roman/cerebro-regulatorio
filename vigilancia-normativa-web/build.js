#!/usr/bin/env node
/**
 * Genera un sitio de varias páginas que combina:
 *  1. Vigilancia de cambios ISP/ANAMED (vigilancia-isp/snapshots/latest.json vía dashboard.html)
 *  2. Repositorio local de normativa descargada y catalogada (163 PDFs / normas,
 *     catalogadas en Obsidian Vault > Asuntos Regulatorios > Normativa ANAMED)
 *
 * Páginas generadas:
 *   index.html        — portada: KPIs + panorama por categoría + accesos a cada área
 *   cambios.html       — detalle de cambios detectados (nuevas / modificadas / eliminadas)
 *   repositorio.html   — explorador buscable del repositorio de normativa (163 documentos)
 *   historial.html     — historial de revisiones del monitoreo
 *
 * Uso: node build.js
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const VIGILANCIA_DIR = path.join(BASE, '..', 'vigilancia-isp');
const VAULT_CAT_DIR = path.join(
  BASE, '..', '..', '..', 'Obsidian Vault', 'Asuntos Regulatorios', 'Normativa ANAMED'
);

// ============================================================
// 1. datos de vigilancia (cambios) — reutiliza el DATA ya calculado
//    por check-normativa.js en vez de reimplementar el diff aquí.
// ============================================================
const dashboardHtml = fs.readFileSync(path.join(VIGILANCIA_DIR, 'dashboard.html'), 'utf8');
const dataMatch = dashboardHtml.match(/const DATA = (\{[\s\S]*?\});\n/);
if (!dataMatch) throw new Error('No se pudo extraer DATA de vigilancia-isp/dashboard.html');
const V = JSON.parse(dataMatch[1]);

// ============================================================
// 2. repositorio local (parsear notas Obsidian)
// ============================================================
const NOTAS = [
  'ANAMED — Medicamentos.md',
  'ANAMED — Cosméticos.md',
  'ANAMED — Establecimientos, Autorización y Fiscalización.md',
  'ANAMED — Importación y Exportación.md',
  'ANAMED — Laboratorio Nacional de Control.md',
  'ANAMED — Farmacovigilancia.md',
  'ANAMED — Ensayos Clínicos.md',
  'ANAMED — Otros y Guías Técnicas.md',
];

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function parseCategoria(md) {
  const m = md.match(/^categoria:\s*(.+)$/m);
  return m ? m[1].trim() : 'Sin categoría';
}
function splitNorma(normaTxt) {
  const parts = normaTxt.trim().split(/\s+/);
  const numero = parts.pop();
  return { tipo: parts.join(' '), numero };
}
function parseLinks(cell) {
  const links = {};
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(cell))) {
    const label = m[1].toLowerCase();
    if (label === 'pdf') links.pdf = m[2];
    else if (label.includes('ocr')) links.ocr = m[2];
    else if (label === 'fuente') links.fuente = m[2];
  }
  return links;
}
function fileUrlToRelative(fileUrl) {
  if (!fileUrl) return null;
  try {
    let p = decodeURIComponent(fileUrl.replace(/^file:\/\/\//, ''));
    p = p.replace(/\//g, path.sep);
    return path.relative(BASE, p).split(path.sep).join('/');
  } catch {
    return null;
  }
}
function parseNota(file) {
  const md = fs.readFileSync(path.join(VAULT_CAT_DIR, file), 'utf8');
  const categoria = parseCategoria(md);
  const registros = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    if (cells[0] === 'Norma' || /^-+$/.test(cells[0])) continue;
    const { tipo, numero } = splitNorma(cells[0]);
    const links = parseLinks(cells[4]);
    const categoriaFila = (cells[5] && cells[5].trim()) || categoria;
    registros.push({
      categoria: categoriaFila,
      tipo,
      numero,
      descripcion: cells[1],
      fecha: cells[2],
      ultMod: cells[3],
      pdfLocal: fileUrlToRelative(links.pdf),
      ocrLocal: fileUrlToRelative(links.ocr),
      fuente: links.fuente || null,
    });
  }
  return registros;
}

let repoRegistros = [];
for (const nota of NOTAS) repoRegistros = repoRegistros.concat(parseNota(nota));
console.log(`Repositorio local: ${repoRegistros.length} filas parseadas de ${NOTAS.length} notas.`);

const R = {
  fuente: 'https://www.ispch.gob.cl/normativa-anamed/',
  total: repoRegistros.length,
  normasUnicas: new Set(repoRegistros.map((r) => norm(r.categoria) + '|' + norm(r.tipo) + '|' + norm(r.numero))).size,
  registros: repoRegistros,
};

// ============================================================
// 3. agregados para la portada (solo conteos, no filas completas)
// ============================================================
function cuenta(arr, fn) {
  const m = new Map();
  for (const r of arr) { const k = fn(r); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const nCambios = V.diff.nuevas.length + V.diff.modificadas.length + V.diff.eliminadas.length;
const conDoc = R.registros.filter((r) => r.pdfLocal).length;

const resumen = {
  generadoEl: V.generadoEl,
  prevFetchedAt: V.prevFetchedAt,
  baseline: V.baseline,
  fuente: V.fuente,
  totalVigiladas: V.registros.length,
  nCambios,
  totalRepo: R.total,
  normasUnicas: R.normasUnicas,
  conDoc,
  nRevisiones: V.historial.length,
  categoriasV: cuenta(V.registros, (r) => r.categoria),
  categoriasR: cuenta(R.registros, (r) => r.categoria),
};

// ============================================================
// 4. layout compartido (CSS + header + nav + helpers JS)
// ============================================================
const CSS = `
  :root {
    --page: #f4f5f2; --surface: #ffffff; --ink: #0b0b0b; --ink-2: #52514e;
    --muted: #898781; --grid: #e1e0d9; --baseline: #c3c2b7; --border: rgba(11,11,11,0.10);
    --blue: #2a78d6; --blue-soft: #cde2fb; --aqua: #1baf7a; --good: #0ca30c; --good-text: #006300;
    --warning: #fab219; --critical: #d03b3b; --shadow: 0 1px 2px rgba(11,11,11,0.05), 0 1px 1px rgba(11,11,11,0.03);
    --navy: #0b2038; --navy-2: #12305a; --navy-ring: rgba(255,255,255,0.14);
    --gold: #b9872f; --gold-soft: #f3e4c8; --gold-text: #8a6a1f;
    --serif: Georgia, Cambria, "Times New Roman", Times, serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
      --muted: #898781; --grid: #2c2c2a; --baseline: #383835; --border: rgba(255,255,255,0.10);
      --blue: #3987e5; --blue-soft: #184f95; --aqua: #199e70; --good-text: #0ca30c; --shadow: none;
      --gold-text: #e0b563;
    }
  }
  :root[data-theme="light"] {
    --page: #f4f5f2; --surface: #ffffff; --ink: #0b0b0b; --ink-2: #52514e;
    --muted: #898781; --grid: #e1e0d9; --baseline: #c3c2b7; --border: rgba(11,11,11,0.10);
    --blue: #2a78d6; --blue-soft: #cde2fb; --aqua: #1baf7a; --good-text: #006300;
    --shadow: 0 1px 2px rgba(11,11,11,0.05), 0 1px 1px rgba(11,11,11,0.03);
    --gold-text: #8a6a1f;
  }
  :root[data-theme="dark"] {
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --baseline: #383835; --border: rgba(255,255,255,0.10);
    --blue: #3987e5; --blue-soft: #184f95; --aqua: #199e70; --good-text: #0ca30c; --shadow: none;
    --gold-text: #e0b563;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--page); color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.5; }
  a { color: var(--blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
  main.wrap { padding: 26px 20px 60px; }

  /* ---------- masthead (institucional, siempre navy) ---------- */
  .masthead { background: var(--navy); color: #eef2f7; }
  .mh-strip { background: #081729; border-bottom: 1px solid var(--navy-ring); }
  .mh-strip .wrap { padding: 7px 20px; font-size: 12px; color: #a9bcd6; display: flex; align-items: center; gap: 7px; letter-spacing: 0.01em; }
  .mh-strip .diamond { color: var(--gold); font-size: 10px; }
  .mh-brand .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 20px 14px; }
  .brand { display: flex; align-items: center; gap: 12px; color: #fff; }
  .brand:hover { text-decoration: none; }
  .seal { flex: none; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: var(--gold); }
  .seal svg { width: 100%; height: 100%; }
  .brand-text { display: flex; flex-direction: column; gap: 1px; }
  .brand-name { font-family: var(--serif); font-size: 21px; font-weight: 700; letter-spacing: 0.02em; line-height: 1; }
  .brand-tag { font-size: 11.5px; color: #a9bcd6; letter-spacing: 0.03em; }
  .sub-line { color: var(--ink-2); font-size: 12.5px; margin-bottom: 18px; }

  .header-right { display: flex; align-items: center; gap: 10px; }
  .badge {
    display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px;
    font-size: 12.5px; font-weight: 550; border: 1px solid var(--navy-ring); background: rgba(255,255,255,0.06); color: #eef2f7;
  }
  .badge .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  #themeBtn { border: 1px solid var(--navy-ring); background: rgba(255,255,255,0.06); color: #cfdaea; border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 13px; cursor: pointer; }
  #themeBtn:hover { color: #fff; background: rgba(255,255,255,0.12); }

  nav.tabs { background: var(--navy-2); border-top: 1px solid var(--navy-ring); }
  nav.tabs .wrap { display: flex; gap: 4px; }
  nav.tabs a { color: #c3d2e6; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; padding: 11px 16px; border-bottom: 2px solid transparent; }
  nav.tabs a:hover { color: #fff; text-decoration: none; }
  nav.tabs a.active { color: #fff; border-bottom-color: var(--gold); }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; box-shadow: var(--shadow); }
  section { margin-top: 26px; }
  .sec-title { font-family: var(--serif); font-size: 18px; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.003em; }
  .sec-sub { color: var(--muted); font-size: 12.5px; margin-bottom: 14px; }
  .eyebrow { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-text); margin-bottom: 2px; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
  .tile { position: relative; border-top: 3px solid var(--border); }
  .tile .tile-head { display: flex; align-items: center; justify-content: space-between; }
  .tile .icon { color: var(--muted); opacity: 0.85; flex: none; }
  .tile .icon svg { width: 18px; height: 18px; display: block; }
  .tile .label { font-size: 12px; color: var(--ink-2); font-weight: 600; }
  .tile .value { font-family: var(--serif); font-size: 30px; font-weight: 700; margin-top: 6px; letter-spacing: -0.01em; }
  .tile .note { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .tile.status { border-top-color: var(--warning); }
  .tile.status.ok { border-top-color: var(--good); }
  .tile.status .value { display: flex; align-items: center; gap: 8px; }
  .tile.status .dot { width: 10px; height: 10px; border-radius: 50%; }
  .tile.accent-blue { border-top-color: var(--blue); }
  .tile.accent-aqua { border-top-color: var(--aqua); }
  a.tile { display: block; transition: transform 0.12s ease, box-shadow 0.12s ease; }
  a.tile:hover { text-decoration: none; box-shadow: 0 4px 14px rgba(11,11,11,0.09); transform: translateY(-1px); }
  a.tile .go { font-size: 12px; color: var(--blue); margin-top: 10px; font-weight: 700; }

  .cambio-grupo { margin-top: 14px; }
  .cambio-grupo h3 { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 650; margin-bottom: 8px; }
  .cambio-grupo h3 .dot { width: 9px; height: 9px; border-radius: 50%; }
  .cambio { border: 1px solid var(--border); border-left-width: 3px; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; background: var(--surface); }
  .cambio .meta { font-size: 12px; color: var(--muted); }
  .cambio .desc { margin-top: 2px; }
  .cambio .campo { margin-top: 6px; font-size: 12.5px; }
  .cambio .campo .tag { color: var(--muted); }
  .cambio .antes { color: var(--ink-2); text-decoration: line-through; text-decoration-color: var(--baseline); }
  .cambio .flecha { color: var(--muted); padding: 0 4px; }
  .aviso { border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; color: var(--ink-2); font-size: 13.5px; background: var(--surface); }

  .charts2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 12px; }
  .hbar-row { display: flex; align-items: center; gap: 10px; margin: 7px 0; }
  .hbar-row .cat { flex: 0 0 210px; font-size: 12.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
  .hbar-row .track { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .hbar { height: 17px; border-radius: 0 4px 4px 0; cursor: default; min-width: 2px; }
  .hbar-row .val { font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; flex: none; }

  .filtros { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
  .filtros input, .filtros select {
    font: inherit; font-size: 13px; color: var(--ink); background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px;
  }
  .filtros input { flex: 1 1 220px; min-width: 180px; }
  .filtros input::placeholder { color: var(--muted); }
  .filtros label.chk { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); padding: 7px 4px; }
  .tbl-wrap { overflow: auto; max-height: 620px; border: 1px solid var(--border); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  thead th {
    position: sticky; top: 0; background: var(--surface); color: var(--muted); text-align: left; font-size: 11.5px;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 9px 12px;
    border-bottom: 1px solid var(--border); white-space: nowrap; z-index: 1;
  }
  tbody td { padding: 8px 12px; border-top: 1px solid var(--grid); vertical-align: top; }
  tbody tr:first-child td { border-top: none; }
  td.num, td.fch { font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.mod { color: var(--ink-2); white-space: nowrap; }
  td.docs { white-space: nowrap; }
  td.docs .sep { color: var(--muted); padding: 0 3px; }
  td.docs .na { color: var(--muted); }
  .conteo { color: var(--muted); font-size: 12.5px; margin: 8px 2px 0; }
  .hist td, .hist th { white-space: nowrap; }
  .hist .delta { font-variant-numeric: tabular-nums; }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--border); }
  .pill .dot { width: 7px; height: 7px; border-radius: 50%; }

  #tip {
    position: fixed; pointer-events: none; z-index: 50; display: none; background: var(--surface); color: var(--ink);
    border: 1px solid var(--border); border-radius: 8px; padding: 7px 11px; font-size: 12.5px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18); max-width: 340px;
  }
  #tip .t-title { font-weight: 600; }
  #tip .t-sub { color: var(--ink-2); }

  footer.site-footer { margin-top: 44px; background: var(--navy); color: #a9bcd6; }
  footer.site-footer .wrap { padding: 26px 20px 30px; }
  .footer-brand { display: flex; align-items: center; gap: 9px; color: #eef2f7; font-family: var(--serif); font-size: 14.5px; font-weight: 700; margin-bottom: 10px; }
  .footer-brand .seal { width: 20px; height: 20px; }
  footer.site-footer p { font-size: 12.5px; line-height: 1.7; max-width: 860px; }
  footer.site-footer code { background: rgba(255,255,255,0.08); border: 1px solid var(--navy-ring); border-radius: 5px; padding: 1px 6px; font-size: 12px; color: #dbe6f4; }
  footer.site-footer .disclaimer { margin-top: 10px; color: #7f93b0; font-size: 11.5px; }
`;

const SHARED_JS = `
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtFecha = (iso) => iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const tip = $('#tip');
function bindTip(el, html) {
  el.addEventListener('mouseenter', () => { tip.innerHTML = html; tip.style.display = 'block'; });
  el.addEventListener('mousemove', (e) => {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

(function themeSetup() {
  const btn = $('#themeBtn');
  const modes = ['auto', 'light', 'dark'];
  const labels = { auto: '◐ Auto', light: '○ Claro', dark: '● Oscuro' };
  let mode = localStorage.getItem('normativa-theme') || 'auto';
  function apply() {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    btn.textContent = labels[mode];
  }
  btn.addEventListener('click', () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    localStorage.setItem('normativa-theme', mode);
    apply();
  });
  apply();
})();

function hbars(el, pares, color, total) {
  const max = Math.max(...pares.map(([, v]) => v));
  el.innerHTML = pares.map(([k, v]) => \`
    <div class="hbar-row">
      <div class="cat" title="\${esc(k)}">\${esc(k)}</div>
      <div class="track"><div class="hbar" data-k="\${esc(k)}" data-v="\${v}" style="width:\${(v / max) * 100}%;background:\${color}"></div><span class="val">\${v}</span></div>
    </div>\`).join('');
  el.querySelectorAll('.hbar').forEach((b) => {
    const pct = ((Number(b.dataset.v) / total) * 100).toFixed(1);
    bindTip(b, \`<div class="t-title">\${esc(b.dataset.k)}</div><div class="t-sub">\${b.dataset.v} · \${pct}% del total</div>\`);
  });
}
`;

const NAV_ITEMS = [
  { id: 'inicio', href: 'index.html', label: 'Inicio' },
  { id: 'cambios', href: 'cambios.html', label: 'Cambios' },
  { id: 'repositorio', href: 'repositorio.html', label: 'Repositorio' },
  { id: 'historial', href: 'historial.html', label: 'Historial' },
];

const ICON_SEAL = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18.2" stroke="currentColor" stroke-width="1.3" opacity="0.55"/>
  <path d="M20 7.5l9.5 3.8v6.4c0 6.7-4.2 11-9.5 12.8-5.3-1.8-9.5-6.1-9.5-12.8v-6.4L20 7.5z" stroke="currentColor" stroke-width="1.5"/>
  <path d="M15.2 19.9l3.1 3.1 6.3-6.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const ICON_DOC = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="2.3" width="12" height="15.4" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M6.8 6.3h6.4M6.8 9.7h6.4M6.8 13.1h3.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
const ICON_PULSE = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.3 10.4h2.8l1.7-5.3 2.9 10.6 1.9-7.2 1.5 1.9h3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_FOLDER = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 5.9c0-.75.6-1.35 1.35-1.35h3.7l1.8 1.8h6.8c.75 0 1.35.6 1.35 1.35v6.4c0 .75-.6 1.35-1.35 1.35H3.85c-.75 0-1.35-.6-1.35-1.35V5.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.3"/><path d="M10 6.3v4l2.8 1.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function navHtml(active) {
  return `<nav class="tabs"><div class="wrap tabs-inner">` +
    NAV_ITEMS.map((n) => `<a href="${n.href}"${n.id === active ? ' class="active"' : ''}>${n.label}</a>`).join('') +
    `</div></nav>`;
}

function subFechasHtml() {
  return 'Vigilancia de <a href="' + resumen.fuente + '" target="_blank" rel="noopener">ispch.gob.cl/normativa-anamed</a>' +
    ' · Última revisión: <span id="ultimaRev"></span>' +
    (resumen.prevFetchedAt ? ' · Anterior: <span id="prevRev"></span>' : '');
}

function badgeHtml() {
  if (resumen.baseline) return '<span class="dot" style="background:var(--blue)"></span> Línea base establecida';
  if (resumen.nCambios > 0) return '<span class="dot" style="background:var(--warning)"></span> ' + resumen.nCambios + (resumen.nCambios === 1 ? ' cambio detectado' : ' cambios detectados');
  return '<span class="dot" style="background:var(--good)"></span> Sin cambios detectados';
}

function page({ title, active, dataVar = null, body, script }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · AARR — Vigilancia Regulatoria Farmacéutica</title>
<style>${CSS}</style>
</head>
<body>
<div class="masthead">
  <div class="mh-strip"><div class="wrap mh-strip-inner"><span class="diamond">◆</span> Herramienta independiente de vigilancia regulatoria — datos públicos, fuente Instituto de Salud Pública de Chile (ISP)</div></div>
  <div class="mh-brand"><div class="wrap">
    <a class="brand" href="index.html">
      <span class="seal">${ICON_SEAL}</span>
      <span class="brand-text">
        <span class="brand-name">AARR</span>
        <span class="brand-tag">Vigilancia Regulatoria Farmacéutica · ANAMED / ISP Chile</span>
      </span>
    </a>
    <div class="header-right">
      <span class="badge" id="estadoBadge">${badgeHtml()}</span>
      <button id="themeBtn" title="Cambiar tema"></button>
    </div>
  </div></div>
  ${navHtml(active)}
</div>
<main class="wrap">
  <div class="sub-line">${subFechasHtml()}</div>
  ${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-brand"><span class="seal">${ICON_SEAL}</span> AARR — Vigilancia Regulatoria Farmacéutica</div>
    <p>
      Herramienta independiente de monitoreo de normativa farmacéutica chilena, construida y mantenida por AARR.
      Los datos de normas provienen de fuentes públicas del Instituto de Salud Pública de Chile (ISP/ANAMED) —
      este sitio no es un servicio oficial del Estado de Chile ni está afiliado al ISP.
      Para actualizar los cambios detectados ejecuta <code>node check-normativa.js</code> en <code>vigilancia-isp/</code> y luego
      <code>node build.js</code> en esta carpeta. Los enlaces a PDF/OCR apuntan a copias locales; el enlace "fuente" apunta al sitio oficial.
    </p>
  </div>
</footer>
<div id="tip"></div>
<script>
const RESUMEN = ${JSON.stringify(resumen)};
${dataVar ? `const DATA = ${JSON.stringify(dataVar)};` : ''}
${SHARED_JS}
$('#ultimaRev').textContent = fmtFecha(RESUMEN.generadoEl);
${resumen.prevFetchedAt ? `if ($('#prevRev')) $('#prevRev').textContent = fmtFecha(RESUMEN.prevFetchedAt);` : ''}
${script}
</script>
</body>
</html>`;
}

// ============================================================
// 5. página: index.html (portada)
// ============================================================
const homeBody = `
  <div class="kpis">
    <div class="card tile accent-blue">
      <div class="tile-head"><span class="label">Normas vigiladas (ISP)</span><span class="icon">${ICON_DOC}</span></div>
      <div class="value">${resumen.totalVigiladas}</div>
      <div class="note">en ${resumen.categoriasV.length} categorías</div>
    </div>
    <a class="card tile status${resumen.nCambios ? '' : ' ok'}" href="cambios.html">
      <div class="tile-head"><span class="label">Cambios</span><span class="icon">${ICON_PULSE}</span></div>
      <div class="value"><span class="dot" style="background:${resumen.nCambios ? 'var(--warning)' : 'var(--good)'}"></span>${resumen.nCambios}</div>
      <div class="note">${resumen.baseline ? 'se detectan desde la próxima revisión' : (resumen.nCambios ? 'cambios detectados' : 'sin cambios detectados')}</div>
      <div class="go">Ver detalle →</div>
    </a>
    <a class="card tile accent-aqua" href="repositorio.html">
      <div class="tile-head"><span class="label">Documentos en repositorio</span><span class="icon">${ICON_FOLDER}</span></div>
      <div class="value">${resumen.totalRepo}</div>
      <div class="note">${resumen.normasUnicas} normas únicas · ${resumen.conDoc} con PDF descargado</div>
      <div class="go">Explorar repositorio →</div>
    </a>
    <a class="card tile" href="historial.html">
      <div class="tile-head"><span class="label">Revisiones registradas</span><span class="icon">${ICON_CLOCK}</span></div>
      <div class="value">${resumen.nRevisiones}</div>
      <div class="note">historial de monitoreo</div>
      <div class="go">Ver historial →</div>
    </a>
  </div>

  <section>
    <div class="charts2">
      <div class="card">
        <span class="eyebrow">Panorama</span>
        <div class="sec-title">Normas vigiladas por categoría</div>
        <div class="sec-sub">Según el listado oficial vigente del ISP</div>
        <div id="chartCategoriasV"></div>
      </div>
      <div class="card">
        <span class="eyebrow">Panorama</span>
        <div class="sec-title">Documentos del repositorio por categoría</div>
        <div class="sec-sub">PDFs descargados y catalogados localmente</div>
        <div id="chartCategoriasR"></div>
      </div>
    </div>
  </section>
`;
const homeScript = `
hbars($('#chartCategoriasV'), RESUMEN.categoriasV, 'var(--blue)', RESUMEN.totalVigiladas);
hbars($('#chartCategoriasR'), RESUMEN.categoriasR, 'var(--aqua)', RESUMEN.totalRepo);
`;
fs.writeFileSync(path.join(BASE, 'index.html'), page({ title: 'Inicio', active: 'inicio', body: homeBody, script: homeScript }));

// ============================================================
// 6. página: cambios.html
// ============================================================
const cambiosBody = `
  <section>
    <span class="eyebrow">Monitoreo ISP / ANAMED</span>
    <div class="sec-title">Cambios detectados</div>
    <div class="sec-sub" id="cambiosSub"></div>
    <div id="cambiosBody"></div>
  </section>
`;
const cambiosScript = `
(function cambios() {
  const V = DATA;
  const nCambios = RESUMEN.nCambios;
  const body = $('#cambiosBody');
  const sub = $('#cambiosSub');
  const NOMBRES = { descripcion: 'Descripción', fecha: 'Fecha', enlace: 'Enlace', modificaciones: 'Modificaciones' };
  const linkCorto = (u) => { try { return decodeURIComponent(u.split('/').pop()); } catch { return u; } };

  if (RESUMEN.baseline) {
    sub.textContent = '';
    body.innerHTML = '<div class="aviso">Primera captura: se estableció la línea base con ' + RESUMEN.totalVigiladas +
      ' normas el ' + fmtFecha(RESUMEN.generadoEl) + '. Los cambios se detectarán a partir de la próxima ejecución del monitoreo.</div>';
    return;
  }
  if (nCambios === 0) {
    sub.textContent = '';
    body.innerHTML = '<div class="aviso">✓ Sin cambios: la página del ISP está idéntica a la revisión del ' + fmtFecha(RESUMEN.prevFetchedAt) + '.</div>';
    return;
  }
  sub.textContent = 'Comparación contra la revisión del ' + fmtFecha(RESUMEN.prevFetchedAt);

  const fila = (r) => \`<div class="meta">\${esc(r.categoria)} · \${esc(r.tipo)} N° \${esc(r.numero)} · \${esc(r.fecha)}</div>
    <div class="desc">\${esc(r.descripcion)}\${r.enlace ? \` — <a href="\${esc(r.enlace)}" target="_blank" rel="noopener">documento</a>\` : ''}</div>\`;

  let html = '';
  if (V.nuevas.length) {
    html += \`<div class="cambio-grupo"><h3><span class="dot" style="background:var(--good)"></span>Nuevas (\${V.nuevas.length})</h3>\` +
      V.nuevas.map((r) => \`<div class="cambio" style="border-left-color:var(--good)">\${fila(r)}</div>\`).join('') + '</div>';
  }
  if (V.modificadas.length) {
    html += \`<div class="cambio-grupo"><h3><span class="dot" style="background:var(--warning)"></span>Modificadas (\${V.modificadas.length})</h3>\` +
      V.modificadas.map((m) => {
        const campos = m.campos.map((c) => {
          const a = c === 'enlace' ? linkCorto(m.antes[c]) : m.antes[c];
          const d = c === 'enlace' ? linkCorto(m.despues[c]) : m.despues[c];
          return \`<div class="campo"><span class="tag">\${NOMBRES[c]}:</span> <span class="antes">\${esc(a) || '∅'}</span><span class="flecha">→</span>\${esc(d) || '∅'}</div>\`;
        }).join('');
        return \`<div class="cambio" style="border-left-color:var(--warning)">\${fila(m.despues)}\${campos}</div>\`;
      }).join('') + '</div>';
  }
  if (V.eliminadas.length) {
    html += \`<div class="cambio-grupo"><h3><span class="dot" style="background:var(--critical)"></span>Eliminadas (\${V.eliminadas.length})</h3>\` +
      V.eliminadas.map((r) => \`<div class="cambio" style="border-left-color:var(--critical)">\${fila(r)}</div>\`).join('') + '</div>';
  }
  body.innerHTML = html;
})();
`;
fs.writeFileSync(path.join(BASE, 'cambios.html'), page({ title: 'Cambios', active: 'cambios', dataVar: V.diff, body: cambiosBody, script: cambiosScript }));

// ============================================================
// 7. página: repositorio.html
// ============================================================
const repoBody = `
  <section>
    <span class="eyebrow">Documentos catalogados</span>
    <div class="sec-title">Repositorio de normativa</div>
    <div class="sec-sub" id="repoSub"></div>
    <div class="filtros">
      <input type="search" id="rBuscar" placeholder="Buscar por descripción, número o tipo…">
      <select id="rCategoria"></select>
      <label class="chk"><input type="checkbox" id="rSoloOcr"> Solo con texto OCR</label>
    </div>
    <div class="tbl-wrap">
      <table id="tablaRepo">
        <thead><tr>
          <th>Categoría</th><th>Norma</th><th>Descripción</th><th>Fecha</th><th>Últ. modificación</th><th>Documento</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="conteo" id="repoConteo"></div>
  </section>
`;
const repoScript = `
(function tablaRepo() {
  const R = DATA;
  const tbody = $('#tablaRepo tbody');
  const selCat = $('#rCategoria'), buscar = $('#rBuscar'), soloOcr = $('#rSoloOcr');
  const opts = (vals, todo) => \`<option value="">\${todo}</option>\` + vals.map((v) => \`<option value="\${esc(v)}">\${esc(v)}</option>\`).join('');
  selCat.innerHTML = opts([...new Set(R.map((r) => r.categoria))].sort(), 'Todas las categorías');

  $('#repoSub').textContent = RESUMEN.totalRepo + ' documentos catalogados · ' + RESUMEN.normasUnicas + ' normas únicas · fuente: ' + RESUMEN.fuente.replace('normativa-anamed/','') ;

  function docLinks(r) {
    const out = [];
    if (r.pdfLocal) out.push(\`<a href="\${esc(r.pdfLocal)}" target="_blank" rel="noopener">PDF</a>\`);
    if (r.ocrLocal) out.push(\`<a href="\${esc(r.ocrLocal)}" target="_blank" rel="noopener">texto OCR</a>\`);
    if (r.fuente) out.push(\`<a href="\${esc(r.fuente)}" target="_blank" rel="noopener">fuente</a>\`);
    return out.length ? out.join('<span class="sep">·</span>') : '<span class="na">—</span>';
  }

  function render() {
    const q = buscar.value.trim().toLowerCase();
    const fc = selCat.value, onlyOcr = soloOcr.checked;
    const rows = R.filter((r) =>
      (!fc || r.categoria === fc) &&
      (!onlyOcr || r.ocrLocal) &&
      (!q || (r.descripcion + ' ' + r.numero + ' ' + r.tipo).toLowerCase().includes(q)));
    tbody.innerHTML = rows.map((r) => \`<tr>
      <td>\${esc(r.categoria)}</td>
      <td class="num">\${esc(r.tipo)} N° \${esc(r.numero)}</td>
      <td>\${esc(r.descripcion)}</td>
      <td class="fch">\${esc(r.fecha)}</td>
      <td class="mod">\${esc(r.ultMod) || '—'}</td>
      <td class="docs">\${docLinks(r)}</td>
    </tr>\`).join('');
    $('#repoConteo').textContent = rows.length + ' de ' + R.length + ' documentos';
  }
  [buscar, selCat, soloOcr].forEach((el) => el.addEventListener('input', render));
  render();
})();
`;
fs.writeFileSync(path.join(BASE, 'repositorio.html'), page({ title: 'Repositorio', active: 'repositorio', dataVar: R.registros, body: repoBody, script: repoScript }));

// ============================================================
// 8. página: historial.html
// ============================================================
const histBody = `
  <section>
    <span class="eyebrow">Trazabilidad del monitoreo</span>
    <div class="sec-title">Historial de revisiones</div>
    <div class="sec-sub">Cada ejecución de <code>node check-normativa.js</code> queda registrada aquí</div>
    <div class="tbl-wrap" style="max-height:70vh">
      <table class="hist">
        <thead><tr><th>Fecha de revisión</th><th>Total normas</th><th>Nuevas</th><th>Modificadas</th><th>Eliminadas</th><th>Resultado</th></tr></thead>
        <tbody id="histBody"></tbody>
      </table>
    </div>
  </section>
`;
const histScript = `
(function historial() {
  const rows = [...DATA].reverse();
  $('#histBody').innerHTML = rows.map((h) => {
    const cambios = h.nuevas + h.modificadas + h.eliminadas;
    const pill = h.baseline
      ? '<span class="pill"><span class="dot" style="background:var(--blue)"></span>Línea base</span>'
      : cambios > 0
        ? '<span class="pill"><span class="dot" style="background:var(--warning)"></span>Cambios</span>'
        : '<span class="pill"><span class="dot" style="background:var(--good)"></span>Sin cambios</span>';
    return \`<tr>
      <td class="fch">\${fmtFecha(h.timestamp)}</td>
      <td class="delta">\${h.total}</td>
      <td class="delta">\${h.baseline ? '—' : '+' + h.nuevas}</td>
      <td class="delta">\${h.baseline ? '—' : '~' + h.modificadas}</td>
      <td class="delta">\${h.baseline ? '—' : '−' + h.eliminadas}</td>
      <td>\${pill}</td>
    </tr>\`;
  }).join('');
})();
`;
fs.writeFileSync(path.join(BASE, 'historial.html'), page({ title: 'Historial', active: 'historial', dataVar: V.historial, body: histBody, script: histScript }));

console.log('OK: index.html, cambios.html, repositorio.html, historial.html');
console.log(`  Vigilancia: ${V.registros.length} normas · ${nCambios} cambios.`);
console.log(`  Repositorio: ${R.total} documentos (${R.normasUnicas} normas únicas aprox.).`);
