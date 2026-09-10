#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
codigo_sanitario.py — Ingesta y vigilancia del Código Sanitario (DFL 725/1967).

## Por qué existe

El corpus ANAMED son resoluciones, decretos y normas técnicas del ISP: la capa
reglamentaria. Debajo de todas ellas está la ley que las habilita, y varias de
las preguntas que la gente hace de verdad —receta médica, receta retenida,
recetario magistral, quién puede prescribir, qué necesita registro sanitario—
se contestan en el Código Sanitario, no en la resolución que lo desarrolla.
Sin él, el motor recuperaba el reglamento y se saltaba la norma habilitante.

## Por qué XML de BCN y no un PDF

El resto del corpus entra por PDF porque el ISP no publica otra cosa. La BCN sí:
`obtxml` devuelve el **texto refundido** —el vigente hoy, con sus modificaciones
ya incorporadas— estructurado en Libro › Título › Párrafo › Artículo. Eso da
tres cosas que un PDF no da:

1. Troceado por artículo sin heurística: el artículo ES el elemento del XML.
   Nada de adivinar dónde empieza el 129 con una expresión regular.
2. Vigencia certificada en la fuente: cada parte trae `derogado`, y la norma
   completa también. No hay que inferirla de un listado aparte.
3. `fechaVersion` POR ARTÍCULO: dice cuándo se modificó por última vez ese
   artículo en particular. Es lo que hace posible vigilar cambios con
   granularidad de artículo en vez de "el archivo cambió".

## Vigilancia

`snapshot()` reduce la norma a {artículo: fechaVersion, derogado}. Comparar dos
snapshots dice exactamente qué artículos se movieron, cuáles nacieron y cuáles
se derogaron. Un hash del archivo entero solo diría "cambió algo", que para una
ley de 222 artículos no es información.
"""

import json
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# --- Identidad de la norma ----------------------------------------------------

ID_NORMA = "5595"                      # Código Sanitario en LeyChile
TIPO = "Decreto con Fuerza de Ley"     # tal como lo declara el Identificador del XML
NUMERO = "725"
TITULO = "Código Sanitario"
FECHA_PUBLICACION = "31/01/1968"       # dd/mm/aaaa, como el resto del corpus
NORMA_ID = "decreto con fuerza de ley|725"

URL_XML = "https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma=" + ID_NORMA
URL_HUMANA = "https://www.bcn.cl/leychile/navegar?idNorma=" + ID_NORMA

# El ISP corta por User-Agent y la BCN también: sin UA de navegador `obtxml`
# responde 401. Es el mismo UA que ya usan actualizar-diario.js y el workflow.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

NS = {"n": "http://www.leychile.cl/esquemas"}
Q = "{http://www.leychile.cl/esquemas}"

BASE = Path(__file__).resolve().parent
CACHE = BASE / "fuentes" / "codigo-sanitario.xml"

CHUNK_CHARS = 1500   # mismo tamaño que build_corpus.py, para no partir el ranking


# --- Categorías ---------------------------------------------------------------
# Los Libros se mapean a las categorías que ya existen (las carpetas de
# ANAMED_Normativa) para que el filtro del buscador siga siendo una partición
# real. `codigo_sanitario` va siempre primero: es la categoría propia y la que
# permite acotar una búsqueda a la ley.

CATEGORIA_PROPIA = "codigo_sanitario"

CATEGORIAS_POR_LIBRO = {
    "preliminar": [],
    "i": [],
    "ii": ["importacion_y_exportacion_control_y_vigilancia"],
    "iii": [],
    "iv": ["medicamentos", "cosmeticos", "laboratorio_nacional_de_control"],
    "v": [],
    "vi": ["establecimientos_autorizacion_y_fiscalizacion"],
    "vii": ["medicamentos"],
    "viii": [],
    "ix": [],
    "x": ["establecimientos_autorizacion_y_fiscalizacion"],
    "final": [],
}

# El XML rotula unos Libros con número romano y otros con la palabra escrita
# ("LIBRO CUARTO", "LIBRO SEXTO"). Se normaliza a romano para tener una clave.
PALABRA_A_ROMANO = {
    "primero": "i", "segundo": "ii", "tercero": "iii", "cuarto": "iv", "quinto": "v",
    "sexto": "vi", "septimo": "vii", "octavo": "viii", "noveno": "ix", "decimo": "x",
}


def _sin_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn")


def _limpiar(s):
    """Normaliza el espacio en blanco del XML (trae nbsp y saltos de maqueta)."""
    s = (s or "").replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def clave_libro(titulo):
    """'LIBRO CUARTO DE LOS PRODUCTOS...' -> 'iv'; 'TITULO PRELIMINAR' -> 'preliminar'."""
    t = _sin_acentos(titulo or "").lower()
    if "preliminar" in t:
        return "preliminar"
    m = re.search(r"\blibro\s+([a-z]+)\b", t)
    if not m:
        return ""
    tok = m.group(1)
    if re.fullmatch(r"[ivx]+", tok):
        return tok
    return PALABRA_A_ROMANO.get(tok, "")


# --- Descarga -----------------------------------------------------------------

def descargar(dest=CACHE, timeout=60):
    """Baja el XML refundido y lo deja en `dest`. Escritura atómica.

    Atómica a propósito: si la descarga se corta a la mitad, el archivo previo
    tiene que seguir siendo el bueno. Un XML truncado no falla al escribirse,
    falla recién al parsearse —y para entonces el corpus ya se estaría
    construyendo con media ley.
    """
    req = urllib.request.Request(URL_XML, headers={
        "User-Agent": UA,
        "Accept": "application/xml,text/xml,*/*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        datos = r.read()

    # Se valida ANTES de reemplazar el archivo bueno.
    raiz = ET.fromstring(datos)
    if raiz.get("normaId") != ID_NORMA:
        raise ValueError("El XML descargado no es la norma " + ID_NORMA +
                         " (vino normaId=" + repr(raiz.get("normaId")) + ")")
    n_arts = sum(1 for e in raiz.iter(Q + "EstructuraFuncional")
                 if e.get("tipoParte") == "Artículo")
    if n_arts < 150:
        raise ValueError("El XML trae solo " + str(n_arts) + " artículos; el Código "
                         "Sanitario tiene más de 200. Se aborta antes de pisar la copia buena.")

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    tmp.write_bytes(datos)
    tmp.replace(dest)
    return dest


# --- Parseo -------------------------------------------------------------------

class Articulo:
    __slots__ = ("numero", "texto", "fecha_version", "derogado", "id_parte", "libro", "ruta")

    def __init__(self, numero, texto, fecha_version, derogado, id_parte, libro, ruta):
        self.numero = numero
        self.texto = texto
        self.fecha_version = fecha_version
        self.derogado = derogado
        self.id_parte = id_parte
        self.libro = libro
        self.ruta = ruta

    @property
    def etiqueta(self):
        return "Artículo " + self.numero

    @property
    def url(self):
        # Enlace profundo al artículo concreto en el sitio de la BCN.
        return URL_HUMANA + "&idParte=" + self.id_parte


class Libro:
    __slots__ = ("clave", "titulo", "articulos", "fecha_version", "derogado")

    def __init__(self, clave, titulo, fecha_version, derogado):
        self.clave = clave
        self.titulo = titulo
        self.fecha_version = fecha_version
        self.derogado = derogado
        self.articulos = []

    @property
    def titulo_corto(self):
        """'LIBRO CUARTO DE LOS PRODUCTOS...' -> 'Libro IV'. Es el stem del doc_id."""
        if self.clave == "preliminar":
            return "Título Preliminar"
        if self.clave == "final":
            return "Disposiciones finales"
        return "Libro " + self.clave.upper()

    @property
    def doc_id(self):
        return CATEGORIA_PROPIA + "/" + self.titulo_corto

    @property
    def categorias(self):
        return [CATEGORIA_PROPIA] + CATEGORIAS_POR_LIBRO.get(self.clave, [])


class CodigoSanitario:
    def __init__(self, fecha_version, derogado, libros, origen):
        self.fecha_version = fecha_version
        self.derogado = derogado
        self.libros = libros
        self.origen = origen

    @property
    def articulos(self):
        for lb in self.libros:
            for a in lb.articulos:
                yield a


def _titulo_de(el):
    return _limpiar(el.findtext("n:Metadatos/n:TituloParte", "", NS))


def cargar(path=CACHE):
    """Parsea el XML a Libros con sus artículos, conservando la jerarquía."""
    raiz = ET.parse(str(path)).getroot()
    libros = []
    sueltos = {"lb": None}

    def articulo_de(ef, libro, ruta):
        numero = _limpiar(ef.findtext("n:Metadatos/n:NombreParte", "", NS))
        texto = _limpiar(ef.findtext("n:Texto", "", NS))
        return Articulo(
            numero=numero or "?",
            texto=texto,
            fecha_version=ef.get("fechaVersion", ""),
            derogado=(ef.get("derogado", "") != "no derogado"),
            id_parte=ef.get("idParte", ""),
            libro=libro,
            ruta=[r for r in ruta if r],
        )

    def recorrer(el, libro_actual, ruta):
        for ef in el.findall("n:EstructurasFuncionales/n:EstructuraFuncional", NS):
            tipo = ef.get("tipoParte") or ""
            titulo = _titulo_de(ef)
            # `libro_actual is None` es la parte que importa: el Título
            # Preliminar del Código cuelga de la raíz, pero el Libro VI tiene
            # ADEMÁS un "Título Preliminar" propio, anidado. Sin esa condición
            # el anidado también se promovía a documento, le robaba su artículo
            # al Libro VI y reutilizaba el mismo doc_id, con lo que los
            # chunk_id de los dos colisionaban.
            es_preliminar = (tipo == "Título" and libro_actual is None
                             and "PRELIMINAR" in _sin_acentos(titulo).upper())
            if tipo == "Libro" or es_preliminar:
                lb = Libro(clave_libro(titulo) or _sin_acentos(titulo).lower()[:12],
                           titulo, ef.get("fechaVersion", ""),
                           ef.get("derogado", "") != "no derogado")
                libros.append(lb)
                recorrer(ef, lb, [titulo])
            elif tipo == "Artículo":
                destino = libro_actual
                if destino is None:
                    # El XML cierra con un artículo colgado de la raíz (el final
                    # de 1968). No pertenece a ningún Libro; se le da uno propio
                    # en vez de descartarlo o meterlo a la fuerza en el último.
                    if sueltos["lb"] is None:
                        sueltos["lb"] = Libro("final", "DISPOSICIONES FINALES", "", False)
                        libros.append(sueltos["lb"])
                    destino = sueltos["lb"]
                destino.articulos.append(articulo_de(ef, destino, ruta))
            else:
                # Título o Párrafo: no son documentos, son la ruta jerárquica
                # que después se cita ("Libro IV › Título I › Párrafo 2").
                recorrer(ef, libro_actual, ruta + [titulo])

    recorrer(raiz, None, [])
    return CodigoSanitario(
        fecha_version=raiz.get("fechaVersion", ""),
        derogado=(raiz.get("derogado", "") != "no derogado"),
        libros=libros,
        origen=str(path),
    )


# --- Troceado -----------------------------------------------------------------

def _partir(texto, limite=CHUNK_CHARS):
    """Parte un artículo largo por incisos, nunca a mitad de oración.

    Un artículo corto entra entero: es la unidad natural de cita. Solo los pocos
    que superan el límite (el más largo tiene ~9.000 caracteres) se dividen, y se
    dividen por párrafo, que en la ley es el inciso.
    """
    if len(texto) <= limite * 1.6:
        return [texto]
    parrafos = [p for p in re.split(r"\n+", texto) if p.strip()]
    piezas, actual = [], ""
    for p in parrafos:
        if actual and len(actual) + len(p) + 1 > limite:
            piezas.append(actual.strip())
            actual = p
        else:
            actual = (actual + "\n" + p) if actual else p
    if actual.strip():
        piezas.append(actual.strip())
    return piezas or [texto]


def _titulo_legible(t):
    """'LIBRO CUARTO DE LOS PRODUCTOS FARMACÉUTICOS...' -> 'De los productos farmacéuticos...'"""
    t = re.sub(r"^\s*(LIBRO|T[IÍ]TULO)\s+[A-ZÁÉÍÓÚ]+\s*", "", t or "", flags=re.I).strip()
    if not t:
        return ""
    return t[0].upper() + t[1:].lower()


# --- Registros para corpus.jsonl ----------------------------------------------

def registros(cs):
    """Genera los registros con el MISMO esquema que emite build_corpus.py.

    Cualquier campo que falte acá rompe el tipo `CorpusChunk` de la web en
    silencio (TypeScript no valida JSON en runtime), así que se emiten todos,
    incluidos los que para esta fuente no aplican.
    """
    version = cs.fecha_version or "?"
    vig_fuente = ("texto refundido de BCN LeyChile, versión " + version +
                  " (la BCN certifica la vigencia de la ley; no depende del listado del ISP)")

    for lb in cs.libros:
        doc_id = lb.doc_id
        titulo_doc = TITULO + " — " + lb.titulo_corto
        legible = _titulo_legible(lb.titulo)
        if legible:
            titulo_doc += ": " + legible

        for i, art in enumerate(lb.articulos):
            piezas = _partir(art.texto)
            for j, pieza in enumerate(piezas):
                if len(pieza) < 60 and len(piezas) > 1:
                    continue

                if art.derogado:
                    vigencia = "derogada"
                    alerta = ("⛔ Este artículo está DEROGADO según el texto refundido de "
                              "la BCN (versión " + version + "). No lo cites como vigente.")
                elif lb.derogado:
                    vigencia = "derogada"
                    alerta = ("⛔ El " + lb.titulo_corto + " completo figura como derogado "
                              "en el texto refundido de la BCN (versión " + version + ").")
                else:
                    vigencia = "vigente"
                    alerta = ""

                # fechaVersion posterior a la publicación = el artículo se
                # modificó en algún momento. El texto de abajo YA es el vigente
                # (es refundido), así que esto no es la advertencia "puede estar
                # desactualizado" de los PDF: es trazabilidad de la versión.
                modificado = bool(art.fecha_version) and art.fecha_version > "1968-01-31"
                if modificado and not alerta:
                    alerta = ("ℹ️ Texto vigente al " + art.fecha_version +
                              " (artículo modificado después de la publicación original).")

                ruta = " › ".join([lb.titulo_corto] + art.ruta[1:]) if art.ruta else lb.titulo_corto

                yield {
                    "doc_id": doc_id,
                    "chunk_id": doc_id + "#" + str(i) + "-" + str(j),
                    "norma_id": NORMA_ID,
                    "categoria": CATEGORIA_PROPIA,
                    "categorias": lb.categorias,
                    "tipo": TIPO,
                    "numero": NUMERO,
                    "titulo": titulo_doc,
                    "titulo_fuente": "bcn_leychile",
                    "fecha": FECHA_PUBLICACION,
                    "vigencia": vigencia,
                    "vigencia_fuente": vig_fuente,
                    "modificada": modificado,
                    "modificada_por": [],
                    "disposicion_modificada": False,
                    "alerta_vigencia": alerta,
                    "seccion": "articulado",
                    # No es OCR ni extracción de PDF: es el XML oficial. Se marca
                    # distinto para que no aparezca el aviso de "⚠ texto OCR" y
                    # para que la auditoría pueda contarlo aparte.
                    "fuente_texto": "xml",
                    "alertas_ocr": [],
                    "fuente_url": art.url,
                    "pdf_path": "",
                    # El texto refundido no tiene páginas. 0 significa "sin
                    # paginación", y `cite()` omite la página cuando vale 0:
                    # inventar "pág. 1" sería una cita falsa.
                    "pagina": 0,
                    "articulo": art.etiqueta,
                    "texto": ("[" + TITULO + " · " + ruta + "]\n" + pieza) if j == 0 else pieza,
                }


# --- Snapshot para vigilancia -------------------------------------------------

def snapshot(cs):
    """Reduce la norma a lo que hay que comparar entre dos días."""
    return {
        "norma_id": ID_NORMA,
        "tipo": TIPO,
        "numero": NUMERO,
        "titulo": TITULO,
        "fuente": URL_XML,
        "capturado": datetime.now().astimezone().isoformat(timespec="seconds"),
        "fecha_version": cs.fecha_version,
        "derogado": cs.derogado,
        "n_articulos": sum(1 for _ in cs.articulos),
        "articulos": {
            a.numero: {
                "fecha_version": a.fecha_version,
                "derogado": a.derogado,
                "libro": a.libro.titulo_corto,
                "id_parte": a.id_parte,
                # Para poder mostrar de qué trata el artículo que cambió sin
                # guardar la ley entera una segunda vez.
                "resumen": re.sub(r"\s+", " ", a.texto)[:160],
            }
            for a in cs.articulos
        },
    }


def diff(anterior, actual):
    """Qué se movió entre dos snapshots, con granularidad de artículo."""
    ant = (anterior or {}).get("articulos", {}) or {}
    act = (actual or {}).get("articulos", {}) or {}

    nuevos = [k for k in act if k not in ant]
    idos = [k for k in ant if k not in act]
    modificados, derogados, revividos = [], [], []
    for k, v in act.items():
        if k not in ant:
            continue
        a = ant[k]
        if a.get("fecha_version") != v.get("fecha_version"):
            modificados.append({"articulo": k, "antes": a.get("fecha_version"),
                                "ahora": v.get("fecha_version"), "libro": v.get("libro"),
                                "resumen": v.get("resumen", "")})
        if not a.get("derogado") and v.get("derogado"):
            derogados.append(k)
        if a.get("derogado") and not v.get("derogado"):
            revividos.append(k)

    return {
        "version_antes": (anterior or {}).get("fecha_version"),
        "version_ahora": (actual or {}).get("fecha_version"),
        "cambio_version": ((anterior or {}).get("fecha_version")
                           != (actual or {}).get("fecha_version")),
        "nuevos": sorted(nuevos),
        "eliminados": sorted(idos),
        "modificados": sorted(modificados, key=lambda x: x["articulo"]),
        "derogados": sorted(derogados),
        "revividos": sorted(revividos),
    }


def hay_cambios(d):
    return bool(d.get("cambio_version") or d.get("nuevos") or d.get("eliminados")
                or d.get("modificados") or d.get("derogados") or d.get("revividos"))


# --- Vigilancia ---------------------------------------------------------------
# La bitácora vive en registro-cambios/, junto a la del listado ANAMED, y sigue
# sus mismas reglas: append-only, y NO es fuente normativa (ver su README y su
# archivo .no-indexar). Lo citable sigue siendo el artículo en la BCN.

RAIZ_REPO = BASE.parents[1]
DIR_REGISTRO = RAIZ_REPO / "registro-cambios"
REFERENCIA = DIR_REGISTRO / "estado" / "codigo-sanitario-snapshot.json"
BITACORA = DIR_REGISTRO / "cambios.jsonl"
DIR_INFORMES = DIR_REGISTRO / "informes"


def vigilar(descargar_primero=True, escribir=True):
    """Compara la versión publicada hoy contra la última vista y deja el rastro.

    Devuelve (diff, snapshot_actual). En la primera corrida no hay referencia:
    se establece la línea base y no se reporta nada como cambio, porque «todo
    es nuevo» sería ruido, no información.
    """
    if descargar_primero:
        descargar()

    actual = snapshot(cargar())
    previo = None
    if REFERENCIA.exists():
        try:
            previo = json.loads(REFERENCIA.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            # Una referencia corrupta no puede bloquear la vigilancia: se
            # rehace la línea base y se avisa.
            previo = None

    if previo is None:
        if escribir:
            REFERENCIA.parent.mkdir(parents=True, exist_ok=True)
            REFERENCIA.write_text(json.dumps(actual, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
        return None, actual

    d = diff(previo, actual)
    if escribir and hay_cambios(d):
        _anotar(d, actual)
        _informe(d, actual)
    if escribir:
        REFERENCIA.write_text(json.dumps(actual, ensure_ascii=False, indent=2),
                              encoding="utf-8")
    return d, actual


def _anotar(d, actual):
    """Una línea JSON por artículo que se movió. Append-only, nunca se reescribe."""
    hoy = datetime.now().date().isoformat()
    lineas = []

    def base(evento):
        return {"tipo_evento": evento, "fecha": hoy, "norma": TITULO,
                "norma_id": ID_NORMA, "version": actual.get("fecha_version")}

    for m in d["modificados"]:
        art = actual["articulos"].get(m["articulo"], {})
        r = base("ley_articulo_modificado")
        r.update({"articulo": m["articulo"], "libro": m.get("libro", ""),
                  "version_anterior": m["antes"], "version_nueva": m["ahora"],
                  "enlace": URL_HUMANA + "&idParte=" + str(art.get("id_parte", "")),
                  "resumen": m.get("resumen", "")})
        lineas.append(r)

    for k in d["nuevos"]:
        art = actual["articulos"].get(k, {})
        r = base("ley_articulo_nuevo")
        r.update({"articulo": k, "libro": art.get("libro", ""),
                  "enlace": URL_HUMANA + "&idParte=" + str(art.get("id_parte", "")),
                  "resumen": art.get("resumen", "")})
        lineas.append(r)

    for k in d["derogados"]:
        r = base("ley_articulo_derogado")
        r.update({"articulo": k, "libro": actual["articulos"].get(k, {}).get("libro", "")})
        lineas.append(r)

    for k in d["eliminados"]:
        r = base("ley_articulo_eliminado")
        r.update({"articulo": k})
        lineas.append(r)

    for k in d["revividos"]:
        r = base("ley_articulo_repuesto")
        r.update({"articulo": k, "libro": actual["articulos"].get(k, {}).get("libro", "")})
        lineas.append(r)

    BITACORA.parent.mkdir(parents=True, exist_ok=True)
    with BITACORA.open("a", encoding="utf-8") as fh:
        for r in lineas:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


def _informe(d, actual):
    """Informe legible. Se escribe solo cuando hubo cambios."""
    hoy = datetime.now().date().isoformat()
    L = ["# Código Sanitario — cambios detectados el " + hoy, ""]
    L.append("Fuente: [texto refundido en BCN LeyChile](" + URL_HUMANA + ")  ")
    L.append("Versión anterior: **" + str(d["version_antes"]) + "** → versión ahora: **"
             + str(d["version_ahora"]) + "**")
    L.append("")
    L.append("> Este informe describe QUÉ se movió. El texto citable sigue siendo el")
    L.append("> artículo en la BCN, no este archivo.")
    L.append("")

    if d["modificados"]:
        L.append("## Artículos modificados (" + str(len(d["modificados"])) + ")")
        L.append("")
        L.append("| Artículo | Libro | Versión anterior | Versión nueva |")
        L.append("|---|---|---|---|")
        for m in d["modificados"]:
            L.append("| " + m["articulo"] + " | " + str(m.get("libro", "")) + " | "
                     + str(m["antes"]) + " | " + str(m["ahora"]) + " |")
        L.append("")
        for m in d["modificados"]:
            L.append("**Artículo " + m["articulo"] + "** — " + (m.get("resumen") or "")[:300])
            L.append("")

    for clave, titulo in (("nuevos", "Artículos nuevos"),
                          ("derogados", "Artículos derogados"),
                          ("eliminados", "Artículos que desaparecieron del texto"),
                          ("revividos", "Artículos repuestos")):
        if d[clave]:
            L.append("## " + titulo + " (" + str(len(d[clave])) + ")")
            L.append("")
            for k in d[clave]:
                art = actual["articulos"].get(k, {})
                L.append("- **" + str(k) + "** " + (("· " + art.get("libro", "")) if art.get("libro") else "")
                         + ((" — " + art.get("resumen", "")[:200]) if art.get("resumen") else ""))
            L.append("")

    L.append("---")
    L.append("")
    L.append("Detectado por `cerebro/codigo_sanitario.py --vigilar`, que corre dentro del")
    L.append("pipeline diario. El corpus ya se reconstruyó con el texto nuevo en la misma")
    L.append("corrida: no hay que reindexar a mano.")

    DIR_INFORMES.mkdir(parents=True, exist_ok=True)
    (DIR_INFORMES / ("codigo-sanitario-" + hoy + ".md")).write_text(
        "\n".join(L) + "\n", encoding="utf-8")


def resumen_texto(d):
    """Una línea para el log del pipeline."""
    if d is None:
        return "línea base establecida (primera corrida): sin comparación posible."
    if not hay_cambios(d):
        return "sin cambios (versión refundida " + str(d["version_ahora"]) + ")."
    partes = []
    for clave, etiqueta in (("modificados", "modificados"), ("nuevos", "nuevos"),
                            ("derogados", "derogados"), ("eliminados", "eliminados"),
                            ("revividos", "repuestos")):
        if d[clave]:
            partes.append(str(len(d[clave])) + " " + etiqueta)
    return ("CAMBIÓ: " + ", ".join(partes) + " · versión " + str(d["version_antes"])
            + " → " + str(d["version_ahora"]))


# --- CLI ----------------------------------------------------------------------

def _main():
    import argparse
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="Código Sanitario: descarga, parseo y vigilancia.")
    ap.add_argument("--descargar", action="store_true", help="baja el XML refundido de la BCN")
    ap.add_argument("--resumen", action="store_true", help="muestra la estructura parseada")
    ap.add_argument("--snapshot", metavar="RUTA", help="escribe el snapshot de vigilancia")
    ap.add_argument("--vigilar", action="store_true",
                    help="baja, compara con la última versión vista y registra los cambios")
    ap.add_argument("--sin-red", action="store_true",
                    help="con --vigilar, usa el XML en caché en vez de bajarlo")
    args = ap.parse_args()

    if args.vigilar:
        try:
            d, actual = vigilar(descargar_primero=not args.sin_red)
        except Exception as e:
            # Que la BCN esté caída no puede voltear el pipeline diario: el XML
            # en caché sigue siendo válido y el corpus se construye igual. Lo
            # que no puede pasar es que falle en silencio.
            print("[warn] no se pudo vigilar el Código Sanitario: " + str(e))
            return 0
        print("[codigo-sanitario] " + resumen_texto(d))
        if d and hay_cambios(d):
            for m in d["modificados"]:
                print("    art. " + m["articulo"] + " (" + str(m.get("libro", "")) + "): "
                      + str(m["antes"]) + " → " + str(m["ahora"]))
            for k in d["nuevos"]:
                print("    art. " + str(k) + ": NUEVO")
            for k in d["derogados"]:
                print("    art. " + str(k) + ": DEROGADO")
        return 0

    if args.descargar:
        p = descargar()
        print("[ok] " + str(p) + " (" + str(p.stat().st_size) + " bytes)")

    if not CACHE.exists():
        print("[error] no existe " + str(CACHE) +
              ". Corre primero: python codigo_sanitario.py --descargar")
        return 1

    cs = cargar()
    if args.resumen or not (args.descargar or args.snapshot):
        print("Código Sanitario (DFL 725) · versión refundida " + cs.fecha_version +
              " · " + ("DEROGADO" if cs.derogado else "vigente"))
        for lb in cs.libros:
            print("  " + lb.titulo_corto.ljust(24) + str(len(lb.articulos)).rjust(4) +
                  " art.  cats=" + ",".join(lb.categorias))
        n = sum(1 for _ in registros(cs))
        print("  total artículos: " + str(sum(1 for _ in cs.articulos)) +
              "  ·  pasajes para el corpus: " + str(n))

    if args.snapshot:
        destino = Path(args.snapshot)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(json.dumps(snapshot(cs), ensure_ascii=False, indent=2),
                           encoding="utf-8")
        print("[ok] snapshot en " + str(destino))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
