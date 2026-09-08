#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_corpus.py — Pipeline de ingesta del Cerebro Regulatorio.

Toma el corpus local de normativa ANAMED (PDFs + OCR ya hecho), lo cruza con:
  - el LISTADO OFICIAL del ISP (snapshot de vigilancia-isp) como fuente de verdad
    de tipo, número, descripción, fecha, categoría, enlace y vigencia,
  - el catálogo curado del vault Obsidian (complemento, ya no fuente primaria),
y produce:
  - corpus/corpus.jsonl        -> un registro por chunk, con cita trazable,
  - corpus/metadata.json       -> un registro por documento,
  - corpus/modificaciones.json -> grafo de modificaciones a nivel de disposición,
  - corpus/indice.pkl          -> índice invertido BM25 listo para consultar,
  - corpus/audit-report.md     -> auditoría de cobertura y calidad.

Reglas de oro:
  - Ningún documento entra al índice sin metadatos de vigencia; lo que no
    empareja queda marcado `no_verificada` y se reporta, no se oculta.
  - El texto legal NO se reescribe. Los defectos de OCR se SEÑALAN
    (`alertas_ocr`), nunca se corrigen en silencio: en una herramienta cuyo
    producto es la trazabilidad, una cifra "arreglada" es peor que una marcada.

Sin dependencias externas más allá de PyMuPDF (fitz).
"""

import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from datetime import date
from urllib.parse import unquote

import fitz  # PyMuPDF

import indice as IX
import modificaciones as MOD
from norma_registry import NormaRegistry, norm_key, norm_numero, parse_tipo_numero

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# --- Rutas del proyecto -------------------------------------------------------
# La raíz del REPO, no la del disco de nadie. Antes esto era parents[3] más el
# literal "Asuntos-Regulatorios", lo que ataba el pipeline al árbol de carpetas
# de un PC concreto: en un runner de CI la ruta no existe. Ahora se deriva de la
# ubicación del propio archivo dentro del repo, así que resuelve igual en el PC
# y en GitHub Actions. REGULAMED_ANAMED_DIR permite apuntar los PDF a otra parte
# (caché de CI, disco externo) sin tocar código.
ROOT = Path(__file__).resolve().parents[2]  # raíz del repo
ANAMED_DIR = Path(os.environ.get("REGULAMED_ANAMED_DIR") or (ROOT / "ANAMED_Normativa"))
VAULT_DIR = Path.home() / "Documents" / "Obsidian Vault" / "Asuntos Regulatorios" / "Normativa ANAMED"

OUT_DIR = Path(__file__).resolve().parent / "corpus"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Umbral: si un PDF entrega menos de este nº de caracteres de texto nativo,
# se considera escaneo y se busca el sidecar OCR (.txt).
NATIVE_TEXT_MIN = 200
CHUNK_CHARS = 1500
CHUNK_OVERLAP = 250


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def slug_categoria(c: str) -> str:
    """'Establecimientos, Autorización y Fiscalización' -> 'establecimientos_autorizacion_y_fiscalizacion'.
    Deja las categorías del listado oficial alineadas con las carpetas locales,
    que es lo que convierte `--categoria` en una partición real."""
    s = strip_accents(c or "").lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


# --- Carga del catálogo del vault (metadatos curados, complementarios) --------

def load_vault_catalog():
    """basename_pdf(lower) -> {descripcion, fecha, ult_mod, fuente_url}."""
    catalog = {}
    if not VAULT_DIR.exists():
        print("[warn] vault no encontrado: " + str(VAULT_DIR), file=sys.stderr)
        return catalog
    for md in VAULT_DIR.glob("ANAMED — *.md"):
        text = md.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 5 or norm_key(cells[0]) in ("norma", "---", ""):
                continue
            enlaces = cells[-1]
            m_pdf = re.search(r"ANAMED_Normativa/[^)\s]*?\.pdf", enlaces)
            if not m_pdf:
                continue
            basename = Path(unquote(m_pdf.group(0))).name.lower()
            m_url = re.search(r"https?://[^)\s]+", enlaces)
            catalog[basename] = {
                "descripcion": cells[1],
                "fecha": cells[2],
                "ult_mod": cells[3],
                "fuente_url": unquote(m_url.group(0)) if m_url else "",
            }
    return catalog


# --- Extracción de texto ------------------------------------------------------

PAGE_NUM_RE = re.compile(r"(?i)^\s*p[aá]gina\s+\d+\s+de\s+\d+\s*$")
_DIGIT_RUN_RE = re.compile(r"\d+")


def _normalize_line_for_repeat(line: str) -> str:
    s = _DIGIT_RUN_RE.sub("#", line.strip())
    return re.sub(r"\s+", " ", s).lower()


def strip_boilerplate_pages(pages: list) -> list:
    """Quita líneas repetidas en >= 40% de las páginas (sellos, membretes)."""
    n = len(pages)
    if n < 2:
        return [PAGE_NUM_RE.sub("", p) for p in pages]

    line_pages = {}
    for i, page in enumerate(pages):
        seen_this_page = set()
        for line in page.split("\n"):
            norm = _normalize_line_for_repeat(line)
            if not norm or norm in seen_this_page:
                continue
            seen_this_page.add(norm)
            line_pages.setdefault(norm, set()).add(i)

    threshold = max(2, round(n * 0.4))
    boilerplate = {norm for norm, pset in line_pages.items() if len(pset) >= threshold}

    cleaned = []
    for page in pages:
        kept = [
            line for line in page.split("\n")
            if _normalize_line_for_repeat(line) not in boilerplate and not PAGE_NUM_RE.match(line)
        ]
        cleaned.append("\n".join(kept))
    return cleaned


def strip_boilerplate_ocr(text: str) -> str:
    lines = text.split("\n")
    counts = Counter(_normalize_line_for_repeat(l) for l in lines if l.strip())
    boilerplate = {norm for norm, c in counts.items() if c >= 2 and len(norm) <= 120}
    kept = [
        line for line in lines
        if _normalize_line_for_repeat(line) not in boilerplate and not PAGE_NUM_RE.match(line)
    ]
    return "\n".join(kept)


# El sidecar OCR se busca sin distinguir mayusculas de minusculas a proposito.
#
# actualizar-diario.js baja los PDF con el basename de la URL en minusculas
# ("decreto exento 1.284.pdf"), mientras que los 65 sidecars versionados en el
# repo conservan la capitalizacion original ("Decreto Exento 1.284.txt"). En
# Windows el sistema de archivos no distingue y pareaban solos; en Linux si
# distingue, y el 2026-09-08 eso dejo 59 PDF escaneados como "vacio" en GitHub
# Actions, con el recall en 68.8% contra un gate de 90%.
#
# El indice por carpeta se cachea: extract_pages() se llama una vez por PDF y
# escanear el directorio cada vez seria cuadratico.
_SIDECARS_POR_DIR: dict = {}


def buscar_sidecar(pdf_path: Path):
    """El .txt hermano del PDF, ignorando mayusculas. None si no existe."""
    exacto = pdf_path.with_suffix(".txt")
    if exacto.exists():
        return exacto
    carpeta = pdf_path.parent
    clave = str(carpeta)
    if clave not in _SIDECARS_POR_DIR:
        try:
            _SIDECARS_POR_DIR[clave] = {
                f.name.lower(): f for f in carpeta.iterdir()
                if f.suffix.lower() == ".txt"
            }
        except OSError:
            _SIDECARS_POR_DIR[clave] = {}
    return _SIDECARS_POR_DIR[clave].get(exacto.name.lower())


def extract_pages(pdf_path: Path):
    """(lista_de_textos_por_pagina, fuente_texto in {'nativo','ocr','vacio'})."""
    pages = []
    try:
        doc = fitz.open(pdf_path)
        pages = [p.get_text("text") for p in doc]
        doc.close()
    except Exception as e:
        print("[warn] fitz no pudo abrir " + pdf_path.name + ": " + str(e), file=sys.stderr)
        pages = []
    total = sum(len(t.strip()) for t in pages)
    if total >= NATIVE_TEXT_MIN:
        return strip_boilerplate_pages(pages), "nativo"
    txt = buscar_sidecar(pdf_path)
    if txt is not None:
        ocr = txt.read_text(encoding="utf-8", errors="replace")
        ocr = re.sub(r"^\s*\[Texto reconocido por OCR[^\]]*\]\s*", "", ocr)
        ocr = strip_boilerplate_ocr(ocr)
        if len(ocr.strip()) >= NATIVE_TEXT_MIN:
            return [ocr], "ocr"
    return pages, "vacio"


# --- Alertas de OCR (hallazgo 04) --------------------------------------------

# El OCR corrompe justamente los números, que son el producto de esta herramienta.
# Casos reales del corpus: "los artículos 949 y 1029 del Código Sanitario"
# (son el 94 y el 102), "Decreto Supremo N9 03", "cenimefQG6ispch.cl".
# No se corrigen: se marcan, para que la capa de síntesis avise y remita al PDF.
_ART_LARGO_RE = re.compile(r"(?i)\bart[ií]culos?\s+(\d{3,})")
_NUM_SIGN_ROTO_RE = re.compile(r"(?<![A-Za-z0-9])[Nn][2*?e9](?=\s*\d)")
_MAIL_ROTO_RE = re.compile(r"[A-Za-z0-9._%-]+[A-Z0-9]{2,}[A-Za-z0-9._%-]*(?<!@)\.(?:cl|com)\b")

# Códigos chilenos citados habitualmente y su artículo más alto plausible.
_MAX_ART_PLAUSIBLE = 400


def alertas_ocr(texto: str) -> list:
    alertas = []
    for m in _ART_LARGO_RE.finditer(texto):
        n = m.group(1)
        if int(n) > _MAX_ART_PLAUSIBLE:
            alertas.append("cifra de artículo inusual (posible dígito añadido por OCR): «" + m.group(0) + "»")
    if _NUM_SIGN_ROTO_RE.search(texto):
        ejemplos = sorted({m.group(0) for m in _NUM_SIGN_ROTO_RE.finditer(texto)})
        alertas.append("símbolo «N°» mal reconocido: " + ", ".join("«" + e + "»" for e in ejemplos[:4]))
    if re.search(r"@", texto) is None and _MAIL_ROTO_RE.search(texto):
        m = _MAIL_ROTO_RE.search(texto)
        alertas.append("posible correo sin «@» por OCR: «" + m.group(0)[:40] + "»")
    # Dedup preservando orden
    out, seen = [], set()
    for a in alertas:
        if a not in seen:
            seen.add(a)
            out.append(a)
    return out[:4]


# --- Chunking por unidad normativa -------------------------------------------

ART_RE = re.compile(
    r"(?im)^\s*(art[íi]culo|art\.)\s+([0-9]+[º°]?|primero|segundo|tercero|cuarto|quinto|sexto|séptimo|septimo|octavo|noveno|décimo|decimo)\b"
)


def clean_text(t: str) -> str:
    t = t.replace("­", "")  # soft hyphen
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def build_page_offsets(pages):
    full, offsets, pos = [], [], 0
    for i, ptext in enumerate(pages, start=1):
        offsets.append((pos, i))
        full.append(ptext)
        pos += len(ptext) + 1
    return "\n".join(full), offsets


def page_at(offset, offsets):
    page = 1
    for start, p in offsets:
        if offset >= start:
            page = p
        else:
            break
    return page


PARA_BREAK_RE = re.compile(r"\n\s*\n")
SENT_END_RE = re.compile(r"(?<=[.!?:])\s+(?=[A-ZÁÉÍÓÚÑ0-9(\"“])")


def split_into_units(text: str):
    units = []
    seps = list(PARA_BREAK_RE.finditer(text))
    bounds = [0] + [s.end() for s in seps]
    ends = [s.start() for s in seps] + [len(text)]
    for start, end in zip(bounds, ends):
        seg = text[start:end]
        if not seg.strip():
            continue
        real_start = start + (len(seg) - len(seg.lstrip()))
        real_end = end - (len(seg) - len(seg.rstrip()))
        if real_end - real_start <= CHUNK_CHARS:
            units.append((real_start, real_end))
            continue
        pos = real_start
        for sm in SENT_END_RE.finditer(text, real_start, real_end):
            units.append((pos, sm.start()))
            pos = sm.end()
        if pos < real_end:
            units.append((pos, real_end))
    return [u for u in units if text[u[0]:u[1]].strip()]


def pack_units(text: str, units, offsets):
    chunks = []
    n = len(units)
    i = 0
    while i < n:
        j, cur_len = i, 0
        while j < n:
            ulen = units[j][1] - units[j][0]
            if j > i and cur_len + ulen > CHUNK_CHARS and cur_len >= CHUNK_CHARS * 0.4:
                break
            cur_len += ulen
            j += 1
        start, end = units[i][0], units[j - 1][1]
        seg = text[start:end].strip()
        if seg:
            chunks.append({"text": seg, "page": page_at(start, offsets), "label": "", "offset": start})
        if j >= n:
            break
        back, overlap = j - 1, 0
        while back > i and overlap < CHUNK_OVERLAP:
            overlap += units[back][1] - units[back][0]
            back -= 1
        i = max(back + 1, i + 1)
    return chunks


def chunk_document(pages):
    """Lista de {text, page, label, offset} + el texto completo del documento."""
    full, offsets = build_page_offsets(pages)
    full = clean_text(full)
    if not full:
        return [], ""

    heads = list(ART_RE.finditer(full))
    chunks = []
    if len(heads) >= 2:
        bounds = [h.start() for h in heads] + [len(full)]
        # Lo anterior al primer artículo (vistos/considerandos) también se indexa.
        if bounds[0] > 200:
            pre = full[:bounds[0]]
            units = split_into_units(pre)
            chunks.extend(pack_units(full, [(u0, u1) for u0, u1 in units], offsets))
        for i in range(len(heads)):
            seg_start, seg_end = bounds[i], bounds[i + 1]
            label = heads[i].group(0).strip()
            if seg_end - seg_start <= CHUNK_CHARS * 1.6:
                seg = full[seg_start:seg_end].strip()
                if seg:
                    chunks.append({"text": seg, "page": page_at(seg_start, offsets),
                                   "label": label, "offset": seg_start})
                continue
            units = [(seg_start + u0, seg_start + u1) for u0, u1 in split_into_units(full[seg_start:seg_end])]
            for c in pack_units(full, units, offsets):
                c["label"] = label
                chunks.append(c)
    else:
        units = split_into_units(full)
        chunks = pack_units(full, units, offsets)
    return [c for c in chunks if len(c["text"]) >= 60], full


# --- Secciones: preámbulo vs. parte resolutiva (hallazgo 09) ------------------

# Los VISTOS y CONSIDERANDOS son densos en vocabulario jurídico, así que puntúan
# alto en BM25 y le ganan al pasaje que trae la obligación concreta. Etiquetarlos
# permite que el ranking los descuente en vez de gastar cupos en texto ceremonial.
RESOLUTIVO_RE = re.compile(
    r"(?im)^\W{0,4}(?:por\s+tanto|resuelvo|resuelve|se\s+resuelve|resoluci[oó]n\s*:|"
    r"decreto\s*:|decreta\s*:|dicto\s+lo\s+siguiente|decreto\s+lo\s+siguiente)\b"
)
# Muchas resoluciones del ISP (sobre todo las que entran por OCR) no traen un
# "RESUELVO" legible: la parte resolutiva arranca directamente en "1.-".
PRIMER_NUMERAL_RE = re.compile(r"(?m)^\W{0,4}1\s*[º°]?\s*[\.\-\)]")
PREAMBULO_MARCA_RE = re.compile(
    r"(?im)^\W{0,4}(vistos?|considerando|teniendo\s+presente|visto\s+lo\s+dispuesto|"
    r"visto\s+estos\s+antecedentes)\b"
)
PREAMBULO_INICIO_RE = re.compile(
    r"(?i)^\W{0,4}(vistos?|considerando|teniendo\s+presente|con\s+esta\s+fecha|"
    r"habiendo|visto\s+lo\s+dispuesto)\b"
)
ANEXO_RE = re.compile(r"(?im)^\s*anexo\s+(?:n[°º\.]?\s*)?\d")


def marcar_secciones(full_text, chunks):
    """Etiqueta cada chunk como 'preambulo' | 'resolutivo' | 'articulado' | 'anexo'."""
    n = len(full_text or "")
    pre_m = PREAMBULO_MARCA_RE.search(full_text)
    pre_start = pre_m.start() if pre_m else 0

    m = RESOLUTIVO_RE.search(full_text, pre_start)
    corte = m.start() if m else None
    if corte is None:
        # Sin marcador explícito: la parte resolutiva empieza en el primer "1.-"
        # que aparezca después de un tramo razonable de vistos/considerandos.
        m2 = PRIMER_NUMERAL_RE.search(full_text, pre_start + 300)
        corte = m2.start() if m2 else None
    # Un corte demasiado tardío (>85% del documento) suele ser una cita, no el
    # inicio real de la parte resolutiva: en ese caso no se usa.
    if corte is not None and n and corte > n * 0.85:
        corte = None

    anexo_m = ANEXO_RE.search(full_text)
    anexo_off = anexo_m.start() if anexo_m else None

    for c in chunks:
        off = c.get("offset", 0)
        texto = c["text"].lstrip()
        if c["label"]:
            seccion = "articulado"
        elif anexo_off is not None and off >= anexo_off:
            seccion = "anexo"
        elif corte is not None:
            seccion = "preambulo" if pre_start <= off < corte else "resolutivo"
        elif PREAMBULO_INICIO_RE.match(texto):
            seccion = "preambulo"
        else:
            seccion = "resolutivo"
        # Un chunk que arranca con VISTOS/CONSIDERANDO es preámbulo aunque el
        # detector de corte haya fallado.
        if seccion != "articulado" and PREAMBULO_INICIO_RE.match(texto):
            seccion = "preambulo"
        c["seccion"] = seccion
    return chunks


# --- Título ------------------------------------------------------------------

TITULO_VERBOS = (
    "aprueba", "modifica", "establece", "deroga", "instruye", "dicta", "fija",
    "actualiza", "sustituye", "reemplaza", "complementa", "declara", "autoriza",
    "delega", "crea", "define", "regula", "imparte", "sobre", "norma",
)


def titulo_desde_texto(full_text: str) -> str:
    """Deriva un título legible del propio documento cuando no hay uno curado.
    Evita que el título sea el nombre de archivo, que además de ilegible
    envenenaba el boost de título del ranking."""
    if not full_text:
        return ""
    cabeza = full_text[:2500]
    for raw in cabeza.split("\n"):
        line = re.sub(r"\s+", " ", raw).strip(" .-—·|")
        if not (25 <= len(line) <= 220):
            continue
        low = strip_accents(line).lower()
        if low.startswith(("visto", "considerando", "teniendo presente", "republica de chile",
                           "ministerio", "instituto de salud", "santiago", "num.", "numero")):
            continue
        letras = [c for c in line if c.isalpha()]
        if not letras:
            continue
        mayus = sum(1 for c in letras if c.isupper()) / len(letras)
        if mayus > 0.6 or low.startswith(TITULO_VERBOS):
            return line[:200]
    return ""


def titulo_desde_archivo(stem: str) -> str:
    s = re.sub(r"[-_]+", " ", stem)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# --- Pipeline principal -------------------------------------------------------

def prioridad_texto(fuente):
    return {"nativo": 0, "ocr": 1, "vacio": 2}.get(fuente, 3)


# Ancho de banda para comparar volumen de texto entre copias de una misma norma.
# Dentro de la misma banda las copias se consideran equivalentes y decide la
# calidad de extracción (nativo > OCR); entre bandas distintas gana la que trae
# más texto.
BANDA_TEXTO = 4000


def clave_canonica(d):
    """Elige qué copia de una norma se indexa.

    Preferir texto nativo sobre OCR es correcto *a igualdad de contenido*, pero
    no siempre: hay PDFs cuya capa nativa es solo la carátula. La Res. Ex. 2.627
    tenía 743 caracteres nativos frente a 5.636 de su copia OCR — quedarse con
    el nativo habría borrado la norma entera del índice. Por eso el volumen de
    texto manda primero, por bandas, y la calidad de extracción desempata."""
    n = len(d["full_text"])
    return (-(n // BANDA_TEXTO), prioridad_texto(d["fuente_texto"]), -n,
            d["carpeta"], d["stem"])


def main():
    catalog = load_vault_catalog()
    reg = NormaRegistry()
    vig_fuente = reg.vigencia_fuente()
    print("[info] catálogo vault: " + str(len(catalog)) + " PDFs  |  listado oficial: "
          + str(len(reg.normas)) + " normas únicas  |  snapshot: " + (reg.fetched_at or "?"))

    stats = {"pdfs": 0, "docs_indexados": 0, "duplicados_colapsados": 0, "chunks": 0,
             "nativo": 0, "ocr": 0, "vacio": 0, "match_oficial": 0, "sin_match": 0,
             "sin_metadata_vault": 0, "chunks_con_alerta_ocr": 0,
             "chunks_disposicion_modificada": 0, "docs_modificados": 0}

    # -- Paso 1: extraer y trocear todos los PDFs ------------------------------
    documentos = []
    pdfs = sorted(ANAMED_DIR.glob("*/*.pdf"))
    for pdf in pdfs:
        if "_duplicados_a_revisar" in pdf.parts:
            continue
        stats["pdfs"] += 1
        carpeta = pdf.parent.name
        pages, fuente_texto = extract_pages(pdf)
        chunks, full_text = chunk_document(pages)
        chunks = marcar_secciones(full_text, chunks)

        norma, metodo, confianza = reg.resolve(pdf)
        vault = catalog.get(pdf.name.lower(), {})

        documentos.append({
            "pdf": pdf, "carpeta": carpeta, "stem": pdf.stem,
            "pages": None, "chunks": chunks, "full_text": full_text,
            "fuente_texto": fuente_texto, "norma": norma,
            "metodo": metodo, "confianza": confianza, "vault": vault,
        })

    # -- Paso 2: colapsar copias de la misma norma (hallazgo 06) ---------------
    # El sitio del ISP lista la misma norma bajo varias categorías, así que el
    # mismo PDF vivía en varias carpetas y su texto entraba varias veces al
    # índice: ~48% del corpus era texto idéntico repetido, lo que además
    # devaluaba el IDF de los términos propios de esas normas. Ahora se indexa
    # UNA copia y se conservan todas sus categorías.
    grupos = defaultdict(list)
    for d in documentos:
        clave = d["norma"]["norma_id"] if d["norma"] else "archivo:" + d["carpeta"] + "/" + d["stem"]
        grupos[clave].append(d)

    canonicos = []
    for clave, grupo in grupos.items():
        grupo.sort(key=clave_canonica)
        canon = grupo[0]
        canon["copias"] = [g["carpeta"] + "/" + g["stem"] for g in grupo[1:]]
        cats = []
        for g in grupo:
            if g["carpeta"] not in cats:
                cats.append(g["carpeta"])
        if canon["norma"]:
            for c in canon["norma"]["categorias"]:
                s = slug_categoria(c)
                if s and s not in cats:
                    cats.append(s)
        # 'otros' es un cajón de sastre, no una materia: si la norma ya tiene
        # categorías reales del listado oficial, deja de figurar en 'otros'.
        if len(cats) > 1 and "otros" in cats:
            cats = [c for c in cats if c != "otros"]
        canon["categorias"] = cats
        canon["categoria"] = cats[0] if cats else canon["carpeta"]
        stats["duplicados_colapsados"] += len(grupo) - 1
        canonicos.append(canon)

    canonicos.sort(key=lambda d: (d["categoria"], d["stem"]))

    # -- Paso 3: grafo de modificaciones (hallazgo 01) -------------------------
    aristas = []
    for d in canonicos:
        n = d["norma"]
        origen = {
            "tipo": n["tipo"] if n else "",
            "numero": (n["numero_norm"].lstrip("0") or "0") if n else "",
            "doc_id": d["categoria"] + "/" + d["stem"],
        }
        # Encabezado/descripción oficial: la norma declara a quién modifica.
        cabecera = ((n or {}).get("descripcion", "") + " . " + d["full_text"][:2000])
        aristas.extend(MOD.extraer_salientes(cabecera, origen))
        # Parte resolutiva: aquí aparece la disposición concreta.
        resolutivo = " ".join(c["text"] for c in d["chunks"] if c.get("seccion") in ("resolutivo", "articulado"))
        aristas.extend(MOD.extraer_salientes(resolutivo, origen))
        # Notas BCN incrustadas: alguien más modificó ESTA norma.
        aristas.extend(MOD.extraer_notas_bcn(d["full_text"], origen))

    # Índice de aristas entrantes por norma destino.
    entrantes = defaultdict(list)
    vistas = set()
    for e in aristas:
        dst = e["destino"]
        key = (norm_key(dst.get("tipo", "")), (dst.get("numero") or "").lstrip("0"))
        sig = (key, norm_key(e["origen"].get("tipo", "")), (e["origen"].get("numero") or "").lstrip("0"),
               e["verbo"], (e.get("disposicion") or {}).get("clase", ""),
               (e.get("disposicion") or {}).get("valor", ""))
        if sig in vistas:
            continue
        vistas.add(sig)
        entrantes[key].append(e)

    # -- Paso 4: escribir corpus ----------------------------------------------
    corpus_fh = (OUT_DIR / "corpus.jsonl").open("w", encoding="utf-8")
    docs_meta, audit_rows = [], []

    for d in canonicos:
        n = d["norma"]
        vault = d["vault"]
        stem = d["stem"]
        stats[d["fuente_texto"]] += 1
        if not vault:
            stats["sin_metadata_vault"] += 1

        if n and n.get("vigencia_manual"):
            # Curado a mano en overrides.json: se aprovecha el título, pero la
            # vigencia sigue siendo "no verificada" — solo el listado oficial
            # del ISP certifica que una norma está vigente.
            stats["sin_match"] += 1
            tipo = n["tipo"]
            numero = n["numero_norm"]
            vigencia = "no_verificada"
            vigencia_fuente = "metadata curada a mano (overrides.json); fuera del listado oficial"
            titulo = n["descripcion"]
            titulo_fuente = "override"
            fecha = n["fecha"] or vault.get("fecha") or ""
            fuente_url = n["enlace"] or vault.get("fuente_url") or ""
            ult_mod = vault.get("ult_mod") or ""
        elif n:
            stats["match_oficial"] += 1
            tipo = n["tipo"]
            numero = n["numero_norm"]
            vigencia = "vigente"
            vigencia_fuente = vig_fuente
            titulo = n["descripcion"] or vault.get("descripcion") or ""
            titulo_fuente = "listado_oficial" if n["descripcion"] else ("vault" if titulo else "")
            fecha = n["fecha"] or vault.get("fecha") or ""
            fuente_url = n["enlace"] or vault.get("fuente_url") or ""
            ult_mod = n["modificaciones"] or vault.get("ult_mod") or ""
        else:
            stats["sin_match"] += 1
            tipo, numero = parse_tipo_numero(stem)
            vigencia = "no_verificada"
            vigencia_fuente = "sin match en listado oficial vigente"
            titulo = vault.get("descripcion") or ""
            titulo_fuente = "vault" if titulo else ""
            fecha = vault.get("fecha") or ""
            fuente_url = vault.get("fuente_url") or ""
            ult_mod = vault.get("ult_mod") or ""

        if not titulo:
            titulo = titulo_desde_texto(d["full_text"])
            titulo_fuente = "texto" if titulo else ""
        if not titulo:
            titulo = titulo_desde_archivo(stem)
            titulo_fuente = "archivo"

        # Modificaciones que apuntan a esta norma.
        key = (norm_key(tipo), (numero or "").lstrip("0"))
        mods = entrantes.get(key, []) if tipo and numero else []
        modificada_por = [{
            "tipo": e["origen"].get("tipo", ""),
            "numero": e["origen"].get("numero", ""),
            "fecha": e["origen"].get("fecha", ""),
            "verbo": e["verbo"],
            "disposicion": (e.get("disposicion") or {}).get("literal", ""),
            "fuente": e["fuente"],
        } for e in mods]
        # El listado oficial trae una fecha de última modificación aunque no
        # sepamos qué norma la produjo: también es una señal de que el texto
        # citado puede no ser el vigente.
        fecha_mod_oficial = ""
        if ult_mod and re.search(r"\d{2}[/-]\d{2}[/-]\d{4}", ult_mod):
            fecha_mod_oficial = ult_mod.strip()
        modificada = bool(modificada_por or fecha_mod_oficial)
        if modificada:
            stats["docs_modificados"] += 1

        doc_id = d["categoria"] + "/" + stem
        pdf_rel = str(d["pdf"].relative_to(ROOT)).replace("\\", "/")
        norma_id = n["norma_id"] if n else "archivo:" + doc_id

        n_alertas_doc = 0
        for ci, ch in enumerate(d["chunks"]):
            alertas = alertas_ocr(ch["text"]) if d["fuente_texto"] == "ocr" else []
            if alertas:
                stats["chunks_con_alerta_ocr"] += 1
                n_alertas_doc += 1

            # ¿Alguna modificación apunta a la disposición de ESTE pasaje?
            afectan = [e for e in mods if MOD.pasaje_afectado(e.get("disposicion"), ch["text"], ch["label"])]
            disposicion_modificada = bool(afectan)
            if disposicion_modificada:
                stats["chunks_disposicion_modificada"] += 1
                e = afectan[0]
                origen_txt = " ".join(x for x in [e["origen"].get("tipo", ""), e["origen"].get("numero", "")] if x)
                alerta = ("⛔ Esta disposición fue " + MOD.participio(e["verbo"]) + " por " + origen_txt
                          + ((" (" + e["disposicion"]["literal"] + ")") if e.get("disposicion") else "")
                          + ". El texto de abajo es el ORIGINAL, no el vigente.")
            elif modificada_por:
                origen_txt = ", ".join(sorted({
                    " ".join(x for x in [m["tipo"], m["numero"]] if x) for m in modificada_por
                }))[:120]
                alerta = ("⚠️ Norma modificada por " + origen_txt
                          + ". Verifica si esta disposición en particular sigue vigente.")
            elif fecha_mod_oficial:
                alerta = ("⚠️ El listado oficial registra una modificación al " + fecha_mod_oficial
                          + " (norma modificatoria no identificada). Verifica la disposición.")
            else:
                alerta = ""

            rec = {
                "doc_id": doc_id,
                "chunk_id": doc_id + "#" + str(ci),
                "norma_id": norma_id,
                "categoria": d["categoria"],
                "categorias": d["categorias"],
                "tipo": tipo,
                "numero": numero,
                "titulo": titulo,
                "titulo_fuente": titulo_fuente,
                "fecha": fecha,
                "vigencia": vigencia,
                "vigencia_fuente": vigencia_fuente,
                "modificada": modificada,
                "modificada_por": modificada_por,
                "disposicion_modificada": disposicion_modificada,
                "alerta_vigencia": alerta,
                "seccion": ch.get("seccion", "resolutivo"),
                "fuente_texto": d["fuente_texto"],
                "alertas_ocr": alertas,
                "fuente_url": fuente_url,
                "pdf_path": pdf_rel,
                "pagina": ch["page"],
                "articulo": ch["label"],
                "texto": ch["text"],
            }
            corpus_fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

        stats["chunks"] += len(d["chunks"])
        stats["docs_indexados"] += 1

        docs_meta.append({
            "doc_id": doc_id, "norma_id": norma_id, "categoria": d["categoria"],
            "categorias": d["categorias"], "tipo": tipo, "numero": numero,
            "titulo": titulo, "titulo_fuente": titulo_fuente, "fecha": fecha,
            "ult_mod": ult_mod, "vigencia": vigencia, "vigencia_fuente": vigencia_fuente,
            "modificada": modificada, "modificada_por": modificada_por,
            "metadata_metodo": d["metodo"], "metadata_confianza": d["confianza"],
            "fuente_texto": d["fuente_texto"], "chunks_con_alerta_ocr": n_alertas_doc,
            "fuente_url": fuente_url, "pdf_path": pdf_rel,
            "copias_colapsadas": d.get("copias", []), "n_chunks": len(d["chunks"]),
        })
        audit_rows.append((doc_id, tipo, numero, d["fuente_texto"], vigencia,
                           "sí" if vault else "no", len(d["chunks"]),
                           d["metodo"], titulo_fuente, n_alertas_doc,
                           len(d.get("copias", [])), modificada))

    corpus_fh.close()

    (OUT_DIR / "metadata.json").write_text(json.dumps({
        "generado": str(date.today()),
        "snapshot_fetched_at": reg.fetched_at,
        "vigencia_fuente": vig_fuente,
        "normas_listado_oficial": len(reg.normas),
        "documentos": docs_meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    (OUT_DIR / "modificaciones.json").write_text(json.dumps({
        "generado": str(date.today()),
        "aristas": [{
            "origen": e["origen"], "destino": e["destino"], "verbo": e["verbo"],
            "disposicion": e.get("disposicion"), "fuente": e["fuente"],
            "evidencia": e["evidencia"][:400],
        } for e in aristas],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    write_audit(stats, audit_rows, reg, aristas)

    # -- Paso 5: índice invertido persistente (hallazgo 10) --------------------
    idx = IX.build(OUT_DIR / "corpus.jsonl")
    IX.save(idx, OUT_DIR / "corpus.jsonl", OUT_DIR / "indice.pkl")

    print("[ok] corpus.jsonl, metadata.json, modificaciones.json, indice.pkl y audit-report.md en " + str(OUT_DIR))
    print("[stats] " + json.dumps(stats, ensure_ascii=False))


def write_audit(stats, rows, reg, aristas):
    L = []
    L.append("# Auditoría de corpus — Cerebro Regulatorio\n")
    L.append("_Generado: " + str(date.today()) + " · listado oficial ISP: snapshot "
             + (reg.fetched_at or "?") + " (" + str(len(reg.normas)) + " normas únicas)_\n")
    L.append("## Resumen\n")
    L.append("- **PDFs encontrados:** " + str(stats["pdfs"]))
    L.append("- **Documentos indexados (tras colapsar copias):** " + str(stats["docs_indexados"]))
    L.append("- **Copias duplicadas colapsadas:** " + str(stats["duplicados_colapsados"]))
    L.append("- **Chunks (unidades de recuperación):** " + str(stats["chunks"]))
    L.append("- **Texto nativo:** " + str(stats["nativo"]) + "  ·  **OCR:** " + str(stats["ocr"])
             + "  ·  **Sin texto extraíble:** " + str(stats["vacio"]))
    L.append("- **Con match en listado oficial (→ vigente):** " + str(stats["match_oficial"]))
    L.append("- **Sin match oficial (vigencia no verificada):** " + str(stats["sin_match"]))
    L.append("- **Sin metadatos del catálogo vault:** " + str(stats["sin_metadata_vault"]))
    L.append("- **Documentos con modificación conocida:** " + str(stats["docs_modificados"]))
    L.append("- **Pasajes con disposición modificada (marcados ⛔):** " + str(stats["chunks_disposicion_modificada"]))
    L.append("- **Pasajes con alerta de OCR:** " + str(stats["chunks_con_alerta_ocr"]))
    L.append("- **Aristas del grafo de modificaciones:** " + str(len(aristas)) + "\n")

    vacios = [r for r in rows if r[3] == "vacio"]
    if vacios:
        L.append("## ⚠️ Documentos sin texto extraíble (revisar OCR)\n")
        L.append("| Documento | Tipo | Nº |")
        L.append("|---|---|---|")
        for r in vacios:
            L.append("| " + r[0] + " | " + r[1] + " | " + r[2] + " |")
        L.append("")

    sin_match = [r for r in rows if r[4] == "no_verificada"]
    L.append("## ⚠️ Sin match en listado oficial vigente (verificar manualmente)\n")
    if sin_match:
        L.append("| Documento | Tipo | Nº | Texto | Título desde |")
        L.append("|---|---|---|---|---|")
        for r in sin_match:
            L.append("| " + r[0] + " | " + r[1] + " | " + r[2] + " | " + r[3] + " | " + r[8] + " |")
    else:
        L.append("_Ninguno: todos los documentos indexados emparejan con el listado oficial._")
    L.append("")

    ocr_alertas = [r for r in rows if r[9] > 0]
    if ocr_alertas:
        L.append("## ⚠️ Documentos OCR con cifras sospechosas (candidatos a re-OCR)\n")
        L.append("Ordenados por nº de pasajes con alerta. El texto NO se corrige automáticamente.\n")
        L.append("| Documento | Pasajes con alerta | Chunks |")
        L.append("|---|---|---|")
        for r in sorted(ocr_alertas, key=lambda x: -x[9]):
            L.append("| " + r[0] + " | " + str(r[9]) + " | " + str(r[6]) + " |")
        L.append("")

    L.append("## Inventario completo\n")
    L.append("| Documento | Tipo | Nº | Texto | Vigencia | Vault | Chunks | Match | Título | Alertas OCR | Copias | Modificada |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in sorted(rows):
        L.append("| " + " | ".join([r[0], r[1], r[2], r[3], r[4], r[5], str(r[6]), r[7], r[8],
                                    str(r[9]), str(r[10]), "sí" if r[11] else "no"]) + " |")
    (OUT_DIR / "audit-report.md").write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
