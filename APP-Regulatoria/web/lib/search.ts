// El cerebro de RegulaMED, versión sin IA — puerto TypeScript de
// ../cerebro/respuesta.py (+ la parte de BM25 de ../cerebro/indice.py).
//
// Qué hace, en cuatro pasos:
//   1. Traduce la pregunta al vocabulario de la norma (data/vocabulario.json):
//      "internet" suma "expendio electrónico", "guardar" suma "archivar".
//   2. Busca amplio y diversifica por documento y artículo, no por norma.
//   3. Encuentra dentro de cada pasaje LA FRASE que responde. Si la pregunta
//      pide un plazo, la frase tiene que traer un plazo.
//   4. Decide un estado defendible: encontrado, parcial o ausente.
//
// Nunca reescribe texto legal: la frase destacada es texto literal del pasaje
// (solo se le quitan anotaciones de margen de la BCN, y el texto completo se
// entrega intacto).
//
// PARIDAD. Este archivo y respuesta.py tienen que devolver exactamente lo
// mismo. La compuerta del pipeline (eval_respuestas.py) corre los dos motores
// sobre las mismas preguntas y reprueba si difieren. Por eso las expresiones
// regulares usan clases explícitas en vez de \b y \w, que en Python son
// Unicode y en JavaScript solo ASCII.

import fs from "node:fs";
import path from "node:path";

// --- Tipos --------------------------------------------------------------------

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

export type Estado = "encontrado" | "parcial" | "ausente";

export interface ResultadoPublico {
  cita: string;
  norma: string;
  titulo: string;
  articulo: string;
  pagina: number | null;
  categoria: string;
  frase: string;
  resaltar: Array<[number, number]>;
  texto: string;
  fuente_url: string;
  es_ocr: boolean;
  avisos: string[];
  _cobertura_frase: number;
  _tiene_dato: boolean;
  _doc_id: string;
  _numero: string;
  _tipo: string;
}

export interface Respuesta {
  pregunta: string;
  tipo: string;
  estado: Estado;
  titular: string;
  motivo: string;
  principal: ResultadoPublico | null;
  relacionadas: ResultadoPublico[];
  avisos: string[];
  conceptos_fuera: string[];
}

export interface OpcionesBusqueda {
  vigente?: boolean;
  categoria?: string;
  sinOcr?: boolean;
  k?: number;
}

// --- Parámetros (espejados en respuesta.py) ----------------------------------

const K1 = 1.5;
const B = 0.75;
const CANDIDATOS = 60;
const CANDIDATOS_DEFINICION = 250;
const IDF_GENERICO = 1.2;
const MAX_RESULTADOS = 6;
const PESO_EXPANSION = 0.5;
const MAX_POR_DOCUMENTO = 3;
const MAX_POR_NORMA = 4;
const UMBRAL_ENCONTRADO = 0.6;
const UMBRAL_PASAJE_ENCONTRADO = 0.85;
const UMBRAL_PARCIAL = 0.45;
const PESO_FUERA_CORPUS_MAX = 0.2;
const LARGO_FRASE = 420;
const CREDITO_ALTERNATIVA = 0.7;
const NUCLEO_FRACCION = 0.9;
const UMBRAL_ENCONTRADO_SIN_DATO = 0.9;
const TIPOS_CON_DATO = ["plazo", "monto", "temperatura", "definicion"];
const BONO_DATO_ESTRICTO = 0.4;
const BONO_DEFINICION = 0.7;
const BONO_DATO_LAXO = 0.1;
const BONO_LEY = 0.05;
const BONO_LEY_PEDIDA = 0.3;

const LETRA = "A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ";
const INI = "(?<![" + LETRA + "])";
const FIN = "(?![" + LETRA + "])";

const NUMERO_PALABRA =
  "(?:[0-9]+(?:[.,][0-9]+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|" +
  "quince|veinte|veinticuatro|treinta|cuarenta|cuarenta y ocho|sesenta|setenta y dos|noventa|ciento)";

const CUES: Record<string, string> = {
  plazo:
    "(?<!menos de )(?<!más de )(?<!mas de )" + INI + NUMERO_PALABRA + "\\s*(?:\\([0-9]+\\)\\s*)?(?:horas?|d[ií]as?|mes(?:es)?|años?|semanas?)" + FIN +
    "|" + INI + "(?:de|en) forma inmediata|" + INI + "inmediatamente" + FIN + "|" + INI + "al cabo de" + FIN +
    "|" + INI + "mensual|" + INI + "anual|" + INI + "semestral|" + INI + "trimestral",
  monto:
    "unidad(?:es)? tributaria|" + INI + "utm" + FIN + "|\\$\\s?[0-9]|" + INI + "pesos" + FIN +
    "|ingresos? m[ií]nimos?|" + INI + "multa de" + FIN,
  temperatura: "[0-9]+\\s*[º°]\\s*c" + FIN + "|[0-9]+\\)?\\s*(?:y|a|-)\\s*\\(?\\+?\\)?\\s*[0-9]+\\s*[º°]",
  definicion:
    ":\\s|" + INI + "es (?:todo|toda|el|la|aquel|aquella|un|una|cualquier)" + FIN + "|se entender[aá] por|se denominar[aá]|" +
    INI + "se considera" + FIN + "|" + INI + "consiste en" + FIN + "|" + INI + "es el instrumento" + FIN,
  quien:
    "qu[ií]mico[- ]farmac[eé]utico|" + INI + "farmac[eé]utico|" + INI + "profesional|" + INI + "m[eé]dico|cirujano|odont[oó]log|matron|" +
    "director t[eé]cnico|" + INI + "titular|" + INI + "persona",
  requisitos: "requisitos|deber[aá]n? (?:presentar|contar|cumplir|acompañar)|siguientes (?:documentos|requisitos|antecedentes)",
  permiso:
    INI + "podr[aá]n?" + FIN + "|" + INI + "deber[aá]n?" + FIN + "|" + INI + "s[oó]lo" + FIN + "|" + INI + "solamente" + FIN +
    "|prohib|" + INI + "no (?:se )?podr|requerir[aá]n?|sin (?:la )?(?:debida )?autorizaci|" + INI + "previa" + FIN +
    "|exclusivamente|obligatori",
};

function cue(tipo: string, global = false): RegExp | null {
  const fuente = CUES[tipo];
  return fuente ? new RegExp(fuente, global ? "gi" : "i") : null;
}

const TIPOS_PREGUNTA: Array<[string, RegExp]> = [
  ["temperatura", /temperatura|grados|°|refrigera/i],
  ["monto", /\bmulta|\bmonto|cuanto cuesta|\bprecio|\bvalor de\b|\barancel/i],
  [
    "plazo",
    /cuanto tiempo|cuant[oa]s (?:dias|horas|meses|anos|años|semanas)|\bplazo|\bdura\b|\bdurar|vigencia|validez|\bvalid[oa]\b|cada cuanto|frecuencia|hasta cuando|en que plazo|antelacion/i,
  ],
  ["definicion", /^\s*(?:que|qué) (?:es|son)\b|que se (?:considera|entiende)|definicion|significa/i],
  ["quien", /^\s*(?:quien|quienes)\b|quien(?:es)? (?:puede|pueden|debe|deben)/i],
  ["requisitos", /requisitos|que necesito|documentos/i],
  [
    "permiso",
    /^\s*(?:se puede|puede|pueden|puedo|es obligatori|hay que|esta permitid|esta prohibid|necesita|es necesari|se requiere|debe|deben)\b|permitid|prohibid|obligatori/i,
  ],
];

const PALABRAS_DEL_TIPO: Record<string, Set<string>> = {
  plazo: new Set([
    "tiempo", "dias", "dia", "horas", "hora", "meses", "mes", "anos", "ano", "semanas", "semana", "plazo", "plazos",
    "dura", "durar", "duracion",
  ]),
  monto: new Set(["monto", "cuesta", "valor"]),
  temperatura: new Set(["grados"]),
  definicion: new Set(["definicion", "significa", "concepto"]),
};

const CONSIDERANDO =
  /^(?:[0-9]{1,2}[.º°-]*\s*)?(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[ÉE]PTIMO|OCTAVO|NOVENO|D[ÉE]CIMO)?\s*[:.-]?\s*(?:q)?Que[, ]/i;

// --- Texto --------------------------------------------------------------------

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

export function normalizar(s: string): string {
  return stripAccents((s || "").toLowerCase()).replace(/º/g, "o").replace(/ª/g, "a");
}

function tokenize(text: string): string[] {
  const toks = stripAccents((text || "").toLowerCase()).match(/[a-z0-9]+/g) || [];
  return toks.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

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
  if (t.length <= 4 || /^[0-9]+$/.test(t)) return t;
  for (const suf of SUFIJOS) {
    if (t.endsWith(suf) && t.length - suf.length >= 4) return t.slice(0, t.length - suf.length);
  }
  return t;
}

function raices(texto: string): Set<string> {
  return new Set(tokenize(texto).map(stem));
}

function contieneFrase(normTexto: string, frase: string): boolean {
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?<![a-z0-9])" + escapada + "(?![a-z0-9])").test(normTexto);
}

const ANOTACIONES: RegExp[] = [
  new RegExp(INI + "(?:Decreto|DTO|DS|Ley)\\s+[0-9]+[\\s,]*(?:SALUD|Salud|INTERIOR|HACIENDA)" + FIN + ",?(?:\\s*[0-9]{4}\\.?-?)?", "g"),
  new RegExp(INI + "D\\.O\\.\\s*[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}", "g"),
  new RegExp(INI + "VER NOTA\\s*[0-9]*", "g"),
  new RegExp(
    INI + "Art\\.\\s*(?:[0-9]+|primero|segundo|tercero|cuarto|[úu]nico|ÚNICO|UNICO)\\s*(?:N[°º]\\s*[0-9]+\\s*(?:[a-z]\\))?)?(?:\\s*[IVX]+" +
      FIN + ")?(?:\\s*(?:[a-z]\\)\\s*)+)?(?=\\s)",
    "g"
  ),
  new RegExp(INI + "N[°º]\\s*[0-9]+,?\\s*(?:[a-z]\\)\\s*)+(?=\\s)", "g"),
  new RegExp(INI + "SALUD,\\s*(?:[0-9]{4}\\.?-?\\s*)?(?:N[°º]\\s*[0-9]+,?\\s*(?:[a-z]\\)\\s*)*)?", "g"),
  new RegExp(INI + "(?:Decreto|DS|DTO)\\s+[0-9]+,\\s*(?=[A-ZÁÉÍÓÚ])", "g"),
  new RegExp(INI + "DS\\s+[0-9]+,(?=\\s)", "g"),
];

function limpiarAnotaciones(texto: string): string {
  if (!texto.includes("D.O.") && !texto.includes("SALUD")) return texto;
  let t = texto;
  for (const rx of ANOTACIONES) t = t.replace(rx, " ");
  return t.replace(/\s{2,}/g, " ").trim();
}

const NO_CORTAR = new Set([
  "art", "arts", "n", "no", "nº", "núm", "num", "res", "ex", "dto", "d", "o", "sr", "sra", "dr", "inc",
  "pág", "pag", "ej", "lit", "min", "máx", "max", "aprox", "etc", "ss", "cfr", "vol", "i", "ii", "iii",
]);

function dividirUnidades(texto: string): string[] {
  let t = (texto || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\[[^\]]{0,300}\]\s*/, "");
  const cortes: number[] = [];
  const rx = /(?<=[.;:])\s+(?=(?:[A-ZÁÉÍÓÚÑ¿"“(]|[0-9]{1,3}[.)]|[a-z]\)|-\s))/g;
  const palabraRx = new RegExp("([" + LETRA + "º]+)[.;:]$");
  for (const m of t.matchAll(rx)) {
    const inicio = m.index as number;
    const fin = inicio + m[0].length;
    const antes = t.slice(0, inicio);
    const despues = t.slice(fin, fin + 4);
    if (antes.endsWith(":") && !/^(?:[0-9]{1,3}[.)]|[a-z]\)|-\s)/.test(despues)) continue;
    const palabra = antes.match(palabraRx);
    if (antes.endsWith(".") && palabra && (NO_CORTAR.has(palabra[1].toLowerCase()) || palabra[1].length === 1)) continue;
    cortes.push(fin);
  }
  const unidades: string[] = [];
  let desde = 0;
  for (const c of cortes) {
    const u = t.slice(desde, c).trim();
    if (u) unidades.push(u);
    desde = c;
  }
  const resto = t.slice(desde).trim();
  if (resto) unidades.push(resto);
  return unidades;
}

function recortar(texto: string, largo = LARGO_FRASE): string {
  if (texto.length <= largo) return texto;
  const corte = texto.lastIndexOf(" ", largo - 2);
  const hasta = corte > largo * 0.6 ? corte : largo - 1;
  return texto.slice(0, hasta).replace(/[ ,;:]+$/, "") + "…";
}

// --- Vocabulario -------------------------------------------------------------

interface Vocabulario {
  palabras_de_pregunta: string[];
  expansiones: Array<{ si: string[]; agregar: string[] }>;
  fuera_de_alcance: Array<{ patron: string; excepto: string; materia: string }>;
}

let vocabularioCache: Vocabulario | null = null;

function vocabulario(): Vocabulario {
  if (!vocabularioCache) {
    const file = path.join(process.cwd(), "data", "vocabulario.json");
    vocabularioCache = JSON.parse(fs.readFileSync(file, "utf-8")) as Vocabulario;
  }
  return vocabularioCache;
}

// --- Índice BM25 ---------------------------------------------------------------

class Indice {
  rows: CorpusChunk[];
  N: number;
  docLen: number[];
  postings: Map<string, Array<[number, number]>>;
  avgdl: number;
  idf: Map<string, number>;
  stemIdf: Map<string, number>;
  idfMax: number;
  private normalizadosCache: string[] | null = null;

  constructor(rows: CorpusChunk[]) {
    this.rows = rows;
    this.N = rows.length;
    this.docLen = new Array(this.N).fill(0);
    this.postings = new Map();
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
      for (const s of new Set(toks.map(stem))) stemDf.set(s, (stemDf.get(s) || 0) + 1);
    });
    this.avgdl = this.N ? this.docLen.reduce((a, b) => a + b, 0) / this.N : 0;
    this.idf = new Map();
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + (this.N - n + 0.5) / (n + 0.5)));
    this.stemIdf = new Map();
    for (const [t, n] of stemDf) this.stemIdf.set(t, Math.log(1 + (this.N - n + 0.5) / (n + 0.5)));
    this.idfMax = Math.log(1 + (this.N + 0.5) / 0.5);
  }

  idfRaiz(raiz: string): number {
    const v = this.stemIdf.get(raiz);
    return v === undefined ? this.idfMax : v;
  }

  normalizados(): string[] {
    if (!this.normalizadosCache) {
      this.normalizadosCache = this.rows.map((r) => normalizar(r.texto || "").replace(/\s+/g, " "));
    }
    return this.normalizadosCache;
  }
}

let corpusCache: CorpusChunk[] | null = null;
let indiceCache: Indice | null = null;

export function loadCorpus(file?: string): CorpusChunk[] {
  if (corpusCache) return corpusCache;
  const ruta = file || path.join(process.cwd(), "data", "corpus.jsonl");
  const texto: string = fs.readFileSync(ruta, "utf-8");
  const filas: CorpusChunk[] = texto
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CorpusChunk);
  corpusCache = filas;
  return filas;
}

function getIndice(): Indice {
  if (!indiceCache) indiceCache = new Indice(loadCorpus());
  return indiceCache;
}

export function listCategorias(): string[] {
  const set = new Set<string>();
  for (const r of loadCorpus()) {
    const cats = r.categorias && r.categorias.length ? r.categorias : [r.categoria];
    for (const c of cats) if (c) set.add(c);
  }
  return [...set].sort();
}

// --- Pregunta ------------------------------------------------------------------

interface Concepto {
  termino: string;
  raiz: string;
  peso: number;
  alternativas: string[][];
}

interface Pregunta {
  idx: Indice;
  normalizada: string;
  conceptos: Concepto[];
  definido: Concepto | null;
  extras: Map<string, number>;
  tipo: string;
  fueraDeAlcance: string | null;
  pideNorma: boolean;
  pideLey: boolean;
  numeros: Set<string>;
  articulos: Set<string>;
}

function maxPorPeso(cs: Concepto[]): Concepto {
  let mejor = cs[0];
  for (const c of cs.slice(1)) if (c.peso > mejor.peso) mejor = c;
  return mejor;
}

function analizarPregunta(pregunta: string, idx: Indice): Pregunta {
  const voc = vocabulario();
  const norm = normalizar(pregunta);
  const conversacion = new Set(voc.palabras_de_pregunta || []);

  let fuera: string | null = null;
  for (const regla of voc.fuera_de_alcance || []) {
    if (new RegExp(regla.patron).test(norm) && !(regla.excepto && new RegExp(regla.excepto).test(norm))) {
      fuera = regla.materia;
      break;
    }
  }

  let tipo = "general";
  const sinSignos = norm.replace(/^[\s¿¡"'(]+/, "");
  for (const [nombre, rx] of TIPOS_PREGUNTA) {
    if (rx.test(sinSignos)) {
      tipo = nombre;
      break;
    }
  }
  const propias = PALABRAS_DEL_TIPO[tipo] || new Set<string>();
  const tokens = [...new Set(tokenize(pregunta))].filter((t) => !conversacion.has(t) && !propias.has(t));

  const conceptos: Concepto[] = [];
  for (const t of tokens) {
    const r = stem(t);
    if (conceptos.some((c) => c.raiz === r)) continue;
    conceptos.push({ termino: t, raiz: r, peso: idx.idfRaiz(r), alternativas: [] });
  }

  const extras = new Map<string, number>();
  const raicesPregunta = new Set(tokenize(pregunta).map(stem));
  for (const entrada of voc.expansiones || []) {
    // Una palabra suelta dispara por su raíz ("notifica" activa "notificar");
    // una frase, solo si aparece tal cual.
    const disparadores = entrada.si.filter((s) => (s.includes(" ") ? contieneFrase(norm, s) : raicesPregunta.has(stem(s))));
    if (!disparadores.length) continue;
    const palabras = new Set(disparadores.flatMap((s) => tokenize(s).map(stem)));
    const dueno = conceptos.find((c) => palabras.has(c.raiz)) || null;
    for (const frase of entrada.agregar) {
      const rs = tokenize(frase).map(stem);
      if (!rs.length) continue;
      if (dueno && !dueno.alternativas.some((a) => a.join(" ") === rs.join(" "))) dueno.alternativas.push(rs);
      for (const w of tokenize(frase)) if (!tokens.includes(w)) extras.set(w, PESO_EXPANSION);
    }
  }

  // Un infinitivo que no aparece en ninguna norma ("infringir") no significa que
  // la materia falte: la norma lo dice con un sustantivo ("infracción").
  const filtrados = conceptos.filter((c) => !/[a-z]{3,}(?:ar|er|ir)$/.test(c.termino) || conceptoEnCorpus(c, idx));
  conceptos.length = 0;
  conceptos.push(...filtrados);

  let definido: Concepto | null = null;
  if (tipo === "definicion" && conceptos.length) {
    const m = sinSignos.match(/(?:que|qué)\s+(?:es|son|se\s+considera|se\s+entiende\s+por)\s+(?:un|una|el|la|los|las|lo)?\s*(.+)/);
    if (m) {
      const primeras = tokenize(m[1]).map(stem).slice(0, 3);
      const candidatos = conceptos.filter((c) => primeras.includes(c.raiz));
      definido = candidatos.length ? maxPorPeso(candidatos) : null;
    }
    definido = definido || maxPorPeso(conceptos);
  }

  return {
    idx,
    normalizada: norm,
    conceptos,
    definido,
    extras,
    tipo,
    fueraDeAlcance: fuera,
    pideNorma:
      /(?:existe|hay|habra)\s+(?:una|alguna|algun)?\s*(?:guia|norma|resolucion|decreto|reglamento|ley|instructivo)|(?:que|cual|cuales)\s+(?:es\s+la\s+)?(?:norma|resolucion|decreto|reglamento|ley|guia)s?\s+(?:regula|establece|aprueba|exige|rige|trata)/.test(
        norm
      ),
    pideLey: /\bley\b|\blegal\b|codigo sanitario|\bdfl\b/.test(norm),
    numeros: new Set(pregunta.match(/[0-9]+/g) || []),
    articulos: new Set([...pregunta.toLowerCase().matchAll(/art[íi]culo\s+([0-9]+)/g)].map((x) => x[1])),
  };
}

function conceptoEnCorpus(c: Concepto, idx: Indice): boolean {
  return idx.stemIdf.has(c.raiz) || c.alternativas.some((alt) => alt.every((r) => idx.stemIdf.has(r)));
}

function credito(c: Concepto, raicesTexto: Set<string>): number {
  if (raicesTexto.has(c.raiz)) return 1.0;
  let mejor = 0.0;
  for (const alt of c.alternativas) {
    if (alt.every((r) => raicesTexto.has(r))) mejor = Math.max(mejor, alt.length > 1 ? 1.0 : CREDITO_ALTERNATIVA);
  }
  return mejor;
}

function cobertura(conceptos: Concepto[], raicesTexto: Set<string>): number {
  const total = conceptos.reduce((a, c) => a + c.peso, 0) || 1.0;
  return conceptos.reduce((a, c) => a + c.peso * credito(c, raicesTexto), 0) / total;
}

function nucleo(conceptos: Concepto[]): Concepto[] {
  if (!conceptos.length) return [];
  const orden = [...conceptos].sort((a, b) => b.peso - a.peso);
  const tope = orden[0].peso;
  return orden.slice(0, 2).concat(orden.slice(2).filter((c) => c.peso >= NUCLEO_FRACCION * tope));
}

function nucleoCubierto(conceptos: Concepto[], raicesTexto: Set<string>): boolean {
  const n = nucleo(conceptos);
  return n.length > 0 && n.every((c) => credito(c, raicesTexto) > 0);
}

// --- Búsqueda --------------------------------------------------------------------

function puntajesBm25(idx: Indice, pesos: Map<string, number>): number[] {
  const scores = new Array(idx.N).fill(0);
  const avgdl = idx.avgdl || 1.0;
  for (const [term, w] of pesos) {
    const idf = idx.idf.get(term);
    if (idf === undefined) continue;
    for (const [i, f] of idx.postings.get(term) || []) {
      const denom = f + K1 * (1 - B + (B * idx.docLen[i]) / avgdl);
      scores[i] += (w * idf * (f * (K1 + 1))) / denom;
    }
  }
  return scores;
}

const ENUMERACION = /^(?:[a-z]\)|[0-9]{1,3}[.)]|-\s)/;
const ENCABEZADO = new RegExp(
  "^(?:(?:art[íi]culo|art\\.)\\s+[" + LETRA + "º°]+(?:\\s+(?:bis|ter|qu[aá]ter|[a-z])" + FIN +
    ")?\\s*[.°º:-]*\\s*|[0-9]{1,3}\\)\\s*|[a-z]\\)\\s*|[0-9]{1,3}\\.-?\\s*)+",
  "i"
);

function esDefinicionDe(unidad: string, pq: Pregunta): boolean {
  const concepto = pq.definido;
  if (!concepto) return false;
  const u = unidad.replace(ENCABEZADO, "");
  const m = u.slice(0, 90).match(cue("definicion") as RegExp);
  if (!m || (m.index as number) > 60) return false;
  const termino = u.slice(0, m.index as number).replace(/\([^)]*\)/g, " ");
  const raicesTermino = raices(termino);
  if (credito(concepto, raicesTermino) <= 0) return false;
  const permitidas = new Set<string>([concepto.raiz]);
  for (const alt of concepto.alternativas) for (const r of alt) permitidas.add(r);
  for (const otro of pq.conceptos) {
    permitidas.add(otro.raiz);
    for (const alt of otro.alternativas) for (const r of alt) permitidas.add(r);
  }
  return [...raicesTermino].every((r) => permitidas.has(r) || pq.idx.idfRaiz(r) < IDF_GENERICO);
}

function patronDefinicion(pq: Pregunta): RegExp {
  const c = pq.definido as Concepto;
  const terminos = [c.termino].concat(c.alternativas.filter((a) => a.length > 1).map((a) => a.join(" ")));
  const alternativas = terminos.map((t) => t.replace(/ /g, "\\s") + "[a-z0-9]{0,3}").join("|");
  return new RegExp(
    "(?<![a-z0-9])(?:" + alternativas +
      ")[^.;:]{0,40}?(?::|(?<![a-z0-9])es (?:todo|toda|el|la|aquel|aquella|un|una|cualquier)(?![a-z0-9])|se entendera por)"
  );
}

interface Candidato {
  puntaje: number;
  i: number;
  fila: CorpusChunk;
  frase: string;
  coberturaFrase: number;
  coberturaPasaje: number;
  tieneDato: boolean;
  nucleo: boolean;
}

function mejorFrase(
  r: CorpusChunk,
  pq: Pregunta
): { frase: string; cov: number; tieneDato: boolean; enNucleo: boolean; esConsiderando: boolean } {
  const unidades = dividirUnidades(r.texto || "");
  if (!unidades.length) return { frase: "", cov: 0, tieneDato: false, enNucleo: false, esConsiderando: false };
  const rxCue = cue(pq.tipo);
  let mejor: [number, number, number, boolean] = [-1.0, 0, 0.0, false];
  unidades.forEach((u, i) => {
    const cov = cobertura(pq.conceptos, raices(u));
    let tieneDato = rxCue ? rxCue.test(u) : false;
    if (pq.tipo === "definicion" && tieneDato) tieneDato = esDefinicionDe(u, pq);
    let puntaje = cov + (tieneDato ? 0.3 : 0.0);
    if (CONSIDERANDO.test(u)) puntaje *= 0.6;
    if (puntaje > mejor[0]) mejor = [puntaje, i, cov, tieneDato];
  });
  const [, i, cov, tieneDato] = mejor;
  const esConsiderando = CONSIDERANDO.test(unidades[i]);
  const enNucleo = nucleoCubierto(pq.conceptos, raices(unidades[i])) && !esConsiderando;
  let frase = unidades[i];
  if (ENUMERACION.test(frase)) {
    let intro: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (unidades[j].endsWith(":") && !ENUMERACION.test(unidades[j])) {
        intro = unidades[j];
        break;
      }
    }
    if (intro) frase = recortar(intro, 160) + " " + frase;
  } else if (frase.length < 90 && i > 0 && unidades[i - 1].endsWith(":")) {
    frase = recortar(unidades[i - 1], 160) + " " + frase;
  }
  let j = i + 1;
  while (frase.endsWith(":") && j < unidades.length && frase.length < LARGO_FRASE) {
    frase = frase + " " + unidades[j];
    j++;
  }
  return { frase: recortar(limpiarAnotaciones(frase)), cov, tieneDato, enNucleo, esConsiderando };
}

function esLey(r: CorpusChunk): boolean {
  return r.tipo === "Ley" || r.tipo === "Decreto con Fuerza de Ley";
}

function buscar(pq: Pregunta, opts: OpcionesBusqueda, k: number): Candidato[] {
  const idx = pq.idx;
  const pesos = new Map<string, number>();
  for (const c of pq.conceptos) pesos.set(c.termino, 1.0);
  for (const [w, p] of pq.extras) if (!pesos.has(w)) pesos.set(w, p);
  let base = puntajesBm25(idx, pesos);
  const mx = base.length ? base.reduce((a, b) => (b > a ? b : a), base[0]) : 0;
  if (mx) base = base.map((s) => s / mx);

  // Las definiciones legales viven en listas largas donde BM25 puntúa bajo o
  // nada: se buscan también directamente por su forma.
  const rxDef = pq.tipo === "definicion" && pq.definido ? patronDefinicion(pq) : null;
  const norms = rxDef ? idx.normalizados() : null;
  const porForma = new Set<number>();

  const numerosPregunta = new Set([...pq.numeros].map((n) => n.replace(/^0+/, "")));
  const previos: Array<[number, number, number]> = [];
  idx.rows.forEach((r, i) => {
    if (base[i] <= 0) {
      if (!rxDef || !rxDef.test((norms as string[])[i])) return;
      porForma.add(i);
    } else if (rxDef && rxDef.test((norms as string[])[i])) {
      porForma.add(i);
    }
    if (opts.vigente && r.vigencia !== "vigente") return;
    if (opts.categoria && !(r.categorias && r.categorias.length ? r.categorias : [r.categoria || ""]).includes(opts.categoria)) return;
    if (opts.sinOcr && r.fuente_texto === "ocr") return;
    let s = base[i];
    const tituloCov = cobertura(pq.conceptos, raices(r.titulo || ""));
    s += 0.3 * tituloCov;
    const numero = (r.numero || "").replace(/^0+/, "");
    if (numero && numerosPregunta.has(numero)) s += 1.0;
    if (pq.articulos.size && r.articulo) {
      const m = r.articulo.match(/[0-9]+/);
      if (m && pq.articulos.has(m[0])) s += 0.8;
    }
    if (r.seccion === "preambulo") s *= 0.75;
    previos.push([s, i, tituloCov]);
  });
  previos.sort((a, b) => b[0] - a[0]);

  const tope = pq.tipo === "definicion" ? CANDIDATOS_DEFINICION : CANDIDATOS;
  let seleccion = previos.slice(0, tope);
  if (porForma.size) {
    const ya = new Set(seleccion.map((x) => x[1]));
    seleccion = seleccion.concat(previos.filter((x) => !ya.has(x[1]) && porForma.has(x[1])));
  }

  const candidatos: Candidato[] = [];
  const vistosTexto = new Set<string>();
  for (const [s, i, tituloCov] of seleccion) {
    const r = idx.rows[i];
    const huella = normalizar(r.texto || "").replace(/[^a-z0-9]+/g, "").slice(0, 200);
    if (vistosTexto.has(huella)) continue;
    vistosTexto.add(huella);
    const mf = mejorFrase(r, pq);
    const covPasaje = cobertura(pq.conceptos, new Set([...raices(r.texto || ""), ...raices(r.titulo || "")]));
    let final = 0.35 * s + 0.4 * mf.cov + 0.15 * covPasaje + 0.2 * tituloCov;
    if (pq.pideNorma) final += 0.4 * tituloCov;
    if (esLey(r)) final += pq.pideLey ? BONO_LEY_PEDIDA : BONO_LEY;
    if (mf.tieneDato && CUES[pq.tipo]) {
      if (pq.tipo === "definicion") final += BONO_DEFINICION;
      else final += TIPOS_CON_DATO.includes(pq.tipo) ? BONO_DATO_ESTRICTO : BONO_DATO_LAXO;
    }
    if (r.seccion === "preambulo" || mf.esConsiderando) final *= 0.75;
    if (r.fuente_texto === "ocr") final *= 0.95;
    if (r.vigencia !== "vigente") final *= 0.9;
    candidatos.push({
      puntaje: final,
      i,
      fila: r,
      frase: mf.frase,
      coberturaFrase: mf.cov,
      coberturaPasaje: covPasaje,
      tieneDato: mf.tieneDato,
      nucleo: mf.enNucleo,
    });
  }
  candidatos.sort((a, b) => b.puntaje - a.puntaje);

  const salida: Candidato[] = [];
  const porDoc = new Map<string, number>();
  const porNorma = new Map<string, number>();
  const vistas = new Set<string>();
  for (const c of candidatos) {
    const doc = c.fila.doc_id;
    const norma = c.fila.norma_id || doc;
    const firma = normalizar(c.frase).replace(/[^a-z0-9]+/g, "").slice(0, 160);
    if (vistas.has(firma) || (porDoc.get(doc) || 0) >= MAX_POR_DOCUMENTO || (porNorma.get(norma) || 0) >= MAX_POR_NORMA) continue;
    vistas.add(firma);
    porDoc.set(doc, (porDoc.get(doc) || 0) + 1);
    porNorma.set(norma, (porNorma.get(norma) || 0) + 1);
    salida.push(c);
    if (salida.length >= k) break;
  }

  if (salida.length > 1 && !esLey(salida[0].fila)) {
    for (let j = 1; j < Math.min(4, salida.length); j++) {
      const c = salida[j];
      if (
        esLey(c.fila) &&
        c.puntaje >= 0.9 * salida[0].puntaje &&
        (c.tieneDato || !TIPOS_CON_DATO.includes(pq.tipo)) &&
        c.coberturaFrase >= salida[0].coberturaFrase - 0.1
      ) {
        salida.unshift(salida.splice(j, 1)[0]);
        break;
      }
    }
  }
  return salida;
}

// --- Presentación ------------------------------------------------------------------

const ABREV_TIPO: Record<string, string> = {
  "Decreto Supremo": "DS",
  "Decreto Exento": "D. Ex.",
  "Resolución Exenta": "Res. Ex.",
  "Norma Técnica": "NT",
  "Decreto con Fuerza de Ley": "DFL",
  Ley: "Ley",
  Decreto: "Decreto",
  Circular: "Circular",
};

function formatoNumero(n: string): string {
  const s = (n || "").trim();
  if (/^[0-9]+$/.test(s) && s.length >= 4) {
    return String(parseInt(s, 10)).replace(/\B(?=([0-9]{3})+(?![0-9]))/g, ".");
  }
  return s;
}

function articuloCorto(a: string): string {
  const s = (a || "").trim();
  const m = s.match(/^art(?:[íi]culo|\.)\s*(.*)$/i);
  if (!m) return s;
  const resto = m[1].replace(/[º°]/g, "").trim().replace(/[.-]+$/, "").trim();
  return resto && !/^[0-9]/.test(resto) ? "art. " + resto.toLowerCase() : "art. " + resto;
}

export function citaCorta(r: CorpusChunk): string {
  let base: string;
  if (r.numero === "725" && r.tipo === "Decreto con Fuerza de Ley") {
    base = "Código Sanitario";
  } else {
    const tipo = ABREV_TIPO[r.tipo || ""] ?? (r.tipo || "");
    base = [tipo, formatoNumero(r.numero || "")].filter(Boolean).join(" ") || r.doc_id || "";
  }
  if (r.articulo) return base + " · " + articuloCorto(r.articulo);
  if (r.pagina) return base + " · pág. " + r.pagina;
  return base;
}

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  cosmeticos: "Cosméticos",
  ensayos_clinicos: "Ensayos clínicos",
  establecimientos_autorizacion_y_fiscalizacion: "Establecimientos",
  farmacovigilancia: "Farmacovigilancia",
  importacion_y_exportacion_control_y_vigilancia: "Importación y exportación",
  laboratorio_nacional_de_control: "Laboratorio Nacional de Control",
  medicamentos: "Medicamentos",
  codigo_sanitario: "Código Sanitario",
  otros: "Otras normas ISP",
};

export function etiquetaCategoria(c: string): string {
  return ETIQUETAS_CATEGORIA[c] ?? (c || "").replace(/_/g, " ");
}

function avisosDe(c: Candidato): string[] {
  const r = c.fila;
  const avisos: string[] = [];
  if (r.disposicion_modificada) {
    const nombres: string[] = [];
    for (const m of r.modificada_por || []) {
      const n = [m.tipo || "", formatoNumero(m.numero || "")].filter(Boolean).join(" ");
      if (n && !nombres.includes(n)) nombres.push(n);
    }
    const por = nombres.slice(0, 2).join(", ");
    avisos.push(
      "Este punto fue modificado" + (por ? " por " + por : "") +
        ". El texto que ves es el original: revisa la norma modificatoria."
    );
  }
  if (r.fuente_texto === "ocr" && /[0-9]/.test(c.frase)) {
    avisos.push("Texto escaneado (OCR): confirma las cifras en el documento oficial.");
  }
  if (r.vigencia !== "vigente") avisos.push("Vigencia no verificada contra el listado oficial del ISP.");
  return avisos;
}

function resaltados(frase: string, pq: Pregunta): Array<[number, number]> {
  const tramos: Array<[number, number]> = [];
  const rxCue = cue(pq.tipo, true);
  if (rxCue && !["definicion", "quien", "permiso", "requisitos"].includes(pq.tipo)) {
    for (const m of frase.matchAll(rxCue)) tramos.push([m.index as number, (m.index as number) + m[0].length]);
  }
  const objetivos = new Set<string>();
  for (const c of pq.conceptos) {
    objetivos.add(c.raiz);
    for (const alt of c.alternativas) if (alt.length === 1) objetivos.add(alt[0]);
  }
  for (const m of frase.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g)) {
    const w = normalizar(m[0]);
    if (w.length >= 4 && objetivos.has(stem(w))) tramos.push([m.index as number, (m.index as number) + m[0].length]);
  }
  tramos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unidos: Array<[number, number]> = [];
  for (const [a, b] of tramos) {
    if (unidos.length && a <= unidos[unidos.length - 1][1] + 1) {
      unidos[unidos.length - 1][1] = Math.max(unidos[unidos.length - 1][1], b);
    } else {
      unidos.push([a, b]);
    }
  }
  return unidos;
}

function redondear3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function resultadoPublico(c: Candidato, pq: Pregunta): ResultadoPublico {
  const r = c.fila;
  return {
    cita: citaCorta(r),
    norma: [r.tipo || "", formatoNumero(r.numero || "")].filter(Boolean).join(" "),
    titulo: r.titulo || "",
    articulo: r.articulo || "",
    pagina: r.pagina || null,
    categoria: etiquetaCategoria(r.categoria || ""),
    frase: c.frase,
    resaltar: resaltados(c.frase, pq),
    texto: r.texto || "",
    fuente_url: r.fuente_url || "",
    es_ocr: r.fuente_texto === "ocr",
    avisos: avisosDe(c),
    _cobertura_frase: redondear3(c.coberturaFrase),
    _tiene_dato: c.tieneDato,
    _doc_id: r.doc_id || "",
    _numero: r.numero || "",
    _tipo: r.tipo || "",
  };
}

function principalEn(c: Candidato, pq: Pregunta): boolean {
  const rs = new Set([...raices(c.fila.texto || ""), ...raices(c.fila.titulo || "")]);
  return nucleo(pq.conceptos).some((x) => credito(x, rs) > 0);
}

/** Punto de entrada: la respuesta completa que consume la web. */
export function responder(pregunta: string, opts: OpcionesBusqueda = {}, idxExterno?: Indice): Respuesta {
  const idx = idxExterno || getIndice();
  const k = opts.k ?? MAX_RESULTADOS;
  const pq = analizarPregunta(pregunta, idx);
  const vacia = { pregunta, tipo: pq.tipo, principal: null, relacionadas: [], avisos: [] as string[] };

  if (!pq.conceptos.length) {
    return {
      ...vacia,
      estado: "ausente",
      titular: "Escribe la pregunta con un poco más de detalle.",
      motivo: "La pregunta no trae términos que se puedan buscar en la normativa.",
      conceptos_fuera: [],
    };
  }
  if (pq.fueraDeAlcance) {
    return {
      ...vacia,
      estado: "ausente",
      titular: "Esto no está en nuestra base.",
      motivo: "La base cubre la normativa del ISP/ANAMED y el Código Sanitario; no incluye " + pq.fueraDeAlcance + ".",
      conceptos_fuera: [],
    };
  }

  const fuera: Concepto[] = [];
  const total = pq.conceptos.reduce((a, c) => a + c.peso, 0) || 1.0;
  for (const c of pq.conceptos) if (!conceptoEnCorpus(c, idx)) fuera.push(c);
  const pesoFuera = fuera.reduce((a, c) => a + c.peso, 0) / total;
  if (pesoFuera >= PESO_FUERA_CORPUS_MAX) {
    const palabras = fuera.slice(0, 4).map((c) => "«" + c.termino + "»").join(", ");
    return {
      ...vacia,
      estado: "ausente",
      titular: "Esto no está en nuestra base.",
      motivo: "No encontramos " + palabras + " en ninguna norma de la base (ISP/ANAMED y Código Sanitario).",
      conceptos_fuera: fuera.map((c) => c.termino),
    };
  }

  const salida = buscar(pq, opts, k);
  if (!salida.length) {
    return {
      ...vacia,
      estado: "ausente",
      titular: "No encontramos una norma que responda esto.",
      motivo: "Ningún pasaje de la base trata esta materia.",
      conceptos_fuera: [],
    };
  }

  const p = salida[0];
  const exigeDato = TIPOS_CON_DATO.includes(pq.tipo);
  const datoOk = p.tieneDato || !exigeDato;
  const umbral = exigeDato && p.tieneDato ? UMBRAL_ENCONTRADO : UMBRAL_ENCONTRADO_SIN_DATO;
  const raicesFrase = raices(p.frase);
  const literal = exigeDato || pq.conceptos.every((c) => raicesFrase.has(c.raiz));

  let estado: Estado;
  let titular: string;
  let motivo: string;
  if (p.coberturaFrase >= umbral && p.coberturaPasaje >= UMBRAL_PASAJE_ENCONTRADO && datoOk && p.nucleo && literal) {
    estado = "encontrado";
    titular = "Encontrado en la norma";
    motivo = "La frase destacada responde la pregunta.";
  } else if ((p.coberturaPasaje >= UMBRAL_PARCIAL || p.coberturaFrase >= UMBRAL_PARCIAL) && principalEn(p, pq)) {
    estado = "parcial";
    titular = "Respuesta parcial: revisa si aplica a tu caso";
    if (exigeDato && !p.tieneDato) {
      const faltante: Record<string, string> = {
        plazo: "un plazo",
        monto: "un monto",
        temperatura: "una temperatura",
        definicion: "una definición",
        quien: "quién debe hacerlo",
      };
      motivo = "Encontramos la norma relacionada, pero su texto no indica " + faltante[pq.tipo] + " para lo que preguntas.";
    } else {
      motivo = "La norma más cercana trata el tema, pero no responde toda la pregunta.";
    }
  } else {
    estado = "ausente";
    titular = "No encontramos una norma que responda esto.";
    motivo = "Los textos más cercanos tratan otra materia. Prueba con otras palabras o consúltanos.";
  }

  const principal = resultadoPublico(p, pq);
  const relacionadas = salida.slice(1).map((c) => resultadoPublico(c, pq));

  const avisos: string[] = [];
  if (estado !== "ausente" && pq.tipo === "plazo") {
    // norma → {plazo normalizado → plazo tal como está escrito}
    const vistos = new Map<string, Map<string, string>>();
    for (const c of salida.slice(0, 3)) {
      if (!c.tieneDato) continue;
      const cant = new Map<string, string>();
      for (const m of c.frase.matchAll(cue("plazo", true) as RegExp)) {
        const original = m[0].replace(/\s+/g, " ").trim();
        const clave = normalizar(original).replace(/\s+/g, " ");
        if (!cant.has(clave)) cant.set(clave, original);
      }
      if (!cant.size) continue;
      const norma = citaCorta(c.fila).split(" · ")[0];
      const destino = vistos.get(norma) || new Map<string, string>();
      for (const [clave, original] of cant) if (!destino.has(clave)) destino.set(clave, original);
      vistos.set(norma, destino);
    }
    const distintos = new Set([...vistos.values()].map((v) => [...v.keys()].sort().join("|")));
    if (vistos.size >= 2 && distintos.size >= 2) {
      const detalle = [...vistos.entries()]
        .map(([norma, v]) => [...v.values()].sort().join(", ") + " en " + norma)
        .join("; ");
      avisos.push("Las normas encontradas indican plazos distintos (" + detalle + "). Revisa a quién aplica cada uno.");
    }
  }
  if (estado !== "ausente" && !esLey(p.fila) && salida.slice(1, 3).some((c) => esLey(c.fila) && c.coberturaFrase >= UMBRAL_PARCIAL)) {
    avisos.push("También hay texto de ley sobre esto. Si difiere del reglamento, prima la ley.");
  }

  return {
    pregunta,
    tipo: pq.tipo,
    estado,
    titular,
    motivo,
    principal: estado !== "ausente" ? principal : null,
    relacionadas: estado !== "ausente" ? relacionadas : [principal, ...relacionadas],
    avisos,
    conceptos_fuera: [],
  };
}

/** Campos que se siguen guardando en la tabla `consultas` y que usa el panel. */
export function legado(resp: Respuesta): {
  confianza: "alta" | "media" | "baja";
  recomendacion: "responder" | "responder_con_reservas" | "declarar_ausencia";
  cobertura_top: number;
  conceptos_fuera_del_corpus: string[];
  top_cita: string | null;
} {
  const mapa = {
    encontrado: ["alta", "responder"],
    parcial: ["media", "responder_con_reservas"],
    ausente: ["baja", "declarar_ausencia"],
  } as const;
  const [confianza, recomendacion] = mapa[resp.estado];
  const top = resp.principal || resp.relacionadas[0] || null;
  return {
    confianza,
    recomendacion,
    cobertura_top: top ? top._cobertura_frase : 0,
    conceptos_fuera_del_corpus: resp.conceptos_fuera,
    top_cita: top ? top.cita : null,
  };
}

/** Solo para la verificación de paridad con respuesta.py (scripts/paridad-motor.mjs). */
export function crearIndice(rows: CorpusChunk[]): Indice {
  return new Indice(rows);
}
