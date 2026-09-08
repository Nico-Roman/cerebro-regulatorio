// Motor de recuperación del Cerebro Regulatorio — puerto TypeScript de
// ../cerebro/query.py + ../cerebro/indice.py. Búsqueda HÍBRIDA (BM25 + boosts
// por número de norma, artículo y título curado, descuento a preámbulos) sobre
// el corpus indexado, más la señal de confianza que permite declarar ausencia
// en vez de devolver siempre los k pasajes más cercanos.
//
// Mantener esta lógica en sync con query.py/indice.py si se modifica el
// algoritmo ahí. Las constantes están agrupadas arriba justamente para eso.

import fs from "node:fs";
import path from "node:path";

export interface ModificacionRef {
  tipo: string;
  numero: string;
  fecha: string;
  verbo: string;
  disposicion: string;
  fuente: string;
}

export interface CorpusChunk {
  doc_id: string;
  chunk_id: string;
  norma_id: string;
  categoria: string;
  categorias: string[];
  tipo: string;
  numero: string;
  titulo: string;
  titulo_fuente: string;
  fecha: string;
  vigencia: string;
  vigencia_fuente: string;
  modificada: boolean;
  modificada_por: ModificacionRef[];
  disposicion_modificada: boolean;
  alerta_vigencia: string;
  seccion: string;
  fuente_texto: string;
  alertas_ocr: string[];
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
  categorias: string[];
  articulo: string;
  pagina: number;
  seccion: string;
  vigencia: string;
  vigencia_fuente: string;
  modificada: boolean;
  modificada_por: ModificacionRef[];
  disposicion_modificada: boolean;
  alerta_vigencia: string;
  fuente_texto: string;
  alertas_ocr: string[];
  pdf_path: string;
  fuente_url: string;
  texto: string;
}

export interface Confianza {
  confianza: "alta" | "media" | "baja";
  cobertura: number;
  cobertura_top: number;
  margen: number;
  terminos_ausentes: string[];
  conceptos_fuera_del_corpus: string[];
  recomendacion: "responder" | "responder_con_reservas" | "declarar_ausencia";
  motivo: string;
}

// --- Constantes espejadas desde query.py -------------------------------------
const K1 = 1.5;
const B = 0.75;
const TITLE_WEIGHT = 0.9;
const PREAMBULO_FACTOR = 0.75;
const COBERTURA_TOP_MIN = 0.5;
const COBERTURA_MIN = 0.5;
const COBERTURA_TOP_ALTA = 0.7;
const COBERTURA_ALTA = 0.8;
const PESO_FUERA_CORPUS_MAX = 0.2;
const VENTANA_CONFIANZA = 8;

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

// Sufijos flexivos del español, del más largo al más corto. Se usan SOLO para
// medir cobertura, no para indexar (igual que en indice.py).
const SUFIJOS = [
  "amientos", "amiento", "aciones", "acion", "ancias", "encias", "ciones", "cion",
  "adoras", "adores", "adora", "ador", "antes", "ante", "ables", "able", "ibles", "ible",
  "aremos", "eremos", "iremos", "abamos", "amos", "aron", "ieron", "aban", "ando", "iendo",
  "ados", "adas", "idos", "idas", "ado", "ada", "ido", "ida",
  "mente", "icos", "icas", "ico", "ica", "ivos", "ivas", "ivo", "iva",
  "aran", "aren", "asen", "ase", "ara", "are",
  "ias", "ios", "ia", "io", "an", "en", "es", "os", "as", "a", "e", "o", "s",
];

function stem(t: string): string {
  if (t.length <= 4 || /^\d+$/.test(t)) return t;
  for (const suf of SUFIJOS) {
    if (t.endsWith(suf) && t.length - suf.length >= 4) return t.slice(0, t.length - suf.length);
  }
  return t;
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

// --- Índice invertido, construido una vez por proceso ------------------------

class Indice {
  rows: CorpusChunk[];
  N: number;
  docLen: number[];
  postings: Map<string, Array<[number, number]>>;
  avgdl: number;
  idf: Map<string, number>;
  stemIdf: Map<string, number>;
  titleTokens: Set<string>[];
  idfMax: number;

  constructor(rows: CorpusChunk[]) {
    this.rows = rows;
    this.N = rows.length;
    this.docLen = new Array(this.N).fill(0);
    this.postings = new Map();
    this.titleTokens = [];
    const df = new Map<string, number>();
    const stemDf = new Map<string, number>();

    rows.forEach((r, i) => {
      const toks = tokenize(r.texto || "");
      this.docLen[i] = toks.length;
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      for (const [term, f] of tf) {
        let p = this.postings.get(term);
        if (!p) {
          p = [];
          this.postings.set(term, p);
        }
        p.push([i, f]);
        df.set(term, (df.get(term) || 0) + 1);
      }
      const raices = new Set(toks.map(stem));
      for (const s of raices) stemDf.set(s, (stemDf.get(s) || 0) + 1);
      this.titleTokens.push(new Set(tokenize(r.titulo || "")));
    });

    this.avgdl = this.N ? this.docLen.reduce((a, b) => a + b, 0) / this.N : 0;
    this.idf = new Map();
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + (this.N - n + 0.5) / (n + 0.5)));
    this.stemIdf = new Map();
    for (const [t, n] of stemDf) this.stemIdf.set(t, Math.log(1 + (this.N - n + 0.5) / (n + 0.5)));
    this.idfMax = Math.log(1 + (this.N + 0.5) / 0.5);
  }

  scores(qTokens: string[]): number[] {
    const scores = new Array(this.N).fill(0);
    const avgdl = this.avgdl || 1;
    for (const term of new Set(qTokens)) {
      const idf = this.idf.get(term);
      if (idf === undefined) continue;
      for (const [i, f] of this.postings.get(term) || []) {
        const denom = f + K1 * (1 - B + (B * this.docLen[i]) / avgdl);
        scores[i] += (idf * (f * (K1 + 1))) / denom;
      }
    }
    return scores;
  }

  idfRaiz(raiz: string): number {
    const v = this.stemIdf.get(raiz);
    return v === undefined ? this.idfMax : v;
  }
}

let corpusCache: CorpusChunk[] | null = null;
let indiceCache: Indice | null = null;

export function loadCorpus(): CorpusChunk[] {
  if (corpusCache) return corpusCache;
  const file = path.join(process.cwd(), "data", "corpus.jsonl");
  const raw = fs.readFileSync(file, "utf-8");
  corpusCache = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CorpusChunk);
  return corpusCache;
}

function getIndice(): Indice {
  if (!indiceCache) indiceCache = new Indice(loadCorpus());
  return indiceCache;
}

// --- Confianza ----------------------------------------------------------------

function terminosPasaje(r: CorpusChunk): Set<string> {
  const s = new Set<string>();
  for (const t of tokenize(r.texto || "")) s.add(stem(t));
  for (const t of tokenize(r.titulo || "")) s.add(stem(t));
  return s;
}

export function evaluarConfianza(
  idx: Indice,
  query: string,
  resultados: Array<{ score: number; r: CorpusChunk }>
): Confianza {
  const qRaw = [...new Set(tokenize(query))];
  const qTerms = [...new Set(qRaw.map(stem))];
  const vacio: Confianza = {
    confianza: "baja",
    cobertura: 0,
    cobertura_top: 0,
    margen: 0,
    terminos_ausentes: qTerms,
    conceptos_fuera_del_corpus: qTerms,
    recomendacion: "declarar_ausencia",
    motivo: qTerms.length ? "sin resultados" : "consulta sin términos de contenido",
  };
  if (!qTerms.length || !resultados.length) return vacio;

  const pesos = new Map<string, number>();
  for (const t of qTerms) pesos.set(t, idx.idfRaiz(t));
  const total = [...pesos.values()].reduce((a, b) => a + b, 0) || 1;

  const conjuntos = resultados.map(({ r }) => terminosPasaje(r));
  const union = new Set<string>();
  for (const s of conjuntos) for (const t of s) union.add(t);

  const ausentes = qTerms.filter((t) => !union.has(t));
  const cobertura =
    qTerms.filter((t) => union.has(t)).reduce((a, t) => a + (pesos.get(t) || 0), 0) / total;
  const cobertura_top = Math.max(
    0,
    ...conjuntos.map(
      (s) => qTerms.filter((t) => s.has(t)).reduce((a, t) => a + (pesos.get(t) || 0), 0) / total
    )
  );

  const scores = resultados.map((x) => x.score);
  let margen = 0;
  if (scores.length >= 3) {
    const resto = scores.slice(1).sort((a, b) => a - b);
    const mediana = resto[Math.floor(resto.length / 2)];
    margen = scores[0] ? (scores[0] - mediana) / scores[0] : 0;
  }

  const fuera = qTerms.filter((t) => !idx.stemIdf.has(t));
  const pesoFuera = fuera.reduce((a, t) => a + (pesos.get(t) || 0), 0) / total;

  let confianza: Confianza["confianza"];
  let recomendacion: Confianza["recomendacion"];
  let motivo: string;
  if (pesoFuera >= PESO_FUERA_CORPUS_MAX) {
    confianza = "baja";
    recomendacion = "declarar_ausencia";
    motivo =
      "el corpus no contiene ningún pasaje sobre: " +
      fuera.slice(0, 6).join(", ") +
      " — la materia consultada está fuera del alcance del corpus";
  } else if (cobertura_top >= COBERTURA_TOP_ALTA && cobertura >= COBERTURA_ALTA) {
    confianza = "alta";
    recomendacion = "responder";
    motivo = "la evidencia cubre la consulta";
  } else if (cobertura_top >= COBERTURA_TOP_MIN && cobertura >= COBERTURA_MIN) {
    confianza = "media";
    recomendacion = "responder_con_reservas";
    motivo = "ningún pasaje reúne toda la consulta; contrastar entre pasajes";
  } else {
    confianza = "baja";
    recomendacion = "declarar_ausencia";
    motivo =
      "los pasajes recuperados no cubren los términos específicos de la consulta" +
      (ausentes.length ? " (ausentes: " + ausentes.slice(0, 6).join(", ") + ")" : "");
  }

  return {
    confianza,
    cobertura: Math.round(cobertura * 1000) / 1000,
    cobertura_top: Math.round(cobertura_top * 1000) / 1000,
    margen: Math.round(margen * 1000) / 1000,
    terminos_ausentes: ausentes,
    conceptos_fuera_del_corpus: fuera,
    recomendacion,
    motivo,
  };
}

// --- Búsqueda -----------------------------------------------------------------

export interface SearchOptions {
  k?: number;
  vigente?: boolean;
  categoria?: string;
  sinOcr?: boolean;
}

export function marcaVigencia(r: CorpusChunk): string {
  if (r.disposicion_modificada) return "⛔ disposición modificada";
  if (r.vigencia === "vigente") return r.modificada ? "✅ vigente (norma modificada)" : "✅ vigente";
  return "⚠️ vigencia no verificada";
}

export function cite(r: CorpusChunk): string {
  const tn = [r.tipo, r.numero].filter(Boolean).join(" ") || r.doc_id;
  const art = r.articulo ? ` · ${r.articulo}` : "";
  const ocr = r.fuente_texto === "ocr" ? " · ⚠ texto OCR" : "";
  return `${tn} · pág. ${r.pagina}${art} · ${marcaVigencia(r)}${ocr}`;
}

function enCategoria(r: CorpusChunk, categoria: string): boolean {
  const cats = r.categorias && r.categorias.length ? r.categorias : [r.categoria];
  return cats.includes(categoria);
}

function rankear(
  idx: Indice,
  query: string,
  k: number,
  opts: SearchOptions
): Array<{ score: number; r: CorpusChunk }> {
  const rows = idx.rows;
  if (!rows.length) return [];

  let base = idx.scores(tokenize(query));
  const mx = Math.max(...base, 0) || 1.0;
  base = base.map((s) => s / mx);

  const qnums = queryNumbers(query);
  const qnumsNorm = new Set([...qnums].map((n) => n.replace(/^0+/, "")));
  const qarts = queryArticles(query);
  const qTerms = new Set(tokenize(query));

  const scored: Array<{ score: number; i: number }> = [];
  rows.forEach((r, i) => {
    if (opts.vigente && r.vigencia !== "vigente") return;
    if (opts.categoria && !enCategoria(r, opts.categoria)) return;
    if (opts.sinOcr && r.fuente_texto === "ocr") return;

    let score = base[i];
    if (qTerms.size) {
      let overlap = 0;
      for (const t of qTerms) if (idx.titleTokens[i].has(t)) overlap++;
      score += TITLE_WEIGHT * (overlap / qTerms.size);
    }
    if (r.numero && qnumsNorm.has(r.numero.replace(/^0+/, ""))) score += 1.5;
    if (qarts.size && r.articulo) {
      const artMatch = r.articulo.match(/\d+/);
      if (artMatch && qarts.has(artMatch[0])) score += 1.2;
    }
    const textNums = new Set(r.texto.match(/\d+/g) || []);
    if ([...qnums].some((n) => textNums.has(n))) score += 0.15;
    if (r.seccion === "preambulo") score *= PREAMBULO_FACTOR;
    if (score > 0) scored.push({ score, i });
  });

  scored.sort((a, b) => b.score - a.score);

  const out: Array<{ score: number; r: CorpusChunk }> = [];
  const perNorma = new Map<string, number>();
  const seenSig = new Set<string>();
  for (const { score, i } of scored) {
    const r = rows[i];
    const normaKey = r.norma_id || r.doc_id;
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
  return out;
}

function aResultado({ score, r }: { score: number; r: CorpusChunk }): SearchResult {
  return {
    score: Math.round(score * 1000) / 1000,
    cita: cite(r),
    titulo: r.titulo,
    tipo: r.tipo,
    numero: r.numero,
    categoria: r.categoria,
    categorias: r.categorias || [r.categoria],
    articulo: r.articulo,
    pagina: r.pagina,
    seccion: r.seccion || "",
    vigencia: r.vigencia,
    vigencia_fuente: r.vigencia_fuente,
    modificada: !!r.modificada,
    modificada_por: r.modificada_por || [],
    disposicion_modificada: !!r.disposicion_modificada,
    alerta_vigencia: r.alerta_vigencia || "",
    fuente_texto: r.fuente_texto,
    alertas_ocr: r.alertas_ocr || [],
    pdf_path: r.pdf_path,
    fuente_url: r.fuente_url,
    texto: r.texto,
  };
}

/** Recupera pasajes. La confianza se calcula aparte con `analizar`. */
export function search(query: string, opts: SearchOptions = {}): SearchResult[] {
  const { k = 5 } = opts;
  return rankear(getIndice(), query, k, opts).map(aResultado);
}

/** Punto de entrada recomendado: pasajes + señal de confianza sobre una ventana
 *  fija, para que la confianza no dependa del `k` que pidió quien consulta. */
export function analizar(
  query: string,
  opts: SearchOptions = {}
): { resultados: SearchResult[]; confianza: Confianza } {
  const { k = 5 } = opts;
  const idx = getIndice();
  const ventana = rankear(idx, query, Math.max(k, VENTANA_CONFIANZA), opts);
  return {
    resultados: ventana.slice(0, k).map(aResultado),
    confianza: evaluarConfianza(idx, query, ventana),
  };
}

export function listCategorias(): string[] {
  const rows = loadCorpus();
  const set = new Set<string>();
  for (const r of rows) {
    const cats = r.categorias && r.categorias.length ? r.categorias : [r.categoria];
    for (const c of cats) if (c) set.add(c);
  }
  return [...set].sort();
}
