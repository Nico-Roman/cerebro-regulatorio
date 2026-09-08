#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
norma_registry.py — Registro canónico de normas ANAMED.

Antes, build_corpus.py adivinaba `tipo` y `numero` parseando el nombre del PDF.
Ese parser fallaba en toda la carpeta `otros/` (nombres tal como los publica el
ISP) y en varios nombres con guiones, y el fallo se propagaba en cadena:

    nombre no parseable -> sin tipo/numero
                        -> sin match de vigencia (⚠️ falso)
                        -> titulo = nombre de archivo
                        -> el boost de titulo del ranking los penalizaba

Este módulo invierte la dependencia: la fuente de verdad de los metadatos es el
LISTADO OFICIAL del ISP (snapshot de vigilancia-isp), que ya trae tipo, número,
descripción, fecha, categoría y enlace estructurados. El PDF local se empareja
contra ese listado, en este orden:

    1. basename de la URL de descarga  (resuelve 162 de 163 PDFs)
    2. tipo+número parseados del nombre de archivo (desempata y cubre huecos)
    3. overrides.json                   (curaduría manual, opcional)

Lo que no empareja NO se inventa: queda `no_verificada` y se reporta.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = ROOT / "Asuntos-Regulatorios" / "vigilancia-isp" / "snapshots" / "latest.json"
OVERRIDES = Path(__file__).resolve().parent / "overrides.json"


# --- Normalización ------------------------------------------------------------

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def norm_key(s: str) -> str:
    s = strip_accents(s or "").lower()
    return re.sub(r"\s+", " ", s).strip()


def norm_numero(s: str) -> str:
    """'1.287' -> '1287'; 'A15/01/2016' -> 'A15/01/2016'. Conserva letras y barras."""
    if not s:
        return ""
    return s.strip().upper().replace(".", "").replace(" ", "")


def numero_corto(s: str) -> str:
    """Primer token identificable: 'B6/2015 MINSAL' -> 'B6'; '1287' -> '1287'."""
    n = norm_numero(s)
    m = re.match(r"[A-Z]*\d+[A-Z]*", n)
    return m.group(0) if m else n


# El listado oficial trae erratas de tipeo y de mayúsculas que, si no se
# canonizan, parten la misma norma en dos claves distintas.
TIPO_CANON = {
    "resoucion exenta": "Resolución Exenta",   # errata del ISP en el listado
    "resolucion exenta": "Resolución Exenta",
    "resolucion": "Resolución Exenta",         # en ANAMED todas son exentas; se conserva tipo_original
    "decreto con fuerza de ley": "Decreto con Fuerza de Ley",
    "decreto supremo": "Decreto Supremo",
    "decreto exento": "Decreto Exento",
    "norma tecnica": "Norma Técnica",
    "circular": "Circular",
    "decreto": "Decreto",
    "ley": "Ley",
    "oficio": "Oficio",
}


def canon_tipo(t: str) -> str:
    return TIPO_CANON.get(norm_key(t), (t or "").strip())


# Tipos reconocibles en un nombre de archivo, del más específico al más general.
TIPOS_ARCHIVO = [
    "Decreto con Fuerza de Ley",
    "Decreto Supremo",
    "Decreto Exento",
    "Norma Técnica",
    "Resolución Exenta",
    "Resolucion Exenta",
    "Circular",
    "Decreto",
    "Ley",
    "Oficio",
]


def parse_tipo_numero(stem: str):
    """Deriva (tipo, numero) de un nombre de archivo. Tolera guiones y guiones
    bajos como separadores ('decreto-exento-39_19' -> Decreto Exento 39)."""
    s = (stem or "").strip()
    # Los separadores no alfabéticos rompían el startswith: 'decreto-exento' no
    # empezaba por 'decreto exento'. Se normalizan a espacio solo para comparar.
    flat = norm_key(re.sub(r"[-_]+", " ", s))
    for tipo in TIPOS_ARCHIVO:
        kt = norm_key(tipo)
        if flat.startswith(kt):
            resto = flat[len(kt):].strip()
            m = re.search(r"([A-Za-z]?\d[\d\.\-]*)", resto)
            numero = norm_numero(m.group(1).rstrip(".-")) if m else ""
            return canon_tipo(tipo), numero
    return "", ""


def url_basename(u: str) -> str:
    u = unquote(u or "").split("?")[0].split("#")[0]
    return u.rsplit("/", 1)[-1].strip().lower()


# Palabras que solo introducen la descripción y no la distinguen de otra.
_PREFIJOS_DESC = ("aprueba", "apruebase", "el", "la", "los", "las", "documento",
                  "denominado", "actualizacion", "se")
_STOP_DESC = set("de del la el los las y en para por con a al que sobre su sus un una".split())


def _tokens_desc(d: str):
    toks = re.findall(r"[a-z0-9]+", norm_key(d))
    while toks and toks[0] in _PREFIJOS_DESC:
        toks = toks[1:]
    return {t for t in toks if t not in _STOP_DESC and len(t) > 2}


def misma_norma(a: str, b: str) -> bool:
    """¿Dos filas del listado con el mismo tipo y número son la MISMA norma?

    Casi siempre sí: el ISP repite la norma bajo cada categoría, cambiando solo
    la URL de la copia. Pero a veces NO: hay dos "Resolución Exenta 2.053"
    distintas —una instruye actualizar folletos de Montelukast, otra aprueba las
    Orientaciones del Programa Nacional de Farmacovigilancia— y colapsarlas
    mezcla el título de una con el enlace de la otra. Se comparan por contenido
    de la descripción, no por número."""
    ta, tb = _tokens_desc(a), _tokens_desc(b)
    if not ta or not tb:
        return True  # sin evidencia para separarlas, se conservan juntas
    inter = len(ta & tb)
    return inter / min(len(ta), len(tb)) >= 0.6


# --- Registro -----------------------------------------------------------------

class NormaRegistry:
    """Listado oficial vigente del ISP, colapsado a normas únicas."""

    def __init__(self, snapshot_path: Path = SNAPSHOT):
        data = json.loads(snapshot_path.read_text(encoding="utf-8"))
        self.fetched_at = ""
        self.source_url = ""
        if isinstance(data, dict):
            self.fetched_at = (data.get("fetchedAt") or "")[:10]
            self.source_url = data.get("sourceUrl", "")
            records = data.get("records") or data.get("normas") or []
        else:
            records = data
        self.snapshot_path = snapshot_path

        # Una norma puede figurar en varias categorías del sitio: es la MISMA
        # norma, no varias. Se colapsa por (tipo, numero) y se acumulan las
        # categorías, que es lo que después hace de `--categoria` una partición
        # real en vez de un filtro sobre copias duplicadas del mismo texto.
        self.normas = {}          # norma_id -> registro canónico
        self.by_url = {}          # basename.pdf -> set(norma_id)
        self.by_tn = {}           # (tipo_norm, numero_norm) -> norma_id
        self.by_tn_corto = {}     # (tipo_norm, numero_corto) -> set(norma_id)

        # Índice auxiliar: (tipo, numero) -> [norma_id, …]. Puede tener más de
        # uno cuando el ISP publica dos normas distintas con el mismo número.
        self.ids_por_tn = {}

        for r in records:
            tipo = canon_tipo(r.get("tipo", ""))
            numero = norm_numero(r.get("numero", ""))
            desc = (r.get("descripcion") or "").strip()
            tn = (norm_key(tipo), numero)

            norma_id = None
            for cand in self.ids_por_tn.get(tn, []):
                if misma_norma(self.normas[cand]["descripcion"], desc):
                    norma_id = cand
                    break
            if norma_id is None:
                base_id = norm_key(tipo) + "|" + numero
                norma_id = base_id
                if norma_id in self.normas:
                    # Segunda norma distinta con el mismo número: se desambigua
                    # con el nombre del archivo publicado, que sí es único.
                    sufijo = url_basename(r.get("enlace", "")) or str(len(self.normas))
                    norma_id = base_id + "#" + sufijo
                self.ids_por_tn.setdefault(tn, []).append(norma_id)

            n = self.normas.get(norma_id)
            if n is None:
                n = {
                    "norma_id": norma_id,
                    "tipo": tipo,
                    "tipo_original": (r.get("tipo") or "").strip(),
                    "numero": (r.get("numero") or "").strip(),
                    "numero_norm": numero,
                    "descripcion": (r.get("descripcion") or "").strip(),
                    "fecha": (r.get("fecha") or "").strip(),
                    "enlace": (r.get("enlace") or "").strip(),
                    "modificaciones": (r.get("modificaciones") or "").strip(),
                    "categorias": [],
                    "materias": [],
                }
                self.normas[norma_id] = n
            cat = (r.get("categoria") or "").strip()
            if cat and cat not in n["categorias"]:
                n["categorias"].append(cat)
            mat = (r.get("materia") or "").strip()
            if mat and mat not in n["materias"]:
                n["materias"].append(mat)
            # De las descripciones repetidas se conserva la más larga (la más informativa).
            if len(r.get("descripcion") or "") > len(n["descripcion"]):
                n["descripcion"] = (r.get("descripcion") or "").strip()

            b = url_basename(r.get("enlace", ""))
            if b.endswith(".pdf"):
                self.by_url.setdefault(b, set()).add(norma_id)
            self.by_tn.setdefault(tn, set()).add(norma_id)
            self.by_tn_corto.setdefault((norm_key(tipo), numero_corto(numero)), set()).add(norma_id)

        self.overrides = {}
        if OVERRIDES.exists():
            try:
                raw = json.loads(OVERRIDES.read_text(encoding="utf-8"))
                self.overrides = {k.lower(): v for k, v in (raw.get("documentos") or {}).items()}
            except Exception as e:  # un override malformado no debe tumbar el build
                print("[warn] overrides.json ilegible: " + str(e), file=sys.stderr)

    # -- resolución ------------------------------------------------------------

    def resolve(self, pdf_path: Path):
        """Empareja un PDF local con su norma oficial.
        Devuelve (registro|None, metodo, confianza)."""
        basename = pdf_path.name.lower()
        stem = pdf_path.stem

        ov = self.overrides.get(basename)
        if ov:
            if ov.get("tipo") or ov.get("numero"):
                nid = norm_key(canon_tipo(ov.get("tipo", ""))) + "|" + norm_numero(ov.get("numero", ""))
                if nid in self.normas:
                    return self.normas[nid], "override", "alta"
            if ov.get("titulo"):
                # Documento fuera del listado oficial con metadata curada a mano.
                # La vigencia NUNCA se declara vigente por esta vía: solo el
                # listado del ISP certifica vigencia.
                return {
                    "norma_id": "manual:" + basename,
                    "tipo": canon_tipo(ov.get("tipo", "")),
                    "tipo_original": ov.get("tipo", ""),
                    "numero": ov.get("numero", ""),
                    "numero_norm": norm_numero(ov.get("numero", "")),
                    "descripcion": ov["titulo"],
                    "fecha": ov.get("fecha", ""),
                    "enlace": ov.get("fuente_url", ""),
                    "modificaciones": "",
                    "categorias": ov.get("categorias", []),
                    "materias": [],
                    "vigencia_manual": "no_verificada",
                }, "override_manual", "manual"

        cands = self.by_url.get(basename)
        if cands:
            if len(cands) == 1:
                return self.normas[next(iter(cands))], "url", "alta"
            # El ISP reutiliza el mismo nombre de archivo para normas distintas
            # (p. ej. 'resolución exenta 201.pdf' sirve a la 201 y a la 15.566).
            # El nombre del archivo local desempata.
            tipo, numero = parse_tipo_numero(stem)
            if numero:
                for nid in sorted(cands):
                    n = self.normas[nid]
                    if n["numero_norm"] == numero or numero_corto(n["numero_norm"]) == numero_corto(numero):
                        return n, "url+archivo", "alta"
            return self.normas[sorted(cands)[0]], "url", "ambigua"

        tipo, numero = parse_tipo_numero(stem)
        if tipo and numero:
            cands = self.by_tn.get((norm_key(tipo), numero))
            if cands:
                if len(cands) == 1:
                    return self.normas[next(iter(cands))], "tipo+numero", "alta"
                # Hay dos normas distintas con este tipo y número: sin la URL no
                # se puede decidir cuál es, y adivinar mezclaría el título de una
                # con el enlace de la otra.
                return self.normas[sorted(cands)[0]], "tipo+numero", "ambigua"
            cands = self.by_tn_corto.get((norm_key(tipo), numero_corto(numero)))
            if cands and len(cands) == 1:
                return self.normas[next(iter(cands))], "tipo+numero(corto)", "media"

        return None, "sin_match", "nula"

    def vigencia_fuente(self) -> str:
        """Procedencia real de la vigencia, leída del snapshot (no escrita a mano)."""
        return "listado oficial ISP (snapshot " + (self.fetched_at or "fecha desconocida") + ")"


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    reg = NormaRegistry()
    print("snapshot: " + reg.snapshot_path.name + "  fetchedAt=" + reg.fetched_at)
    print("normas únicas en el listado oficial: " + str(len(reg.normas)))
    anamed = ROOT / "Asuntos-Regulatorios" / "ANAMED_Normativa"
    metodos = {}
    for p in sorted(anamed.glob("*/*.pdf")):
        n, m, c = reg.resolve(p)
        metodos[m] = metodos.get(m, 0) + 1
        if m == "sin_match":
            print("  [sin match] " + p.parent.name + "/" + p.name)
        elif c != "alta":
            print("  [" + c + "/" + m + "] " + p.name + " -> " + (n["tipo"] + " " + n["numero"] if n else "—"))
    print("métodos: " + json.dumps(metodos, ensure_ascii=False))
