#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
query.py — Motor de recuperación del Cerebro Regulatorio.

Búsqueda HÍBRIDA sobre corpus/corpus.jsonl (índice invertido en corpus/indice.pkl):
  - BM25 sobre el texto de cada pasaje,
  - boost por número de norma / referencia a artículo (crítico en dominio legal),
  - descuento a los preámbulos (VISTOS/CONSIDERANDOS), que puntúan alto por
    densidad jurídica pero rara vez traen la obligación concreta.

Además calcula una SEÑAL DE CONFIANZA explícita. BM25 siempre devuelve los k
pasajes más cercanos, así que una pregunta respondible y una que cae fuera del
corpus salían idénticas: mismos puntajes, misma pinta. Esa era la razón por la
que la regla anti-invención vivía solo en prosa. Aquí la confianza se mide:

  cobertura        fracción del peso IDF de la consulta que aparece en ALGÚN
                   pasaje recuperado,
  cobertura_top    lo mismo pero exigiendo que aparezca en UN SOLO pasaje —
                   es la señal fuerte: si ningún pasaje reúne los términos
                   específicos de la pregunta, nadie la está respondiendo,
  margen           distancia relativa entre el 1er puntaje y la mediana del resto.

Si la confianza es `baja`, `recomendacion` vale `declarar_ausencia` y la capa de
síntesis debe responder "No encontré esto en el corpus".

No sintetiza la respuesta: entrega evidencia con cita trazable.

Uso:
  python query.py "cambio post-registro de un producto farmacéutico"
  python query.py "plazo para notificar reacciones adversas" --k 6 --vigente
  python query.py "buenas prácticas de manufactura estériles" --json
  python query.py "requisitos GCP ensayos clínicos" --categoria ensayos_clinicos
  python query.py "registro de un dispositivo médico" --json   # -> confianza baja

Sin dependencias externas (BM25 en Python puro).
"""

import argparse
import json
import re
import sys
from collections import defaultdict

import indice as IX
from indice import tokenize, strip_accents, stem

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # consolas Windows (cp1252) no soportan emoji/acentos

TITLE_WEIGHT = 0.9      # el título curado es un campo de alto peso (estilo BM25F)
PREAMBULO_FACTOR = 0.75  # descuento a vistos/considerandos (hallazgo 09)

# Umbrales de la señal de confianza. Calibrados contra las 16 preguntas doradas
# (las 16 deben quedar en media o alta) y contra consultas deliberadamente fuera
# del corpus —dispositivos médicos, alimentos, veterinaria— que deben caer todas
# en baja. Re-calibrar con: python calibrar_confianza.py
COBERTURA_TOP_MIN = 0.50
COBERTURA_MIN = 0.50
COBERTURA_TOP_ALTA = 0.70
COBERTURA_ALTA = 0.80
# Si los conceptos que NO existen en ningún pasaje del corpus pesan más que esto,
# la consulta trata de algo que el corpus simplemente no cubre. Es la señal de
# mayor precisión que hay: no depende de qué se recuperó, sino de qué no existe.
PESO_FUERA_CORPUS_MAX = 0.20
# La confianza se mide siempre sobre una ventana fija de evidencia, no sobre el
# `k` que pidió quien consulta: si no, la misma pregunta pasa de "respondible" a
# "fuera del corpus" solo por haber pedido 5 pasajes en vez de 6.
VENTANA_CONFIANZA = 8


def query_numbers(q):
    """Números presentes en la consulta (posibles nº de norma o de artículo)."""
    return set(re.findall(r"\d+", q))


def query_articles(q):
    """Referencias a 'artículo N' en la consulta."""
    return set(re.findall(r"art[íi]culo\s+(\d+)", q.lower()))


# --- Confianza ----------------------------------------------------------------

def _terminos_pasaje(r):
    """Raíces presentes en un pasaje (texto + título)."""
    return ({stem(t) for t in tokenize(r.get("texto", ""))}
            | {stem(t) for t in tokenize(r.get("titulo", ""))})


def evaluar_confianza(idx, query, resultados):
    """Mide si la evidencia recuperada realmente cubre la consulta."""
    q_raw = list(dict.fromkeys(tokenize(query)))
    q_terms = list(dict.fromkeys(stem(t) for t in q_raw))
    peso_raw = {stem(t): idx.idf_raiz(stem(t)) for t in q_raw}
    if not q_terms or not resultados:
        return {
            "confianza": "baja",
            "cobertura": 0.0,
            "cobertura_top": 0.0,
            "margen": 0.0,
            "terminos_ausentes": q_terms,
            "recomendacion": "declarar_ausencia",
            "motivo": "sin resultados" if q_terms else "consulta sin términos de contenido",
        }

    pesos = peso_raw
    total = sum(pesos.values()) or 1.0

    conjuntos = [_terminos_pasaje(r) for _, r in resultados]
    union = set().union(*conjuntos) if conjuntos else set()
    presentes = [t for t in q_terms if t in union]
    ausentes = [t for t in q_terms if t not in union]
    cobertura = sum(pesos[t] for t in presentes) / total
    cobertura_top = max(
        (sum(pesos[t] for t in q_terms if t in s) / total for s in conjuntos), default=0.0
    )

    scores = [s for s, _ in resultados]
    if len(scores) >= 3:
        resto = sorted(scores[1:])
        mediana = resto[len(resto) // 2]
        margen = (scores[0] - mediana) / scores[0] if scores[0] else 0.0
    else:
        margen = 0.0

    # Conceptos que no existen en NINGÚN pasaje del corpus (no solo en los
    # recuperados): la pregunta trata de una materia que el corpus no cubre.
    fuera = [t for t in q_terms if t not in (getattr(idx, "stem_idf", None) or {})]
    peso_fuera = sum(pesos[t] for t in fuera) / total

    if peso_fuera >= PESO_FUERA_CORPUS_MAX:
        confianza, recomendacion = "baja", "declarar_ausencia"
        motivo = ("el corpus no contiene ningún pasaje sobre: " + ", ".join(fuera[:6])
                  + " — la materia consultada está fuera del alcance del corpus")
    elif cobertura_top >= COBERTURA_TOP_ALTA and cobertura >= COBERTURA_ALTA:
        confianza, recomendacion, motivo = "alta", "responder", "la evidencia cubre la consulta"
    elif cobertura_top >= COBERTURA_TOP_MIN and cobertura >= COBERTURA_MIN:
        confianza, recomendacion = "media", "responder_con_reservas"
        motivo = "ningún pasaje reúne toda la consulta; contrastar entre pasajes"
    else:
        confianza, recomendacion = "baja", "declarar_ausencia"
        motivo = ("los pasajes recuperados no cubren los términos específicos de la consulta"
                  + (" (ausentes: " + ", ".join(ausentes[:6]) + ")" if ausentes else ""))

    return {
        "confianza": confianza,
        "cobertura": round(cobertura, 3),
        "cobertura_top": round(cobertura_top, 3),
        "margen": round(margen, 3),
        "terminos_ausentes": ausentes,
        "conceptos_fuera_del_corpus": fuera,
        "recomendacion": recomendacion,
        "motivo": motivo,
    }


# --- Búsqueda -----------------------------------------------------------------

def _en_categoria(r, categoria):
    cats = r.get("categorias") or [r.get("categoria", "")]
    return categoria in cats


def search(query, k=5, vigente=False, categoria=None, sin_ocr=False, idx=None):
    """Devuelve [(score, chunk)] ordenado. El índice se puntúa completo y los
    filtros se aplican después, para que el IDF —y por tanto el ranking— no
    dependa de qué filtros haya puesto el usuario."""
    idx = idx or IX.load()
    rows = idx.rows
    if not rows:
        return []

    base = idx.scores(tokenize(query))
    mx = max(base) if base else 0.0
    if mx:
        base = [s / mx for s in base]  # normalizar a [0,1]

    qnums = query_numbers(query)
    qnums_norm = {n.lstrip("0") for n in qnums}
    qarts = query_articles(query)
    q_terms = set(tokenize(query))

    scored = []
    for i, r in enumerate(rows):
        if vigente and r.get("vigencia") != "vigente":
            continue
        if categoria and not _en_categoria(r, categoria):
            continue
        if sin_ocr and r.get("fuente_texto") == "ocr":
            continue

        score = base[i]
        # Boost por coincidencia con el título/descripción curada de la norma.
        if q_terms:
            overlap = len(q_terms & idx.title_tokens[i]) / len(q_terms)
            score += TITLE_WEIGHT * overlap
        # Boost por número de norma citado en la consulta
        numero = r.get("numero") or ""
        if numero and numero.lstrip("0") in qnums_norm:
            score += 1.5
        # Boost por referencia a artículo específico
        if qarts and r.get("articulo"):
            art_n = re.search(r"\d+", r["articulo"])
            if art_n and art_n.group(0) in qarts:
                score += 1.2
        # Boost léxico: número exacto compartido entre consulta y texto
        if qnums & set(re.findall(r"\d+", r.get("texto", ""))):
            score += 0.15
        # Descuento al preámbulo: es texto ceremonial, no la obligación.
        if r.get("seccion") == "preambulo":
            score *= PREAMBULO_FACTOR
        if score > 0:
            scored.append((score, i))

    scored.sort(key=lambda x: -x[0])

    # Diversificar: hasta 2 pasajes DISTINTOS por norma, sin repetir el mismo
    # pasaje. `norma_id` identifica la norma aunque dos normas compartan número
    # en categorías distintas (el ISP tiene ese caso: dos Res. Ex. 2.053).
    out, per_norma, seen_sig = [], defaultdict(int), set()
    for score, i in scored:
        r = rows[i]
        norma_key = r.get("norma_id") or r.get("doc_id")
        art_or_prefix = r.get("articulo") or strip_accents(re.sub(r"\W+", "", r.get("texto", "")[:80]).lower())
        sig = (norma_key, art_or_prefix, r.get("pagina"))
        if sig in seen_sig or per_norma[norma_key] >= 2:
            continue
        seen_sig.add(sig)
        per_norma[norma_key] += 1
        out.append((score, r))
        if len(out) >= k:
            break
    return out


def analizar(query, k=5, vigente=False, categoria=None, sin_ocr=False, idx=None):
    """Recupera k pasajes y calcula la confianza sobre una ventana fija.
    Es el punto de entrada que deberían usar la CLI, la evaluación y cualquier
    consumidor: garantiza que la señal de confianza no dependa de `k`."""
    idx = idx or IX.load()
    opts = dict(vigente=vigente, categoria=categoria, sin_ocr=sin_ocr, idx=idx)
    ventana = search(query, k=max(k, VENTANA_CONFIANZA), **opts)
    resultados = ventana[:k]
    return resultados, evaluar_confianza(idx, query, ventana)


# --- Presentación -------------------------------------------------------------

def marca_vigencia(r):
    if r.get("disposicion_modificada"):
        return "⛔ disposición modificada"
    if r.get("vigencia") == "vigente":
        return "✅ vigente (norma modificada)" if r.get("modificada") else "✅ vigente"
    return "⚠️ vigencia no verificada"


def cite(r):
    tn = " ".join(x for x in [r.get("tipo", ""), r.get("numero", "")] if x) or r.get("doc_id", "")
    art = " · " + r["articulo"] if r.get("articulo") else ""
    ocr = " · ⚠ texto OCR" if r.get("fuente_texto") == "ocr" else ""
    # Página 0 = fuente sin paginación (el XML refundido de la BCN). Ver la
    # nota equivalente en web/lib/search.ts: "pág. 0" sería una cita falsa.
    pag = (" · pág. " + str(r.get("pagina"))) if r.get("pagina") else ""
    return tn + pag + art + " · " + marca_vigencia(r) + ocr


def main():
    ap = argparse.ArgumentParser(description="Recuperación de normativa con citas trazables")
    ap.add_argument("query", help="consulta en lenguaje natural")
    ap.add_argument("--k", type=int, default=5, help="nº de pasajes a devolver")
    ap.add_argument("--vigente", action="store_true", help="solo normas con vigencia verificada")
    ap.add_argument("--categoria", help="filtrar por categoría (carpeta ANAMED)")
    ap.add_argument("--sin-ocr", dest="sin_ocr", action="store_true",
                    help="excluir pasajes provenientes de OCR (cifras poco confiables)")
    ap.add_argument("--json", action="store_true", help="salida JSON (para la capa de síntesis)")
    args = ap.parse_args()

    idx = IX.load()
    results, conf = analizar(args.query, k=args.k, vigente=args.vigente,
                             categoria=args.categoria, sin_ocr=args.sin_ocr, idx=idx)

    if args.json:
        payload = [{
            "score": round(s, 3),
            "cita": cite(r),
            "titulo": r.get("titulo", ""),
            "tipo": r.get("tipo", ""), "numero": r.get("numero", ""),
            "categoria": r.get("categoria", ""), "categorias": r.get("categorias", []),
            "articulo": r.get("articulo", ""), "pagina": r.get("pagina", ""),
            "seccion": r.get("seccion", ""),
            "vigencia": r.get("vigencia", ""), "vigencia_fuente": r.get("vigencia_fuente", ""),
            "modificada": r.get("modificada", False),
            "modificada_por": r.get("modificada_por", []),
            "disposicion_modificada": r.get("disposicion_modificada", False),
            "alerta_vigencia": r.get("alerta_vigencia", ""),
            "fuente_texto": r.get("fuente_texto", ""),
            "alertas_ocr": r.get("alertas_ocr", []),
            "pdf_path": r.get("pdf_path", ""), "fuente_url": r.get("fuente_url", ""),
            "texto": r.get("texto", ""),
        } for s, r in results]
        print(json.dumps({"query": args.query, "confianza": conf, "resultados": payload},
                         ensure_ascii=False, indent=2))
        return

    if not results:
        print("Sin resultados en el corpus. (El cerebro no inventa: declara ausencia de fuente.)")
        return

    icono = {"alta": "🟢", "media": "🟡", "baja": "🔴"}[conf["confianza"]]
    print('\n🔎  "' + args.query + '"  —  ' + str(len(results)) + " pasajes")
    print("    " + icono + " confianza " + conf["confianza"]
          + "  ·  cobertura " + str(conf["cobertura"]) + " (mejor pasaje " + str(conf["cobertura_top"]) + ")"
          + "  ·  " + conf["motivo"])
    if conf["recomendacion"] == "declarar_ausencia":
        print("    ⚠️  La evidencia NO alcanza: corresponde responder «No encontré esto en el corpus».")
    print()
    for i, (s, r) in enumerate(results, 1):
        print("[" + str(i) + "] " + cite(r) + "   (score " + ("%.2f" % s) + ")")
        print("    " + r.get("titulo", "")[:100])
        if r.get("alerta_vigencia"):
            print("    " + r["alerta_vigencia"])
        for a in r.get("alertas_ocr", []):
            print("    ⚠ OCR: " + a)
        snippet = re.sub(r"\s+", " ", r.get("texto", "")).strip()
        print("    “" + snippet[:320] + "…”")
        # El Código Sanitario no viene de un PDF local: sin esta guarda quedaba
        # una flecha apuntando a la nada debajo de cada uno de sus pasajes.
        if r.get("pdf_path"):
            print("    ↳ " + r["pdf_path"])
        if r.get("fuente_url"):
            print("    ↳ fuente: " + r["fuente_url"])
        print()


if __name__ == "__main__":
    main()
