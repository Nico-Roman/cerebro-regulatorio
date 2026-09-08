#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
modificaciones.py — Grafo de modificaciones normativas a nivel de DISPOSICIÓN.

Problema que resuelve (hallazgo 01 de la auditoría): la vigencia se marcaba por
norma. Si una norma figura en el listado oficial del ISP, TODOS sus pasajes
recibían ✅ vigente, incluidos los que otra norma posterior ya reemplazó. Caso
real: la Res. Ex. 1287 sigue vigente, pero su número 2 fue reemplazado íntegro
por la Res. Ex. 1651 — y el pasaje derogado salía con sello verde.

El campo `modificaciones` del listado oficial solo trae una FECHA, no la norma
modificatoria, así que el grafo se construye de tres fuentes complementarias:

  1. ENCABEZADO / DESCRIPCIÓN  — "MODIFICA RESOLUCIÓN Nº 403 EXENTA…"
     Es la fuente más limpia: la propia norma declara a quién modifica.
  2. PARTE RESOLUTIVA          — "1.- MODIFÍCASE la Resolución Exenta N° 1287…
     en el sentido de reemplazar el actual número dos de su parte resolutiva"
     Aquí aparece la DISPOSICIÓN concreta, que es lo que permite marcar el
     pasaje exacto en vez de la norma entera.
  3. NOTAS BCN                 — "El Decreto 33 Exento, Salud, publicado el
     27.01.2015, sustituye el numeral 8º de la presente norma."
     Vienen incrustadas en el texto de la norma modificada (fuente entrante).

Nada de esto lo redacta un modelo: son expresiones regulares sobre el texto
legal ya indexado. Lo que no se puede atribuir con confianza no se marca.
"""

import re
import unicodedata

# El OCR destroza el símbolo de número: N°, Nº, N2, Ne, N*, N?, N9, No.
NUM_SIGN = r"(?:n\s*[°ºo\*\?2e9\.]{0,3}\s*)?"

VERBOS = {
    "modifica": "modifica",
    "modificase": "modifica",
    "modificanse": "modifica",
    "reemplaza": "reemplaza",
    "reemplazase": "reemplaza",
    "reemplacese": "reemplaza",
    "sustituye": "sustituye",
    "sustituyese": "sustituye",
    "sustituyase": "sustituye",
    "deroga": "deroga",
    "derogase": "deroga",
    "deroguese": "deroga",
    "dejase sin efecto": "deja sin efecto",
    "deja sin efecto": "deja sin efecto",
    "complementa": "complementa",
    "actualiza": "actualiza",
    "agrega": "agrega",
}
VERBO_RE = r"(modif[ií]c(?:a|ase|anse|an)|reempl[aá]z(?:a|ase|ase|ase|ese|an)|sustit[uú]y(?:e|ese|ase|en)|der[oó]g(?:a|ase|uese|an)|d[eé]jase sin efecto|deja sin efecto|complementa|actualiza|agrega)"

TIPO_RE = (
    r"(resoluci[oó]n(?:\s+exenta)?|decreto(?:\s+(?:supremo|exento|con fuerza de ley))?"
    r"|norma\s+(?:general\s+)?t[eé]cnica|circular|ley)"
)

ORDINALES = {
    "primero": "1", "uno": "1", "segundo": "2", "dos": "2", "tercero": "3", "tres": "3",
    "cuarto": "4", "cuatro": "4", "quinto": "5", "cinco": "5", "sexto": "6", "seis": "6",
    "septimo": "7", "siete": "7", "octavo": "8", "ocho": "8", "noveno": "9", "nueve": "9",
    "decimo": "10", "diez": "10", "undecimo": "11", "once": "11", "duodecimo": "12", "doce": "12",
}

# "el actual número dos de su parte resolutiva", "el numeral 8º", "el artículo 5",
# "la cláusula sexta", "la letra b)"
DISPOSICION_RE = re.compile(
    r"(?i)\b(?:el|la|los|las)?\s*(?:actual(?:es)?\s+)?"
    r"(numeral(?:es)?|n[uú]mero(?:s)?|punto(?:s)?|art[ií]culo(?:s)?|cl[aá]usula(?:s)?|letra(?:s)?|anexo(?:s)?|t[ií]tulo(?:s)?|p[aá]rrafo(?:s)?)"
    r"\s+([0-9]+[º°]?|[a-záéíóúñ]+)\b"
)


# Participio femenino, para redactar la alerta ("esta disposición fue …").
PARTICIPIO = {
    "modifica": "modificada",
    "reemplaza": "reemplazada",
    "sustituye": "sustituida",
    "deroga": "derogada",
    "deja sin efecto": "dejada sin efecto",
    "complementa": "complementada",
    "actualiza": "actualizada",
    "agrega": "modificada por agregación",
}


def participio(verbo):
    return PARTICIPIO.get(verbo, verbo)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def _flat(s):
    return re.sub(r"\s+", " ", strip_accents(s or "").lower())


def canon_verbo(raw):
    k = _flat(raw).replace("-", "")
    for pref, v in VERBOS.items():
        if k.startswith(pref):
            return v
    if k.startswith("modific"):
        return "modifica"
    if k.startswith("reempla"):
        return "reemplaza"
    if k.startswith("sustitu"):
        return "sustituye"
    if k.startswith("derog"):
        return "deroga"
    return k


def canon_tipo_ref(raw):
    """Normaliza el tipo citado dentro del texto legal a la nomenclatura del listado."""
    k = _flat(raw)
    if k.startswith("resolucion"):
        return "Resolución Exenta"
    if "fuerza de ley" in k:
        return "Decreto con Fuerza de Ley"
    if k.startswith("decreto supremo"):
        return "Decreto Supremo"
    if k.startswith("decreto exento"):
        return "Decreto Exento"
    if k.startswith("decreto"):
        return "Decreto"
    if "tecnica" in k:
        return "Norma Técnica"
    if k.startswith("circular"):
        return "Circular"
    if k.startswith("ley"):
        return "Ley"
    return raw.strip()


# Fin de oración: un punto seguido de espacio y mayúscula. Sirve para no dejar
# que la búsqueda de disposición se escape a la frase siguiente — que es cómo se
# colaba "Artículo tercero" (del propio decreto modificatorio) como si fuera la
# disposición derogada de la norma de destino.
FIN_ORACION_RE = re.compile(r"\.\s+(?=[A-ZÁÉÍÓÚÑ])")

# La disposición solo cuenta si el texto la ATA a la norma de destino: o bien
# viene introducida por "en el sentido de …", o bien va seguida de un posesivo
# que apunta a la norma citada ("de su parte resolutiva", "de la presente norma").
SENTIDO_RE = re.compile(
    r"(?i)\b(en\s+el\s+sentido\s+de|en\s+los\s+siguientes\s+aspectos|"
    r"en\s+el\s+siguiente\s+sentido|en\s+la\s+forma\s+que\s+se\s+indica)\b"
)
ATADURA_RE = re.compile(
    r"(?i)\b(de\s+su|de\s+dich[oa]s?|de\s+la\s+citada|de\s+la\s+referida|de\s+la\s+misma|"
    r"del\s+mismo|de\s+la\s+presente|de\s+aquell[oa]|de\s+la\s+resoluci[oó]n|"
    r"del\s+decreto|de\s+la\s+norma|de\s+la\s+ley|de\s+la\s+parte\s+(?:resolutiva|dispositiva)|"
    r"del\s+articulado)\b"
)


def _cortar_oracion(fragmento):
    m = FIN_ORACION_RE.search(fragmento or "")
    return fragmento[:m.start()] if m else (fragmento or "")


def parse_disposicion(fragmento, exigir_atadura=False):
    """Extrae la disposición nombrada tras el verbo ('número dos' -> ('numero','2')).

    `exigir_atadura` se usa cuando el fragmento es la cola libre de una frase
    ("MODIFÍCASE la Res. X … <cola>"): sin esa exigencia, cualquier encabezado
    posterior del documento se lee como si fuera la disposición modificada."""
    frag = _cortar_oracion(fragmento)
    m = DISPOSICION_RE.search(frag)
    if not m:
        return None
    if exigir_atadura:
        antes = frag[:m.start()]
        despues = frag[m.end():m.end() + 90]
        if not (SENTIDO_RE.search(antes) or ATADURA_RE.search(despues)):
            return None
    clase = _flat(m.group(1)).rstrip("s")
    valor_raw = m.group(2)
    valor = _flat(valor_raw).rstrip("º°")
    valor = ORDINALES.get(valor, valor)
    if not re.fullmatch(r"[0-9]+|[a-z]", valor):
        return None
    # Una letra suelta solo tiene sentido como "letra b)"; en "los anexos N" la
    # N es el símbolo de número mal leído, no una disposición.
    if len(valor) == 1 and not valor.isdigit() and clase != "letra":
        return None
    return {"clase": clase, "valor": valor, "literal": m.group(0).strip()}


# --- Extracción de aristas ----------------------------------------------------

# "MODIFÍCASE la Resolución Exenta N° 1287, … en el sentido de reemplazar el
#  actual número dos de su parte resolutiva"
SALIENTE_RE = re.compile(
    r"(?i)" + VERBO_RE + r"\s+(?:el|la|los|las)?\s*" + TIPO_RE + r"\s*" + NUM_SIGN + r"\s*([0-9][0-9\.]*)"
)

# "El Decreto 33 Exento, Salud, publicado el 27.01.2015, sustituye el numeral 8º
#  … de la presente norma."
NOTA_BCN_RE = re.compile(
    r"(?i)\b(?:el|la)\s+" + TIPO_RE + r"\s*" + NUM_SIGN + r"\s*([0-9][0-9\.]*)\s*"
    r"(exent[oa]|supremo)?[^.]{0,120}?"
    r"(?:publicad[oa]\s+el\s+([0-9]{2}[\./-][0-9]{2}[\./-][0-9]{4}))?[^.]{0,60}?,\s*"
    + VERBO_RE + r"([^.]{0,160}?)\b(?:de\s+)?la\s+presente\s+norma"
)


def _norm_num(s):
    return (s or "").replace(".", "").strip().lstrip("0") or "0"


def extraer_salientes(texto, origen):
    """Aristas declaradas por la propia norma: origen --verbo--> destino."""
    out = []
    t = re.sub(r"\s+", " ", texto or "")
    for m in SALIENTE_RE.finditer(t):
        verbo = canon_verbo(m.group(1))
        tipo = canon_tipo_ref(m.group(2))
        numero = _norm_num(m.group(3))
        if not numero or numero == "0":
            continue
        if tipo == origen.get("tipo") and numero == _norm_num(origen.get("numero", "")):
            continue  # la norma citándose a sí misma
        cola = t[m.end():m.end() + 220]
        out.append({
            "origen": origen,
            "destino": {"tipo": tipo, "numero": numero},
            "verbo": verbo,
            "disposicion": parse_disposicion(cola, exigir_atadura=True),
            "fuente": "texto",
            "evidencia": t[max(0, m.start() - 40):m.end() + 200].strip(),
        })
    return out


def extraer_notas_bcn(texto, destino):
    """Notas incrustadas por BCN en la norma modificada: X --verbo--> esta norma."""
    out = []
    t = re.sub(r"\s+", " ", texto or "")
    for m in NOTA_BCN_RE.finditer(t):
        tipo_raw, numero_raw, sufijo, fecha, verbo_raw, cola = (
            m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)
        )
        tipo = canon_tipo_ref((tipo_raw or "") + (" " + sufijo if sufijo else ""))
        numero = _norm_num(numero_raw)
        if not numero or numero == "0":
            continue
        if tipo == destino.get("tipo") and numero == _norm_num(destino.get("numero", "")):
            continue
        out.append({
            "origen": {"tipo": tipo, "numero": numero, "fecha": fecha or ""},
            "destino": destino,
            "verbo": canon_verbo(verbo_raw),
            "disposicion": parse_disposicion(cola),
            "fuente": "nota_bcn",
            "evidencia": m.group(0).strip()[:320],
        })
    return out


# --- Marcado de pasajes -------------------------------------------------------

# Encabezado de disposición al inicio de un pasaje: "2.-", "8º", "Artículo 5",
# "Cuarto.-". Es lo que permite decidir si ESTE pasaje es el modificado.
ENCABEZADO_RE = re.compile(
    r"(?i)^\W{0,4}(?:(art[ií]culo|numeral|n[uú]mero|punto)\s+)?"
    r"([0-9]{1,3}|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)"
    r"\s*[º°]?\s*[\.\-\)]"
)

CLASES_EQUIV = {
    "numeral": {"numeral", "numero", "punto"},
    "numero": {"numeral", "numero", "punto"},
    "punto": {"numeral", "numero", "punto"},
    "articulo": {"articulo"},
    "clausula": {"clausula"},
    "letra": {"letra"},
    "anexo": {"anexo"},
    "titulo": {"titulo"},
    "parrafo": {"parrafo"},
}


def disposiciones_del_pasaje(texto, articulo_label):
    """Qué disposición(es) contiene este pasaje: del label de artículo y del
    encabezado con que arranca el texto."""
    found = set()
    if articulo_label:
        m = re.search(r"\d+", articulo_label)
        if m:
            found.add(("articulo", m.group(0)))
        else:
            ord_m = re.search(r"(?i)(primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)", articulo_label)
            if ord_m:
                v = ORDINALES.get(_flat(ord_m.group(1)))
                if v:
                    found.add(("articulo", v))
    head = ENCABEZADO_RE.match((texto or "").lstrip())
    if head:
        clase = _flat(head.group(1) or "numeral").rstrip("s")
        if clase == "articulo":
            clase = "articulo"
        valor = _flat(head.group(2))
        valor = ORDINALES.get(valor, valor)
        if re.fullmatch(r"[0-9]+", valor):
            found.add((clase if clase in CLASES_EQUIV else "numeral", valor))
    return found


def pasaje_afectado(disp, texto, articulo_label):
    """¿La disposición modificada `disp` corresponde a ESTE pasaje?"""
    if not disp:
        return False
    clase = disp["clase"]
    equiv = CLASES_EQUIV.get(clase, {clase})
    for c, v in disposiciones_del_pasaje(texto, articulo_label):
        if c in equiv and v == disp["valor"]:
            return True
    return False
