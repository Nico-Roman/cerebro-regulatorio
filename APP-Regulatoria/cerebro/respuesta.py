#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
respuesta.py — El cerebro, versión sin IA.

Hasta septiembre de 2026 el buscador devolvía ocho fragmentos cortados y una
"confianza" que medía si las PALABRAS de la pregunta aparecían en los pasajes.
En una prueba con 28 preguntas reales solo 8 mostraban la respuesta, y 8 de 13
sellos verdes no la tenían. El motor BM25 no era el problema: la gente pregunta
"guardar recetas" y la norma dice "archivar"; pregunta "internet" y la norma
dice "expendio electrónico".

Este módulo hace cuatro cosas, sin modelo de lenguaje y sin reescribir jamás el
texto legal:

  1. TRADUCE la pregunta: quita las palabras de conversación ("debo", "puedo")
     y suma, con peso reducido, los términos de la norma (vocabulario.json).
  2. BUSCA amplio (60 candidatos) y DIVERSIFICA por documento y artículo, no por
     norma: los 222 artículos del Código Sanitario ya no compiten por dos cupos.
  3. ENCUENTRA LA FRASE que responde dentro de cada pasaje. Si la pregunta pide
     un plazo, la frase tiene que traer un plazo; si pide una definición, tiene
     que definir. Esa frase es lo que ve el químico farmacéutico.
  4. DECIDE UN ESTADO que se puede defender: "encontrado" solo si la frase
     visible cubre la pregunta y trae el tipo de dato pedido; "parcial" si hay
     norma relacionada pero la frase no cierra; "ausente" si la materia no está.

Puerto TypeScript: web/lib/search.ts. Mantener ambos en sync; la compuerta
(eval_respuestas.py) compara los dos y reprueba si difieren.
"""

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import indice as IX
from indice import tokenize, stem

DIR = Path(__file__).resolve().parent
VOCABULARIO = DIR / "vocabulario.json"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# --- Parámetros (espejados en web/lib/search.ts) ------------------------------
CANDIDATOS = 60           # pasajes que se leen antes de decidir
CANDIDATOS_DEFINICION = 250  # las definiciones viven en artículos largos con BM25 bajo
IDF_GENERICO = 1.2        # palabras tan frecuentes ("producto") que no especifican nada
MAX_RESULTADOS = 6        # principal + 5 relacionadas
PESO_EXPANSION = 0.5      # un término de la norma agregado pesa la mitad
MAX_POR_DOCUMENTO = 3     # diversificación: por documento (libro, decreto)
MAX_POR_NORMA = 4         # y un techo más holgado por norma
UMBRAL_ENCONTRADO = 0.6   # cobertura de la frase visible para "encontrado"
UMBRAL_PASAJE_ENCONTRADO = 0.85
UMBRAL_PARCIAL = 0.45
PESO_FUERA_CORPUS_MAX = 0.2
LARGO_FRASE = 420         # caracteres máximos de la frase clave
CREDITO_ALTERNATIVA = 0.7 # una alternativa de una sola palabra cubre a medias
NUCLEO_FRACCION = 0.9     # además de los dos primeros, los casi tan específicos
UMBRAL_ENCONTRADO_SIN_DATO = 0.9   # preguntas sin dato verificable exigen más

TIPOS_CON_DATO = ("plazo", "monto", "temperatura", "definicion")
BONO_DATO_ESTRICTO = 0.4  # la frase trae el dato pedido (un plazo, una definición…)
BONO_DEFINICION = 0.7     # la detección de definición es estricta (término exacto al inicio)
BONO_DATO_LAXO = 0.1      # "podrá", "deberá": casi toda norma los tiene, discrimina poco
BONO_LEY = 0.05           # a igualdad, la ley antes que el reglamento
BONO_LEY_PEDIDA = 0.3     # "¿qué dice el Código Sanitario…?", "¿qué norma legal…?"

# Límites de palabra explícitos. `\b` y `\w` no significan lo mismo en Python
# (Unicode) que en JavaScript (solo ASCII): "podrá" terminaba en límite en uno y
# no en el otro. Con clases explícitas los dos motores leen igual.
LETRA = "A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ"
INI = "(?<![" + LETRA + "])"
FIN = "(?![" + LETRA + "])"

NUMERO_PALABRA = (r"(?:[0-9]+(?:[.,][0-9]+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|"
                  r"quince|veinte|veinticuatro|treinta|cuarenta|cuarenta y ocho|sesenta|setenta y dos|noventa|ciento)")

CUES = {
    "plazo": re.compile(
        # "menos de 5 años de su introducción" es una condición, no un plazo.
        r"(?<!menos de )(?<!más de )(?<!mas de )" + INI + NUMERO_PALABRA + r"\s*(?:\([0-9]+\)\s*)?(?:horas?|d[ií]as?|mes(?:es)?|años?|semanas?)" + FIN +
        "|" + INI + r"(?:de|en) forma inmediata|" + INI + "inmediatamente" + FIN + "|" + INI + "al cabo de" + FIN +
        "|" + INI + "mensual|" + INI + "anual|" + INI + "semestral|" + INI + "trimestral", re.I),
    "monto": re.compile(r"unidad(?:es)? tributaria|" + INI + "utm" + FIN + r"|\$\s?[0-9]|" + INI + "pesos" + FIN +
                        r"|ingresos? m[ií]nimos?|" + INI + "multa de" + FIN, re.I),
    "temperatura": re.compile(r"[0-9]+\s*[º°]\s*c" + FIN + r"|[0-9]+\)?\s*(?:y|a|-)\s*\(?\+?\)?\s*[0-9]+\s*[º°]", re.I),
    "definicion": re.compile(
        r":\s|" + INI + r"es (?:todo|toda|el|la|aquel|aquella|un|una|cualquier)" + FIN + r"|se entender[aá] por|se denominar[aá]|" +
        INI + "se considera" + FIN + "|" + INI + "consiste en" + FIN + "|" + INI + "es el instrumento" + FIN, re.I),
    "quien": re.compile(
        r"qu[ií]mico[- ]farmac[eé]utico|" + INI + r"farmac[eé]utico|" + INI + "profesional|" + INI + r"m[eé]dico|cirujano|odont[oó]log|matron|"
        r"director t[eé]cnico|" + INI + "titular|" + INI + "persona", re.I),
    "requisitos": re.compile(r"requisitos|deber[aá]n? (?:presentar|contar|cumplir|acompañar)|siguientes (?:documentos|requisitos|antecedentes)", re.I),
    "permiso": re.compile(
        INI + r"podr[aá]n?" + FIN + "|" + INI + r"deber[aá]n?" + FIN + "|" + INI + r"s[oó]lo" + FIN + "|" + INI + "solamente" + FIN +
        "|prohib|" + INI + r"no (?:se )?podr|requerir[aá]n?|sin (?:la )?(?:debida )?autorizaci|" + INI + "previa" + FIN +
        "|exclusivamente|obligatori", re.I),
}

TIPOS_PREGUNTA = [
    ("temperatura", re.compile(r"temperatura|grados|°|refrigera", re.I)),
    ("monto", re.compile(r"\bmulta|\bmonto|cuanto cuesta|\bprecio|\bvalor de\b|\barancel", re.I)),
    ("plazo", re.compile(r"cuanto tiempo|cuant[oa]s (?:dias|horas|meses|anos|años|semanas)|\bplazo|\bdura\b|\bdurar|"
                         r"vigencia|validez|\bvalid[oa]\b|cada cuanto|frecuencia|hasta cuando|en que plazo|antelacion", re.I)),
    ("definicion", re.compile(r"^\s*(?:que|qué) (?:es|son)\b|que se (?:considera|entiende)|definicion|significa", re.I)),
    ("quien", re.compile(r"^\s*(?:quien|quienes)\b|quien(?:es)? (?:puede|pueden|debe|deben)", re.I)),
    ("requisitos", re.compile(r"requisitos|que necesito|documentos", re.I)),
    ("permiso", re.compile(r"^\s*(?:se puede|puede|pueden|puedo|es obligatori|hay que|esta permitid|esta prohibid|necesita|es necesari|se requiere|debe|deben)\b"
                           r"|permitid|prohibid|obligatori", re.I)),
]

PALABRAS_DEL_TIPO = {
    "plazo": {"tiempo", "dias", "dia", "horas", "hora", "meses", "mes", "anos", "ano", "semanas", "semana", "plazo", "plazos",
              "dura", "durar", "duracion"},
    "monto": {"monto", "cuesta", "valor"},
    "temperatura": {"grados"},
    "definicion": {"definicion", "significa", "concepto"},
}

# Frases de preámbulo ("PRIMERO: Que…", "Que, …"): fundamentan, no obligan.
CONSIDERANDO = re.compile(r"^(?:[0-9]{1,2}[.º°-]*\s*)?(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[ÉE]PTIMO|OCTAVO|NOVENO|D[ÉE]CIMO)?\s*[:.-]?\s*(?:q)?Que[, ]", re.I)

# --- Utilidades ---------------------------------------------------------------

def normalizar(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not ("\u0300" <= c <= "\u036f"))
    # "º" y "ª" son letras para Python y no para JavaScript: se aplanan.
    return s.replace("º", "o").replace("ª", "a")


def cargar_vocabulario(path=VOCABULARIO):
    return json.loads(Path(path).read_text(encoding="utf-8"))


_VOC = None


def vocabulario():
    global _VOC
    if _VOC is None:
        _VOC = cargar_vocabulario()
    return _VOC


def contiene_frase(norm_texto, frase):
    """¿Aparece `frase` (normalizada) como palabras completas en el texto?"""
    return re.search(r"(?<![a-z0-9])" + re.escape(frase) + r"(?![a-z0-9])", norm_texto) is not None


def raices(texto):
    return {stem(t) for t in tokenize(texto)}


# Anotaciones de margen que la BCN intercala en los reglamentos ("Decreto 38,
# SALUD Art. 2 D.O. 02.05.2013"). No son texto legal: son referencias de la
# edición consolidada. Se quitan SOLO de la frase clave que se muestra; el texto
# completo del pasaje se entrega intacto.
_ANOTACIONES = [
    re.compile(INI + r"(?:Decreto|DTO|DS|Ley)\s+[0-9]+[\s,]*(?:SALUD|Salud|INTERIOR|HACIENDA)" + FIN + r",?(?:\s*[0-9]{4}\.?-?)?"),
    re.compile(INI + r"D\.O\.\s*[0-9]{2}\.[0-9]{2}\.[0-9]{4}"),
    re.compile(INI + r"VER NOTA\s*[0-9]*"),
    re.compile(INI + r"Art\.\s*(?:[0-9]+|primero|segundo|tercero|cuarto|[úu]nico|ÚNICO|UNICO)\s*(?:N[°º]\s*[0-9]+\s*(?:[a-z]\))?)?(?:\s*[IVX]+" + FIN + r")?(?:\s*(?:[a-z]\)\s*)+)?(?=\s)"),
    re.compile(INI + r"N[°º]\s*[0-9]+,?\s*(?:[a-z]\)\s*)+(?=\s)"),
    re.compile(INI + r"SALUD,\s*(?:[0-9]{4}\.?-?\s*)?(?:N[°º]\s*[0-9]+,?\s*(?:[a-z]\)\s*)*)?"),
    re.compile(INI + r"(?:Decreto|DS|DTO)\s+[0-9]+,\s*(?=[A-ZÁÉÍÓÚ])"),
    re.compile(INI + r"DS\s+[0-9]+,(?=\s)"),
]


def limpiar_anotaciones(texto):
    if "D.O." not in texto and "SALUD" not in texto:
        return texto
    t = texto
    for rx in _ANOTACIONES:
        t = rx.sub(" ", t)
    return re.sub(r"\s{2,}", " ", t).strip()


_NO_CORTAR = {"art", "arts", "n", "no", "nº", "núm", "num", "res", "ex", "dto", "d", "o", "sr", "sra", "dr", "inc",
              "pág", "pag", "ej", "lit", "min", "máx", "max", "aprox", "etc", "ss", "cfr", "vol", "i", "ii", "iii"}


def dividir_unidades(texto):
    """Parte un pasaje en unidades legibles: oraciones e ítems de enumeración."""
    t = re.sub(r"\s+", " ", texto or "").strip()
    # El encabezado "[Código Sanitario · Libro IV › …]" no es parte del artículo.
    t = re.sub(r"^\[[^\]]{0,300}\]\s*", "", t)
    cortes = []
    for m in re.finditer(r"(?<=[.;:])\s+(?=(?:[A-ZÁÉÍÓÚÑ¿\"“(]|[0-9]{1,3}[.)]|[a-z]\)|-\s))", t):
        antes = t[:m.start()]
        despues = t[m.end():m.end() + 4]
        if antes.endswith(":") and not re.match(r"(?:[0-9]{1,3}[.)]|[a-z]\)|-\s)", despues):
            continue
        palabra = re.search(r"([" + LETRA + r"º]+)[.;:]$", antes)
        if antes.endswith(".") and palabra and (palabra.group(1).lower() in _NO_CORTAR or len(palabra.group(1)) == 1):
            continue
        cortes.append(m.end())
    unidades, inicio = [], 0
    for c in cortes:
        u = t[inicio:c].strip()
        if u:
            unidades.append(u)
        inicio = c
    resto = t[inicio:].strip()
    if resto:
        unidades.append(resto)
    return unidades


def recortar(texto, largo=LARGO_FRASE):
    if len(texto) <= largo:
        return texto
    corte = texto.rfind(" ", 0, largo - 1)
    return texto[: corte if corte > largo * 0.6 else largo - 1].rstrip(" ,;:") + "…"


# --- Pregunta -----------------------------------------------------------------

def analizar_pregunta(pregunta, idx):
    voc = vocabulario()
    norm = normalizar(pregunta)
    conversacion = set(voc.get("palabras_de_pregunta", []))

    fuera = None
    for regla in voc.get("fuera_de_alcance", []):
        if re.search(regla["patron"], norm) and not (regla.get("excepto") and re.search(regla["excepto"], norm)):
            fuera = regla["materia"]
            break

    tipo = "general"
    sin_signos = re.sub(r"^[\s¿¡\"'(]+", "", norm)
    for nombre, rx in TIPOS_PREGUNTA:
        if rx.search(sin_signos):
            tipo = nombre
            break
    # La unidad del dato pedido no es un concepto a buscar: en "¿cuántos días
    # tengo para…?" la norma dirá "72 horas", no "días".
    propias_del_tipo = PALABRAS_DEL_TIPO.get(tipo, set())
    tokens = [t for t in dict.fromkeys(tokenize(pregunta)) if t not in conversacion and t not in propias_del_tipo]
    conceptos = []
    for t in tokens:
        r = stem(t)
        if any(c["raiz"] == r for c in conceptos):
            continue
        conceptos.append({"termino": t, "raiz": r, "peso": idx.idf_raiz(r), "alternativas": []})

    # Expansiones: cada frase agregada queda colgada del concepto que la disparó.
    extras = {}
    raices_pregunta = {stem(t) for t in tokenize(pregunta)}
    for entrada in voc.get("expansiones", []):
        # Una palabra suelta dispara por su raíz ("notifica" activa "notificar");
        # una frase, solo si aparece tal cual.
        disparadores = [s for s in entrada["si"]
                        if (stem(s) in raices_pregunta if " " not in s else contiene_frase(norm, s))]
        if not disparadores:
            continue
        palabras = {stem(w) for s in disparadores for w in tokenize(s)}
        dueno = next((c for c in conceptos if c["raiz"] in palabras), None)
        for frase in entrada["agregar"]:
            rs = [stem(w) for w in tokenize(frase)]
            if not rs:
                continue
            if dueno is not None and rs not in dueno["alternativas"]:
                dueno["alternativas"].append(rs)
            for w in tokenize(frase):
                if w not in tokens:
                    extras[w] = PESO_EXPANSION

    # Un infinitivo que no aparece en ninguna norma ("infringir") no significa que
    # la materia falte: la norma lo dice con un sustantivo ("infracción"). Se
    # descarta como concepto en vez de declarar ausencia por un verbo.
    conceptos = [c for c in conceptos
                 if not re.search(r"[a-z]{3,}(?:ar|er|ir)$", c["termino"]) or concepto_en_corpus(c, idx)]

    # En "¿Qué es un equivalente farmacéutico según el reglamento?" lo que se
    # define es "equivalente farmacéutico": el primer sustantivo tras "qué es",
    # no la palabra de mayor peso de la pregunta.
    definido = None
    if tipo == "definicion" and conceptos:
        m = re.search(r"(?:que|qué)\s+(?:es|son|se\s+considera|se\s+entiende\s+por)\s+(?:un|una|el|la|los|las|lo)?\s*(.+)", sin_signos)
        if m:
            primeras = [stem(t) for t in tokenize(m.group(1))][:3]
            candidatos_def = [c for c in conceptos if c["raiz"] in primeras]
            definido = max(candidatos_def, key=lambda c: c["peso"]) if candidatos_def else None
        definido = definido or max(conceptos, key=lambda c: c["peso"])

    return {"idx": idx, "normalizada": norm, "conceptos": conceptos, "definido": definido, "extras": extras, "tipo": tipo, "fuera_de_alcance": fuera,
            "pide_norma": bool(re.search(r"(?:existe|hay|habra)\s+(?:una|alguna|algun)?\s*(?:guia|norma|resolucion|decreto|reglamento|ley|instructivo)"
                                         r"|(?:que|cual|cuales)\s+(?:es\s+la\s+)?(?:norma|resolucion|decreto|reglamento|ley|guia)s?\s+(?:regula|establece|aprueba|exige|rige|trata)", norm)),
            "pide_ley": bool(re.search(r"\bley\b|\blegal\b|codigo sanitario|\bdfl\b", norm)),
            "numeros": set(re.findall(r"[0-9]+", pregunta)),
            "articulos": set(re.findall(r"art[íi]culo\s+([0-9]+)", pregunta.lower()))}


def concepto_en_corpus(c, idx):
    return c["raiz"] in idx.stem_idf or any(all(r in idx.stem_idf for r in alt) for alt in c["alternativas"])


def credito(c, raices_texto):
    """1 si está la palabra de la pregunta o una frase de norma de varias
    palabras; 0,7 si solo aparece una alternativa de una palabra (más ambigua);
    0 si no aparece."""
    if c["raiz"] in raices_texto:
        return 1.0
    mejor = 0.0
    for alt in c["alternativas"]:
        if all(r in raices_texto for r in alt):
            mejor = max(mejor, 1.0 if len(alt) > 1 else CREDITO_ALTERNATIVA)
    return mejor


def cobertura(conceptos, raices_texto):
    """Fracción del peso de los conceptos presente en el texto."""
    total = sum(c["peso"] for c in conceptos) or 1.0
    return sum(c["peso"] * credito(c, raices_texto) for c in conceptos) / total


def nucleo(conceptos):
    """Los dos conceptos más específicos de la pregunta (mayor peso), más
    cualquiera casi tan específico como el primero."""
    if not conceptos:
        return []
    orden = sorted(conceptos, key=lambda c: -c["peso"])
    tope = orden[0]["peso"]
    return orden[:2] + [c for c in orden[2:] if c["peso"] >= NUCLEO_FRACCION * tope]


def nucleo_cubierto(conceptos, raices_texto):
    """El núcleo tiene que estar en la frase. Sin esto, verbos de la pregunta
    inflaban la cobertura de frases que no hablaban del tema."""
    n = nucleo(conceptos)
    return bool(n) and all(credito(c, raices_texto) > 0 for c in n)


# --- Búsqueda -----------------------------------------------------------------

def puntajes_bm25(idx, pesos):
    scores = [0.0] * idx.N
    avgdl = idx.avgdl or 1.0
    for term, w in pesos.items():
        idf = idx.idf.get(term)
        if idf is None:
            continue
        for i, f in idx.postings.get(term, ()):
            denom = f + IX.K1 * (1 - IX.B + IX.B * idx.doc_len[i] / avgdl)
            scores[i] += w * idf * (f * (IX.K1 + 1)) / denom
    return scores


def mejor_frase(r, pq):
    """La unidad del pasaje que mejor responde, con su contexto mínimo."""
    unidades = dividir_unidades(r.get("texto", ""))
    if not unidades:
        return "", 0.0, False, False, False
    cue = CUES.get(pq["tipo"])
    mejor = (-1.0, 0, 0.0, False)
    for i, u in enumerate(unidades):
        cov = cobertura(pq["conceptos"], raices(u))
        tiene_dato = bool(cue.search(u)) if cue else False
        if pq["tipo"] == "definicion" and tiene_dato:
            # Una definición nombra el concepto central al comienzo de la frase y
            # lo define enseguida ("27) Equivalentes terapéuticos: …", "La receta
            # es el instrumento…"), no en cualquier parte del párrafo.
            tiene_dato = es_definicion_de(u, pq)
        puntaje = cov + (0.3 if tiene_dato else 0.0)
        if CONSIDERANDO.match(u):
            puntaje *= 0.6
        if puntaje > mejor[0]:
            mejor = (puntaje, i, cov, tiene_dato)
    _, i, cov, tiene_dato = mejor
    es_considerando = bool(CONSIDERANDO.match(unidades[i]))
    en_nucleo = nucleo_cubierto(pq["conceptos"], raices(unidades[i])) and not es_considerando
    frase = unidades[i]
    # Contexto: un ítem de enumeración necesita la frase que lo introduce, y una
    # frase que termina en ":" necesita lo que enumera.
    if re.match(r"^(?:[a-z]\)|[0-9]{1,3}[.)]|-\s)", frase):
        intro = next((unidades[j] for j in range(i - 1, -1, -1)
                      if unidades[j].endswith(":") and not re.match(r"^(?:[a-z]\)|[0-9]{1,3}[.)]|-\s)", unidades[j])), None)
        if intro:
            frase = recortar(intro, 160) + " " + frase
    elif len(frase) < 90 and i > 0 and unidades[i - 1].endswith(":"):
        frase = recortar(unidades[i - 1], 160) + " " + frase
    j = i + 1
    while frase.endswith(":") and j < len(unidades) and len(frase) < LARGO_FRASE:
        frase = frase + " " + unidades[j]
        j += 1
    return recortar(limpiar_anotaciones(frase)), cov, tiene_dato, en_nucleo, es_considerando


_ENCABEZADO = re.compile(r"^(?:(?:art[íi]culo|art\.)\s+[" + LETRA + r"º°]+(?:\s+(?:bis|ter|qu[aá]ter|[a-z])" + FIN + r")?\s*[.°º:-]*\s*|[0-9]{1,3}\)\s*|[a-z]\)\s*|[0-9]{1,3}\.-?\s*)+", re.I)


def es_definicion_de(unidad, pq):
    """¿La unidad DEFINE el concepto? Estructura de definición legal: el término
    va al comienzo y la definición empieza enseguida ("41) Farmacovigilancia:
    Conjunto de…", "La receta es el instrumento…", "Droguería es todo…"). Que el
    término aparezca en cualquier parte junto a un ":" no basta."""
    concepto = pq["definido"]
    if concepto is None:
        return False
    u = _ENCABEZADO.sub("", unidad, count=1)
    m = CUES["definicion"].search(u[:90])
    if not m or m.start() > 60:
        return False
    termino = re.sub(r"\([^)]*\)", " ", u[:m.start()])
    raices_termino = raices(termino)
    if credito(concepto, raices_termino) <= 0:
        return False
    # El término definido no puede traer palabras específicas que la pregunta no
    # trae: "Farmacia Homeopática es…" no define "farmacia", ni "Programa
    # Nacional de Farmacovigilancia:" define "farmacovigilancia".
    permitidas = {concepto["raiz"]} | {r for alt in concepto["alternativas"] for r in alt}
    for otro in pq["conceptos"]:
        permitidas.add(otro["raiz"])
        permitidas.update(r for alt in otro["alternativas"] for r in alt)
    return all(r in permitidas or pq["idx"].idf_raiz(r) < IDF_GENERICO for r in raices_termino)


def normalizados(idx):
    """Texto normalizado de cada pasaje, calculado una vez por índice."""
    cache = getattr(idx, "_normalizados", None)
    if cache is None:
        cache = [re.sub(r"\s+", " ", normalizar(r.get("texto", ""))) for r in idx.rows]
        idx._normalizados = cache
    return cache


def patron_definicion(pq):
    c = pq["definido"]
    terminos = [c["termino"]] + [" ".join(alt) for alt in c["alternativas"] if len(alt) > 1]
    # El texto ya viene normalizado (minúsculas, sin tildes): basta ASCII.
    alternativas = "|".join(t.replace(" ", r"\s") + r"[a-z0-9]{0,3}" for t in terminos)
    return re.compile(r"(?<![a-z0-9])(?:" + alternativas + r")[^.;:]{0,40}?(?::|(?<![a-z0-9])es (?:todo|toda|el|la|aquel|aquella|un|una|cualquier)(?![a-z0-9])|se entendera por)")


def es_ley(r):
    return r.get("tipo") in ("Ley", "Decreto con Fuerza de Ley")


def buscar(pregunta, idx=None, k=MAX_RESULTADOS, vigente=False, categoria=None, sin_ocr=False, pq=None):
    idx = idx or IX.load()
    pq = pq or analizar_pregunta(pregunta, idx)
    pesos = {c["termino"]: 1.0 for c in pq["conceptos"]}
    for w, p in pq["extras"].items():
        pesos.setdefault(w, p)
    base = puntajes_bm25(idx, pesos)
    mx = max(base) if base else 0.0
    if mx:
        base = [s / mx for s in base]

    # Las definiciones legales viven en listas largas ("se entenderá por:") donde
    # BM25 puntúa bajo o nada (la lista dice "equivalentes", la pregunta
    # "equivalente"). Se buscan también directamente por su forma.
    rx_def = patron_definicion(pq) if pq["tipo"] == "definicion" and pq["definido"] is not None else None
    norms = normalizados(idx) if rx_def is not None else None
    por_forma = set()

    previos = []
    for i, r in enumerate(idx.rows):
        if base[i] <= 0:
            if rx_def is None or not rx_def.search(norms[i]):
                continue
            por_forma.add(i)
        elif rx_def is not None and rx_def.search(norms[i]):
            por_forma.add(i)
        if vigente and r.get("vigencia") != "vigente":
            continue
        if categoria and categoria not in (r.get("categorias") or [r.get("categoria", "")]):
            continue
        if sin_ocr and r.get("fuente_texto") == "ocr":
            continue
        s = base[i]
        titulo_cov = cobertura(pq["conceptos"], raices(r.get("titulo", "")))
        s += 0.3 * titulo_cov
        numero = (r.get("numero") or "").lstrip("0")
        if numero and numero in {n.lstrip("0") for n in pq["numeros"]}:
            s += 1.0
        if pq["articulos"] and r.get("articulo"):
            m = re.search(r"[0-9]+", r["articulo"])
            if m and m.group(0) in pq["articulos"]:
                s += 0.8
        if r.get("seccion") == "preambulo":
            s *= 0.75
        previos.append((s, i, titulo_cov))
    previos.sort(key=lambda x: -x[0])

    candidatos = []
    vistos_texto = set()
    tope = CANDIDATOS_DEFINICION if pq["tipo"] == "definicion" else CANDIDATOS
    seleccion = previos[:tope]
    if por_forma:
        ya = {i for _, i, _ in seleccion}
        seleccion = seleccion + [x for x in previos if x[1] not in ya and x[1] in por_forma]
    for s, i, titulo_cov in seleccion:
        r = idx.rows[i]
        huella = re.sub(r"[^a-z0-9]+", "", normalizar(r.get("texto", "")))[:200]
        if huella in vistos_texto:
            continue
        vistos_texto.add(huella)
        frase, cov_frase, tiene_dato, en_nucleo, es_considerando = mejor_frase(r, pq)
        cov_pasaje = cobertura(pq["conceptos"], raices(r.get("texto", "")) | raices(r.get("titulo", "")))
        final = 0.35 * s + 0.40 * cov_frase + 0.15 * cov_pasaje + 0.20 * titulo_cov
        if pq["pide_norma"]:
            # "¿Existe una guía de…?", "¿qué norma regula…?": se busca la norma
            # misma, y la norma se reconoce por su título.
            final += 0.4 * titulo_cov
        if es_ley(r):
            # Rango legal: ante empate, la ley antes que el reglamento; y si la
            # pregunta pide explícitamente la ley, bastante antes.
            final += BONO_LEY_PEDIDA if pq["pide_ley"] else BONO_LEY
        if tiene_dato and pq["tipo"] in CUES:
            if pq["tipo"] == "definicion":
                final += BONO_DEFINICION
            else:
                final += BONO_DATO_ESTRICTO if pq["tipo"] in TIPOS_CON_DATO else BONO_DATO_LAXO
        if r.get("seccion") == "preambulo" or es_considerando:
            final *= 0.75
        if r.get("fuente_texto") == "ocr":
            final *= 0.95
        if r.get("vigencia") != "vigente":
            final *= 0.9
        candidatos.append({"puntaje": final, "i": i, "fila": r, "frase": frase, "cobertura_frase": cov_frase,
                           "cobertura_pasaje": cov_pasaje, "tiene_dato": tiene_dato, "nucleo": en_nucleo})
    candidatos.sort(key=lambda c: -c["puntaje"])

    salida, por_doc, por_norma, vistas = [], defaultdict(int), defaultdict(int), set()
    for c in candidatos:
        r = c["fila"]
        doc = r.get("doc_id")
        norma = r.get("norma_id") or doc
        firma = re.sub(r"[^a-z0-9]+", "", normalizar(c["frase"]))[:160]
        if firma in vistas or por_doc[doc] >= MAX_POR_DOCUMENTO or por_norma[norma] >= MAX_POR_NORMA:
            continue
        vistas.add(firma)
        por_doc[doc] += 1
        por_norma[norma] += 1
        salida.append(c)
        if len(salida) >= k:
            break

    # Jerarquía: si la ley dice lo mismo casi con la misma fuerza que un
    # reglamento, va primero la ley.
    if len(salida) > 1 and not es_ley(salida[0]["fila"]):
        for j, c in enumerate(salida[1:4], start=1):
            if es_ley(c["fila"]) and c["puntaje"] >= 0.9 * salida[0]["puntaje"] and \
                    (c["tiene_dato"] or pq["tipo"] not in TIPOS_CON_DATO) and c["cobertura_frase"] >= salida[0]["cobertura_frase"] - 0.1:
                salida.insert(0, salida.pop(j))
                break
    return salida, pq


# --- Presentación -------------------------------------------------------------

ABREV_TIPO = {
    "Decreto Supremo": "DS", "Decreto Exento": "D. Ex.", "Resolución Exenta": "Res. Ex.", "Norma Técnica": "NT",
    "Decreto con Fuerza de Ley": "DFL", "Ley": "Ley", "Decreto": "Decreto", "Circular": "Circular",
}


def formato_numero(n):
    n = (n or "").strip()
    if n.isdigit() and len(n) >= 4:
        return "{:,}".format(int(n)).replace(",", ".")
    return n


def articulo_corto(a):
    a = (a or "").strip()
    m = re.match(r"(?i)art(?:[íi]culo|\.)\s*(.*)$", a)
    if not m:
        return a
    resto = re.sub(r"[º°]", "", m.group(1)).strip().rstrip(".-").strip()
    return "art. " + resto.lower() if resto and not resto[0].isdigit() else "art. " + resto


def cita_corta(r):
    if r.get("numero") == "725" and r.get("tipo") == "Decreto con Fuerza de Ley":
        base = "Código Sanitario"
    else:
        tipo = ABREV_TIPO.get(r.get("tipo", ""), r.get("tipo", ""))
        base = " ".join(x for x in [tipo, formato_numero(r.get("numero", ""))] if x) or r.get("doc_id", "")
    if r.get("articulo"):
        return base + " · " + articulo_corto(r["articulo"])
    if r.get("pagina"):
        return base + " · pág. " + str(r["pagina"])
    return base


ETIQUETAS_CATEGORIA = {
    "cosmeticos": "Cosméticos", "ensayos_clinicos": "Ensayos clínicos",
    "establecimientos_autorizacion_y_fiscalizacion": "Establecimientos",
    "farmacovigilancia": "Farmacovigilancia",
    "importacion_y_exportacion_control_y_vigilancia": "Importación y exportación",
    "laboratorio_nacional_de_control": "Laboratorio Nacional de Control",
    "medicamentos": "Medicamentos", "codigo_sanitario": "Código Sanitario", "otros": "Otras normas ISP",
}


def avisos_de(c):
    r = c["fila"]
    avisos = []
    if r.get("disposicion_modificada"):
        nombres = []
        for m in r.get("modificada_por") or []:
            n = " ".join(x for x in [m.get("tipo", ""), formato_numero(m.get("numero", ""))] if x)
            if n and n not in nombres:
                nombres.append(n)
        por = ", ".join(nombres[:2])
        avisos.append("Este punto fue modificado" + (" por " + por if por else "") +
                      ". El texto que ves es el original: revisa la norma modificatoria.")
    if r.get("fuente_texto") == "ocr" and re.search(r"[0-9]", c["frase"]):
        avisos.append("Texto escaneado (OCR): confirma las cifras en el documento oficial.")
    if r.get("vigencia") != "vigente":
        avisos.append("Vigencia no verificada contra el listado oficial del ISP.")
    return avisos


def resultado_publico(c, pq):
    r = c["fila"]
    return {
        "cita": cita_corta(r),
        "norma": " ".join(x for x in [r.get("tipo", ""), formato_numero(r.get("numero", ""))] if x),
        "titulo": r.get("titulo", ""),
        "articulo": r.get("articulo", ""),
        "pagina": r.get("pagina") or None,
        "categoria": ETIQUETAS_CATEGORIA.get(r.get("categoria", ""), (r.get("categoria", "") or "").replace("_", " ")),
        "frase": c["frase"],
        "resaltar": resaltados(c["frase"], pq),
        "texto": r.get("texto", ""),
        "fuente_url": r.get("fuente_url", ""),
        "es_ocr": r.get("fuente_texto") == "ocr",
        "avisos": avisos_de(c),
        "_cobertura_frase": round(c["cobertura_frase"], 3),
        "_tiene_dato": c["tiene_dato"],
        "_doc_id": r.get("doc_id", ""),
        "_numero": r.get("numero", ""),
        "_tipo": r.get("tipo", ""),
    }


def resaltados(frase, pq):
    """Tramos [inicio, fin) a destacar: el dato pedido y las palabras de la pregunta."""
    tramos = []
    cue = CUES.get(pq["tipo"])
    if cue and pq["tipo"] not in ("definicion", "quien", "permiso", "requisitos"):
        tramos += [[m.start(), m.end()] for m in cue.finditer(frase)]
    objetivos = set()
    for c in pq["conceptos"]:
        objetivos.add(c["raiz"])
        for alt in c["alternativas"]:
            if len(alt) == 1:
                objetivos.add(alt[0])
    for m in re.finditer(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+", frase):
        w = normalizar(m.group(0))
        if len(w) >= 4 and stem(w) in objetivos:
            tramos.append([m.start(), m.end()])
    tramos.sort()
    unidos = []
    for a, b in tramos:
        if unidos and a <= unidos[-1][1] + 1:
            unidos[-1][1] = max(unidos[-1][1], b)
        else:
            unidos.append([a, b])
    return unidos


def _cantidades(frase, cue):
    """{forma normalizada: forma original} de cada plazo mencionado en la frase."""
    out = {}
    for m in cue.finditer(frase):
        original = re.sub(r"\s+", " ", m.group(0)).strip()
        out.setdefault(re.sub(r"\s+", " ", normalizar(original)), original)
    return out


def responder(pregunta, idx=None, vigente=False, categoria=None, sin_ocr=False, k=MAX_RESULTADOS):
    idx = idx or IX.load()
    pq = analizar_pregunta(pregunta, idx)
    vacia = {"pregunta": pregunta, "tipo": pq["tipo"], "principal": None, "relacionadas": [], "avisos": []}

    if not pq["conceptos"]:
        return dict(vacia, estado="ausente", titular="Escribe la pregunta con un poco más de detalle.",
                    motivo="La pregunta no trae términos que se puedan buscar en la normativa.",
                    conceptos_fuera=[])
    if pq["fuera_de_alcance"]:
        return dict(vacia, estado="ausente", titular="Esto no está en nuestra base.",
                    motivo="La base cubre la normativa del ISP/ANAMED y el Código Sanitario; no incluye " +
                           pq["fuera_de_alcance"] + ".",
                    conceptos_fuera=[])

    # Conceptos que no existen en ningún pasaje, ni por sí mismos ni por sus
    # alternativas de norma: la materia no está en la base.
    fuera = []
    total = sum(c["peso"] for c in pq["conceptos"]) or 1.0
    for c in pq["conceptos"]:
        if not concepto_en_corpus(c, idx):
            fuera.append(c)
    peso_fuera = sum(c["peso"] for c in fuera) / total
    if peso_fuera >= PESO_FUERA_CORPUS_MAX:
        palabras = ", ".join("«" + c["termino"] + "»" for c in fuera[:4])
        return dict(vacia, estado="ausente", titular="Esto no está en nuestra base.",
                    motivo="No encontramos " + palabras + " en ninguna norma de la base (ISP/ANAMED y Código Sanitario).",
                    conceptos_fuera=[c["termino"] for c in fuera])

    salida, pq = buscar(pregunta, idx=idx, k=k, vigente=vigente, categoria=categoria, sin_ocr=sin_ocr, pq=pq)
    if not salida:
        return dict(vacia, estado="ausente", titular="No encontramos una norma que responda esto.",
                    motivo="Ningún pasaje de la base trata esta materia.", conceptos_fuera=[])

    p = salida[0]
    exige_dato = pq["tipo"] in TIPOS_CON_DATO
    dato_ok = p["tiene_dato"] or not exige_dato
    umbral = UMBRAL_ENCONTRADO if (exige_dato and p["tiene_dato"]) else UMBRAL_ENCONTRADO_SIN_DATO
    # Sin un dato verificable (preguntas generales o de permiso), el verde exige
    # que TODAS las palabras de la pregunta estén literalmente en la frase: una
    # frase que solo calza por sinónimos es "parcial", no "encontrado".
    literal = exige_dato or all(c["raiz"] in raices(p["frase"]) for c in pq["conceptos"])
    if p["cobertura_frase"] >= umbral and p["cobertura_pasaje"] >= UMBRAL_PASAJE_ENCONTRADO and dato_ok \
            and p["nucleo"] and literal:
        estado, titular = "encontrado", "Encontrado en la norma"
        motivo = "La frase destacada responde la pregunta."
    elif (p["cobertura_pasaje"] >= UMBRAL_PARCIAL or p["cobertura_frase"] >= UMBRAL_PARCIAL) and \
            principal_en(p, pq):
        estado, titular = "parcial", "Respuesta parcial: revisa si aplica a tu caso"
        if exige_dato and not p["tiene_dato"]:
            faltante = {"plazo": "un plazo", "monto": "un monto", "temperatura": "una temperatura",
                        "definicion": "una definición", "quien": "quién debe hacerlo"}[pq["tipo"]]
            motivo = "Encontramos la norma relacionada, pero su texto no indica " + faltante + " para lo que preguntas."
        else:
            motivo = "La norma más cercana trata el tema, pero no responde toda la pregunta."
    else:
        estado, titular = "ausente", "No encontramos una norma que responda esto."
        motivo = "Los textos más cercanos tratan otra materia. Prueba con otras palabras o consúltanos."

    principal = resultado_publico(p, pq)
    relacionadas = [resultado_publico(c, pq) for c in salida[1:]]

    avisos = []
    if estado != "ausente" and pq["tipo"] == "plazo":
        cue = CUES["plazo"]
        vistos = {}
        for c in salida[:3]:
            if c["tiene_dato"]:
                cant = _cantidades(c["frase"], cue)
                if cant:
                    destino = vistos.setdefault(cita_corta(c["fila"]).split(" · ")[0], {})
                    for clave, original in cant.items():
                        destino.setdefault(clave, original)
        if len(vistos) >= 2 and len({frozenset(v) for v in vistos.values()}) >= 2:
            detalle = "; ".join(", ".join(sorted(v.values())) + " en " + norma for norma, v in vistos.items())
            avisos.append("Las normas encontradas indican plazos distintos (" + detalle +
                          "). Revisa a quién aplica cada uno.")
    if estado != "ausente" and not es_ley(p["fila"]) and any(
            es_ley(c["fila"]) and c["cobertura_frase"] >= UMBRAL_PARCIAL for c in salida[1:3]):
        avisos.append("También hay texto de ley sobre esto. Si difiere del reglamento, prima la ley.")

    return {
        "pregunta": pregunta, "tipo": pq["tipo"], "estado": estado, "titular": titular, "motivo": motivo,
        "principal": principal if estado != "ausente" else None,
        "relacionadas": relacionadas if estado != "ausente" else [principal] + relacionadas,
        "avisos": avisos, "conceptos_fuera": [],
    }


def principal_en(c, pq):
    """Al menos uno de los dos conceptos más específicos de la pregunta tiene
    que aparecer en el pasaje. Si ninguno aparece, lo encontrado habla de otra
    cosa y no merece ni un "parcial"."""
    r = c["fila"]
    rs = raices(r.get("texto", "")) | raices(r.get("titulo", ""))
    return any(credito(x, rs) > 0 for x in nucleo(pq["conceptos"]))


def legado(resp):
    """Campos que siguen guardándose en la tabla `consultas` y usa el panel."""
    mapa = {"encontrado": ("alta", "responder"), "parcial": ("media", "responder_con_reservas"),
            "ausente": ("baja", "declarar_ausencia")}
    confianza, recomendacion = mapa[resp["estado"]]
    top = resp["principal"] or (resp["relacionadas"][0] if resp["relacionadas"] else None)
    return {"confianza": confianza, "recomendacion": recomendacion,
            "cobertura_top": top["_cobertura_frase"] if top else 0.0,
            "conceptos_fuera_del_corpus": resp.get("conceptos_fuera", []),
            "top_cita": top["cita"] if top else None}


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Responde con la frase exacta de la norma (sin IA)")
    ap.add_argument("pregunta")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    resp = responder(args.pregunta)
    if args.json:
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        return
    print("\n" + resp["titular"] + "  ·  " + resp["estado"] + "  ·  tipo: " + resp["tipo"])
    print("  " + resp["motivo"])
    for a in resp["avisos"]:
        print("  Ojo: " + a)
    if resp["principal"]:
        p = resp["principal"]
        print("\n  " + p["cita"] + " — " + p["titulo"][:90])
        print("  «" + p["frase"] + "»")
        for a in p["avisos"]:
            print("  Ojo: " + a)
    for r in resp["relacionadas"]:
        print("\n  · " + r["cita"] + " — «" + r["frase"][:200] + "»")


if __name__ == "__main__":
    main()
