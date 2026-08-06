// Motor de recuperación del Cerebro Regulatorio — puerto TypeScript de
// ../cerebro/query.py. Búsqueda HÍBRIDA (BM25 + boosts por número de norma,
// artículo y título curado) sobre el corpus indexado. No sintetiza respuestas:
// devuelve pasajes normativos con cita trazable (tipo, número, artículo,
// página, PDF y URL de fuente).
//
// Mantener esta lógica en sync con query.py si se modifica el algoritmo ahí.

import fs from "node:fs";
import path from "node:path";

export interface CorpusChunk {
  doc_id: string;
  chunk_id: string;
  categoria: string;
  tipo: string;
  numero: string;
  titulo: string;
  fecha: string;
  vigencia: string;
  vigencia_fuente: string;
  fuente_texto: string;
  fuente_url: string;
  pdf_path: string;
  pagina: number;
  articulo: string;
  texto: string;
}

export interface SearchResult {
  score: number;
  cita: string;
  titulo: string;
  tipo: string;
  numero: string;
  categoria: string;
  articulo: string;
  pagina: number;
  vigencia: string;
  vigencia_fuente: string;
  fuente_texto: string;
  pdf_path: string;
  fuente_url: string;
  texto: string;
}

const STOPWORDS = new Set(
  `a al algo alguna algunas alguno algunos ante antes como con contra cual cuando de del desde donde
dos el ella ellas ellos en entre era erais eran eres es esa esas ese eso esos esta estas este esto
estos fin fue fueron ha han hasta hay la las le les lo los mas más me mi mis mucho muchos muy nada ni
no nos o os otra otras otro otros para pero poco por porque que qué se sea sean segun según si sí sin
sobre su sus tan te tiene tienen toda todas todo todos tras tu tus un una unas uno unos y ya
articulo artículo art numero número norma`
    .split(/\s+/)
    .filter(Boolean)
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const WORD_RE = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  const normalized = stripAccents((text || "").toLowerCase());
  const toks = normalized.match(WORD_RE) || [];
  return toks.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function queryNumbers(q: string): Set<string> {
  return new Set(q.match(/\d+/g) || []);
}

function queryArticles(q: string): Set<string> {
  const out = new Set<string>();
  const re = /art[íi]culo\s+(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.add(m[1]);
  return out;
}

class BM25 {
  private k1 = 1.5;
  private b = 0.75;
  private N: number;
  private docLen: number[];
  private avgdl: number;
  private tf: Map<string, number>[];
  private idf: Map<string, number>;

  constructor(docsTokens: string[][]) {
    this.N = docsTokens.length;
    this.docLen = docsTokens.map((d) => d.length);
    this.avgdl = this.N ? this.docLen.reduce((a, b) => a + b, 0) / this.N : 0;
    this.tf = docsTokens.map((d) => {
      const c = new Map<string, number>();
      for (const t of d) c.set(t, (c.get(t) || 0) + 1);
      return c;
    });
    const df = new Map<string, number>();
    for (const c of this.tf) {
      for (const term of c.keys()) df.set(term, (df.get(term) || 0) + 1);
    }
    this.idf = new Map();
    for (const [t, n] of df) {
      this.idf.set(t, Math.log(1 + (this.N - n + 0.5) / (n + 0.5)));
    }
  }

  scores(qTokens: string[]): number[] {
    const scores = new Array(this.N).fill(0);
    const qCount = new Map<string, number>();
    for (const t of qTokens) qCount.set(t, (qCount.get(t) || 0) + 1);
    for (const term of qCount.keys()) {
      const idf = this.idf.get(term);
      if (idf === undefined) continue;
      for (let i = 0; i < this.N; i++) {
        const f = this.tf[i].get(term) || 0;
        if (!f) continue;
        const denom =
          f + this.k1 * (1 - this.b + (this.b * this.docLen[i]) / (this.avgdl || 1));
        scores[i] += (idf * (f * (this.k1 + 1))) / denom;
      }
    }
    return scores;
  }
}

let corpusCache: CorpusChunk[] | null = null;

function loadCorpus(): CorpusChunk[] {
  if (corpusCache) return corpusCache;
  const file = path.join(process.cwd(), "data", "corpus.jsonl");
  const raw = fs.readFileSync(file, "utf-8");
  corpusCache = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CorpusChunk);
  return corpusCache;
}

export interface SearchOptions {
  k?: number;
  vigente?: boolean;
  categoria?: string;
}

export function cite(r: CorpusChunk): string {
  const tn = [r.tipo, r.numero].filter(Boolean).join(" ") || r.doc_id;
  const art = r.articulo ? ` · ${r.articulo}` : "";
  const vig = r.vigencia === "vigente" ? "✅ vigente" : "⚠️ vigencia no verificada";
  return `${tn} · pág. ${r.pagina}${art} · ${vig}`;
}

export function search(query: string, opts: SearchOptions = {}): SearchResult[] {
  const { k = 5, vigente = false, categoria } = opts;
  let rows = loadCorpus();
  if (vigente) rows = rows.filter((r) => r.vigencia === "vigente");
  if (categoria) rows = rows.filter((r) => r.categoria === categoria);
  if (!rows.length) return [];

  const docsTokens = rows.map((r) => tokenize(r.texto));
  const bm = new BM25(docsTokens);
  let base = bm.scores(tokenize(query));
  const mx = Math.max(...base, 0) || 1.0;
  base = base.map((s) => s / mx);

  const qnums = queryNumbers(query);
  const qarts = queryArticles(query);
  const qTerms = new Set(tokenize(query));
  const TITLE_WEIGHT = 0.9;

  const scored: Array<{ score: number; r: CorpusChunk }> = [];
  rows.forEach((r, i) => {
    let score = base[i];
    if (qTerms.size) {
      const titleTerms = new Set(tokenize(r.titulo));
      let overlap = 0;
      for (const t of qTerms) if (titleTerms.has(t)) overlap++;
      score += TITLE_WEIGHT * (overlap / qTerms.size);
    }
    if (r.numero && [...qnums].some((n) => n.replace(/^0+/, "") === r.numero.replace(/^0+/, ""))) {
      score += 1.5;
    }
    if (qarts.size && r.articulo) {
      const artMatch = r.articulo.match(/\d+/);
      if (artMatch && qarts.has(artMatch[0])) score += 1.2;
    }
    const textNums = new Set(r.texto.match(/\d+/g) || []);
    if ([...qnums].some((n) => textNums.has(n))) score += 0.15;
    if (score > 0) scored.push({ score, r });
  });

  scored.sort((a, b) => b.score - a.score);

  const out: Array<{ score: number; r: CorpusChunk }> = [];
  const perNorma = new Map<string, number>();
  const seenSig = new Set<string>();
  for (const { score, r } of scored) {
    const normaKey = r.numero ? `${r.tipo}|${r.numero}` : r.doc_id;
    const artOrPrefix =
      r.articulo || stripAccents(r.texto.slice(0, 80).replace(/\W+/g, "")).toLowerCase();
    const sig = `${normaKey}::${artOrPrefix}::${r.pagina}`;
    if (seenSig.has(sig)) continue;
    if ((perNorma.get(normaKey) || 0) >= 2) continue;
    seenSig.add(sig);
    perNorma.set(normaKey, (perNorma.get(normaKey) || 0) + 1);
    out.push({ score, r });
    if (out.length >= k) break;
  }

  return out.map(({ score, r }) => ({
    score: Math.round(score * 1000) / 1000,
    cita: cite(r),
    titulo: r.titulo,
    tipo: r.tipo,
    numero: r.numero,
    categoria: r.categoria,
    articulo: r.articulo,
    pagina: r.pagina,
    vigencia: r.vigencia,
    vigencia_fuente: r.vigencia_fuente,
    fuente_texto: r.fuente_texto,
    pdf_path: r.pdf_path,
    fuente_url: r.fuente_url,
    texto: r.texto,
  }));
}

export function listCategorias(): string[] {
  const rows = loadCorpus();
  return [...new Set(rows.map((r) => r.categoria))].sort();
}
