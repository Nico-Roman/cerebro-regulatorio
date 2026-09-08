// Paneles de portada del Cerebro Regulatorio: "últimas normas" y "plazos con
// fecha límite". Ambos se derivan del mismo corpus.jsonl que usa el buscador
// (misma fuente, mismo principio de no-invención): nada de esto lo redacta un
// LLM, son agregaciones/regex sobre el texto legal ya indexado.

import { loadCorpus, type CorpusChunk } from "./search";

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

// Acepta dd/mm/yyyy o dd-mm-yyyy y años sueltos ("2013"). Fechas con año
// absurdo (typos de scraping, ej. "20003") o fuera de rango se descartan en
// vez de intentar adivinarlas: mejor "sin fecha" que una fecha inventada.
export function parseFechaChile(fecha: string): Date | null {
  const f = (fecha || "").trim();
  if (!f) return null;
  const maxYear = new Date().getFullYear() + 1;

  const full = f.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]);
    const year = Number(full[3]);
    if (year < 1900 || year > maxYear) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  const yearOnly = f.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year < 1900 || year > maxYear) return null;
    return new Date(Date.UTC(year, 0, 1));
  }

  return null;
}

export interface NormaReciente {
  tipo: string;
  numero: string;
  titulo: string;
  categoria: string;
  fecha: string;
  fechaIso: string | null;
  vigencia: string;
  fuente_url: string;
  pdf_path: string;
}

// Una fila por norma (el corpus trae varios chunks por norma, uno por
// página/artículo). Se ordena por fecha de publicación descendente; las
// normas sin fecha parseable quedan al final, no arriba.
export function getUltimasNormas(limit = 10): NormaReciente[] {
  const rows = loadCorpus();
  const byNorma = new Map<string, CorpusChunk>();
  for (const r of rows) {
    const key = r.norma_id || r.doc_id;
    const existing = byNorma.get(key);
    if (!existing || r.pagina < existing.pagina) byNorma.set(key, r);
  }

  const entries = [...byNorma.values()];
  entries.sort((a, b) => {
    const da = parseFechaChile(a.fecha);
    const db = parseFechaChile(b.fecha);
    if (da && db) return db.getTime() - da.getTime();
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  return entries.slice(0, limit).map((r) => ({
    tipo: r.tipo,
    numero: r.numero,
    titulo: r.titulo,
    categoria: r.categoria,
    fecha: r.fecha,
    fechaIso: parseFechaChile(r.fecha)?.toISOString() ?? null,
    vigencia: r.vigencia,
    fuente_url: r.fuente_url,
    pdf_path: r.pdf_path,
  }));
}

export interface PlazoDetectado {
  tipo: string;
  numero: string;
  categoria: string;
  resumen: string;
  fechaLimite: string;
  fechaLimiteIso: string;
  fuente_url: string;
  pdf_path: string;
  articulo: string;
}

// Solo cuenta como "plazo" un vencimiento con FECHA CALENDARIO explícita en
// el texto ("hasta el 31 de diciembre de 2027", "entrará en vigencia el...").
// Se descartan a propósito los plazos relativos ("dentro del plazo de 60
// días") porque son obligaciones administrativas recurrentes de normas
// antiguas, no un vencimiento puntual accionable — mostrarlos como "noticia"
// sería engañoso. Además solo se listan fechas aún no vencidas.
const DEADLINE_RE =
  /(hasta\s+el|antes\s+del|a\s+partir\s+del|entrar[áa]\s+en\s+vigencia\s+el|regir[áa]\s+(?:desde|hasta)\s+el)\s+(\d{1,2})\s+de\s+([a-zA-ZñÑ]+)\s+de\s+(\d{4})/gi;

export function getPlazosProximos(limit = 8): PlazoDetectado[] {
  const rows = loadCorpus();
  const now = Date.now();
  const found: PlazoDetectado[] = [];
  const seenNorma = new Set<string>();

  for (const r of rows) {
    const text = r.texto.replace(/\s+/g, " ");
    const key = r.norma_id || r.doc_id;
    if (seenNorma.has(key)) continue;

    DEADLINE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DEADLINE_RE.exec(text))) {
      const [full, , ddStr, mesStr, yyyyStr] = m;
      const mes = MESES[mesStr.toLowerCase()];
      if (mes === undefined) continue;
      const fechaLimite = new Date(Date.UTC(Number(yyyyStr), mes, Number(ddStr)));
      if (Number.isNaN(fechaLimite.getTime()) || fechaLimite.getTime() < now) continue;

      const idx = m.index;
      const start = Math.max(0, idx - 100);
      const end = Math.min(text.length, idx + full.length + 60);
      const resumen = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}…`;

      found.push({
        tipo: r.tipo,
        numero: r.numero,
        categoria: r.categoria,
        resumen,
        fechaLimite: `${Number(ddStr)} de ${mesStr.toLowerCase()} de ${yyyyStr}`,
        fechaLimiteIso: fechaLimite.toISOString(),
        fuente_url: r.fuente_url,
        pdf_path: r.pdf_path,
        articulo: r.articulo,
      });
      seenNorma.add(key);
      break; // un plazo por norma alcanza para el panel de portada
    }
  }

  found.sort((a, b) => new Date(a.fechaLimiteIso).getTime() - new Date(b.fechaLimiteIso).getTime());
  return found.slice(0, limit);
}
