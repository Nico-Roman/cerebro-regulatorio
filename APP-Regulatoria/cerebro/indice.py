#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
indice.py — Índice invertido persistente del Cerebro Regulatorio.

Antes, cada consulta releía corpus.jsonl entero, tokenizaba los ~4.800 pasajes y
armaba BM25 desde cero (~1,5 s por consulta, lineal en el tamaño del corpus).
Peor: el índice se construía sobre el subconjunto ya filtrado por `--vigente` /
`--categoria`, así que el IDF —y por tanto el ranking— cambiaba según el filtro.

Aquí el índice se construye UNA vez sobre el corpus completo (IDF estable), se
serializa a `corpus/indice.pkl` y se reutiliza mientras el .pkl sea más nuevo que
el corpus.jsonl. Los filtros se aplican después de puntuar, no antes.

Estructura: índice invertido `término -> [(doc_idx, tf), …]`, que además cambia
el costo de puntuar de O(N × términos) a O(postings de la consulta).

Sin dependencias externas (pickle + stdlib).
"""

import json
import math
import pickle
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DIR = Path(__file__).resolve().parent
CORPUS = DIR / "corpus" / "corpus.jsonl"
INDEX = DIR / "corpus" / "indice.pkl"

# Versión del formato del índice: si cambia la tokenización o la estructura,
# subirla invalida los .pkl viejos en vez de servir un índice incoherente.
INDEX_VERSION = 4

K1 = 1.5
B = 0.75

STOPWORDS = set("""
a al algo alguna algunas alguno algunos ante antes como con contra cual cuando de del desde donde
dos el ella ellas ellos en entre era erais eran eres es esa esas ese eso esos esta estas este esto
estos fin fue fueron ha han hasta hay la las le les lo los mas más me mi mis mucho muchos muy nada ni
no nos o os otra otras otro otros para pero poco por porque que qué se sea sean segun según si sí sin
sobre su sus tan te tiene tienen toda todas todo todos tras tu tus un una unas uno unos y ya
articulo artículo art numero número norma
""".split())


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


WORD_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    toks = WORD_RE.findall(strip_accents((text or "").lower()))
    return [t for t in toks if len(t) >= 2 and t not in STOPWORDS]


# Sufijos flexivos del español, del más largo al más corto. Se usan SOLO para
# medir cobertura de la consulta (¿aparece este concepto en los pasajes?), no
# para indexar: la puntuación BM25 sigue trabajando sobre la palabra tal cual,
# así el ranking no cambia y el puerto TypeScript no se desincroniza.
# Sin esto, "seleccionan" no reconoce a "selección" y una pregunta perfectamente
# respondible se declara fuera del corpus.
_SUFIJOS = (
    "amientos", "amiento", "aciones", "acion", "ancias", "encias", "ciones", "cion",
    "adoras", "adores", "adora", "ador", "antes", "ante", "ables", "able", "ibles", "ible",
    "aremos", "eremos", "iremos", "abamos", "amos", "aron", "ieron", "aban", "ando", "iendo",
    "ados", "adas", "idos", "idas", "ado", "ada", "ido", "ida",
    "mente", "icos", "icas", "ico", "ica", "ivos", "ivas", "ivo", "iva",
    "aran", "aren", "asen", "ase", "ara", "are",
    "ias", "ios", "ia", "io", "an", "en", "es", "os", "as", "a", "e", "o", "s",
)


def stem(t):
    """Raíz aproximada y conservadora: nunca deja menos de 4 caracteres."""
    if len(t) <= 4 or t.isdigit():
        return t
    for suf in _SUFIJOS:
        if t.endswith(suf) and len(t) - len(suf) >= 4:
            return t[:-len(suf)]
    return t


class Indice:
    """Índice invertido BM25 sobre el corpus completo."""

    def __init__(self, rows):
        self.rows = rows
        self.N = len(rows)
        self.doc_len = [0] * self.N
        self.postings = defaultdict(list)
        self.title_tokens = []
        df = defaultdict(int)
        stem_df = defaultdict(int)
        for i, r in enumerate(rows):
            toks = tokenize(r.get("texto", ""))
            self.doc_len[i] = len(toks)
            for term, f in Counter(toks).items():
                self.postings[term].append((i, f))
                df[term] += 1
            for s_ in {stem(t) for t in toks}:
                stem_df[s_] += 1
            self.title_tokens.append(frozenset(tokenize(r.get("titulo", ""))))
        self.postings = dict(self.postings)
        self.avgdl = (sum(self.doc_len) / self.N) if self.N else 0.0
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
        # IDF por RAÍZ: es el peso honesto de un concepto. Sin esto, una palabra
        # de la pregunta que solo cambia de desinencia ("dedicado" frente a
        # "dedicada") se contaba como ausente del corpus y recibía el peso
        # máximo teórico, hundiendo la confianza de consultas legítimas.
        self.stem_idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in stem_df.items()}

    # -- puntuación ------------------------------------------------------------

    def scores(self, q_tokens):
        """BM25 sobre el corpus completo. Devuelve lista de N puntajes."""
        scores = [0.0] * self.N
        avgdl = self.avgdl or 1.0
        for term in set(q_tokens):
            idf = self.idf.get(term)
            if idf is None:
                continue
            for i, f in self.postings.get(term, ()):
                denom = f + K1 * (1 - B + B * self.doc_len[i] / avgdl)
                scores[i] += idf * (f * (K1 + 1)) / denom
        return scores

    @property
    def idf_max(self):
        return math.log(1 + (self.N + 0.5) / 0.5)

    def idf_de(self, term):
        """IDF de un término; los ausentes del corpus valen el máximo teórico
        (son justamente los que delatan que la consulta cae fuera del corpus)."""
        if term in self.idf:
            return self.idf[term]
        return self.idf_max

    def idf_raiz(self, raiz):
        """IDF del concepto, no de la desinencia. Un concepto ausente de todo el
        corpus conserva el peso máximo: es la señal de 'esto no está aquí'."""
        table = getattr(self, "stem_idf", None) or {}
        if raiz in table:
            return table[raiz]
        return self.idf_max

    # -- persistencia ----------------------------------------------------------

    def to_payload(self, corpus_path):
        st = corpus_path.stat()
        return {
            "version": INDEX_VERSION,
            "mtime": st.st_mtime,
            "size": st.st_size,
            "rows": self.rows,
            "doc_len": self.doc_len,
            "postings": self.postings,
            "avgdl": self.avgdl,
            "idf": self.idf,
            "stem_idf": self.stem_idf,
            "title_tokens": self.title_tokens,
        }

    @classmethod
    def from_payload(cls, p):
        obj = cls.__new__(cls)
        obj.rows = p["rows"]
        obj.N = len(obj.rows)
        obj.doc_len = p["doc_len"]
        obj.postings = p["postings"]
        obj.avgdl = p["avgdl"]
        obj.idf = p["idf"]
        obj.stem_idf = p.get("stem_idf", {})
        obj.title_tokens = p["title_tokens"]
        return obj


def load_rows(corpus_path=CORPUS):
    if not corpus_path.exists():
        sys.exit("No existe " + str(corpus_path) + ". Corre primero build_corpus.py")
    with corpus_path.open(encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def build(corpus_path=CORPUS):
    return Indice(load_rows(corpus_path))


def save(idx, corpus_path=CORPUS, index_path=INDEX):
    index_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = index_path.with_suffix(".pkl.tmp")
    with tmp.open("wb") as fh:
        pickle.dump(idx.to_payload(corpus_path), fh, protocol=pickle.HIGHEST_PROTOCOL)
    tmp.replace(index_path)
    return index_path


def load(corpus_path=CORPUS, index_path=INDEX, autobuild=True):
    """Devuelve el índice, reutilizando el .pkl si sigue vigente frente al corpus."""
    if index_path.exists() and corpus_path.exists():
        try:
            with index_path.open("rb") as fh:
                p = pickle.load(fh)
            st = corpus_path.stat()
            if (p.get("version") == INDEX_VERSION
                    and abs(p.get("mtime", 0) - st.st_mtime) < 1e-6
                    and p.get("size") == st.st_size):
                return Indice.from_payload(p)
        except Exception as e:  # índice corrupto o de otra versión: se rehace
            print("[warn] índice en caché ilegible (" + str(e) + "); se reconstruye", file=sys.stderr)
    idx = build(corpus_path)
    if autobuild:
        try:
            save(idx, corpus_path, index_path)
        except Exception as e:
            print("[warn] no se pudo guardar el índice: " + str(e), file=sys.stderr)
    return idx


if __name__ == "__main__":
    import time
    t0 = time.time()
    idx = build()
    t1 = time.time()
    save(idx)
    t2 = time.time()
    load()
    t3 = time.time()
    print("construir: %.2fs · guardar: %.2fs · cargar: %.2fs · %d pasajes · %d términos"
          % (t1 - t0, t2 - t1, t3 - t2, idx.N, len(idx.idf)))
