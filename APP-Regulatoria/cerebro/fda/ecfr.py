#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ecfr.py — Ingesta y vigilancia del 21 CFR (FDA) desde el eCFR.

## ⚠️ ESTA SECCIÓN NO ESTÁ EN VIVO

Nada de este módulo entra al corpus de producción. `build_corpus.py` NO lo
importa, y su salida se escribe en `fda/corpus/`, que no es la carpeta que
publica el pipeline. Es deliberado: la sección FDA se está preparando, no
lanzando. Para conectarla algún día hay que hacer tres cosas —y las tres a
conciencia, no por descuido— descritas al final de `fda/README.md`.

## Por qué el eCFR y no fda.gov

El eCFR publica el CFR **consolidado y vigente**, con la misma virtud que tiene
la BCN para el Código Sanitario y que un PDF nunca da:

- `latest_amended_on` por título: la fecha de la última enmienda incorporada.
  Es la señal de frescura, y es lo que permite vigilar cambios.
- XML estructurado en PART › SUBPART › SECTION (`DIV5` › `DIV6` › `DIV8`), así
  que la sección —la unidad que se cita, «21 CFR 211.22»— es un elemento del
  documento y no algo que haya que adivinar con una expresión regular.
- `CITA`: cada sección arrastra su historia de enmiendas («[43 FR 45077, Sept.
  29, 1978, as amended at 73 FR 51931, Sept. 8, 2008]»), que es trazabilidad
  regulatoria de verdad.

## Qué NO se baja

El título 21 completo son 275 partes y 8.408 secciones, y la mayor parte
—aditivos alimentarios, tabaco, salud radiológica, medicamentos veterinarios—
no toca el trabajo de este proyecto. Se bajan las 36 partes curadas en
`partes-prioritarias.json`, cada una con el motivo escrito. Ampliar la lista es
editar ese archivo; no hay nada más que tocar.

## Detalle operativo que cuesta descubrir

El endpoint `/full/` responde **406** si el request no acepta compresión. No lo
dice la documentación, lo dice el cuerpo del error. Por eso `_pedir()` manda
siempre `Accept-Encoding: gzip` y descomprime a mano.

Uso:
    python ecfr.py --inventario          # qué se bajaría y por qué
    python ecfr.py --descargar           # baja las partes prioritarias
    python ecfr.py --construir           # arma fda/corpus/corpus-fda.jsonl
    python ecfr.py --vigilar             # compara con la versión anterior
"""

import gzip
import hashlib
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
FUENTES = BASE / "fuentes"
CORPUS_DIR = BASE / "corpus"
PRIORITARIAS = BASE / "partes-prioritarias.json"
REFERENCIA = BASE / "estado-vigilancia.json"

API = "https://www.ecfr.gov/api/versioner/v1"
TITULO = 21
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

CHUNK_CHARS = 1500   # mismo tamaño que el resto del corpus, para no partir el ranking


# --- Red ----------------------------------------------------------------------

def _pedir(url, timeout=120):
    """GET con compresión obligatoria (ver la nota del encabezado)."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Encoding": "gzip",
        "Accept": "application/json, application/xml, text/xml, */*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        datos = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            datos = gzip.GzipFile(fileobj=io.BytesIO(datos)).read()
    return datos


def version_vigente():
    """{'latest_amended_on': ..., 'up_to_date_as_of': ...} del título 21."""
    d = json.loads(_pedir(API + "/titles.json"))
    for t in d.get("titles", []):
        if t.get("number") == TITULO:
            return t
    raise ValueError("El eCFR no devolvió el título " + str(TITULO))


def descargar(partes=None, fecha=None):
    """Baja el XML de cada parte prioritaria. Devuelve (fecha, {parte: bytes})."""
    meta = version_vigente()
    fecha = fecha or meta["latest_amended_on"]
    partes = partes or [p["parte"] for p in cargar_prioritarias()]

    FUENTES.mkdir(parents=True, exist_ok=True)
    bajadas, fallidas = {}, []
    for p in partes:
        url = API + "/full/" + fecha + "/title-" + str(TITULO) + ".xml?part=" + p
        try:
            datos = _pedir(url)
            # Validación antes de escribir: una parte vacía o un cuerpo de error
            # se escribiría sin quejarse y recién fallaría al parsear.
            raiz = ET.fromstring(datos)
            if raiz.get("N") != p:
                raise ValueError("el XML dice ser la parte " + repr(raiz.get("N")))
            destino = FUENTES / ("part-" + p + ".xml")
            tmp = destino.with_suffix(".xml.tmp")
            tmp.write_bytes(datos)
            tmp.replace(destino)
            bajadas[p] = len(datos)
        except Exception as e:
            fallidas.append((p, str(e)))

    (FUENTES / "_version.json").write_text(json.dumps({
        "titulo": TITULO,
        "fecha_solicitada": fecha,
        "latest_amended_on": meta.get("latest_amended_on"),
        "up_to_date_as_of": meta.get("up_to_date_as_of"),
        "descargado": datetime.now().astimezone().isoformat(timespec="seconds"),
        "partes_ok": sorted(bajadas),
        "partes_fallidas": [p for p, _ in fallidas],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    return fecha, bajadas, fallidas


# --- Curaduría ----------------------------------------------------------------

def cargar_prioritarias():
    return json.loads(PRIORITARIAS.read_text(encoding="utf-8"))["partes"]


# --- Parseo -------------------------------------------------------------------

def _texto(el):
    """Texto plano de un elemento, con el espacio normalizado."""
    t = "".join(el.itertext())
    t = t.replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def parsear(path):
    """Un XML de parte -> {parte, titulo, autoridad, fuente, secciones:[...]}."""
    raiz = ET.parse(str(path)).getroot()
    cabeza = raiz.findtext("HEAD", "") or ""
    # "PART 211—CURRENT GOOD MANUFACTURING PRACTICE..." -> se queda el nombre.
    titulo = re.sub(r"^\s*PART\s+[0-9A-Za-z.\-]+\s*[—–-]\s*", "", cabeza).strip()

    autoridad = ""
    auth = raiz.find("AUTH")
    if auth is not None:
        autoridad = (auth.findtext("PSPACE", "") or "").strip()
    fuente = ""
    src = raiz.find("SOURCE")
    if src is not None:
        fuente = (src.findtext("PSPACE", "") or "").strip()

    secciones = []

    # Mapa sección -> subparte, recorriendo el árbol una vez.
    subparte_de = {}
    def recorrer(el, subparte):
        for hijo in el:
            if hijo.tag == "DIV6":
                nombre = (hijo.findtext("HEAD", "") or "").strip()
                recorrer(hijo, nombre)
            elif hijo.tag == "DIV8":
                subparte_de[id(hijo)] = subparte
            else:
                recorrer(hijo, subparte)
    recorrer(raiz, "")

    for div8 in raiz.iter("DIV8"):
        numero = div8.get("N") or ""
        encabezado = (div8.findtext("HEAD", "") or "").strip()
        # "§ 211.22 Responsibilities of quality control unit." -> el nombre.
        nombre = re.sub(r"^\s*§+\s*[0-9A-Za-z.\-]+\s*", "", encabezado).strip()
        # La CITA es la historia de enmiendas de esta sección.
        citas = [_texto(c) for c in div8.iter("CITA")]
        cuerpo = _texto(div8)
        secciones.append({
            "numero": numero,
            "nombre": nombre,
            "subparte": subparte_de.get(id(div8), ""),
            "texto": cuerpo,
            "historia": " ".join(citas).strip(),
            "reservada": bool(re.search(r"\[reserved\]", encabezado, re.I)),
        })

    return {
        "parte": raiz.get("N") or "",
        "titulo": titulo,
        "autoridad": autoridad,
        "fuente": fuente,
        "secciones": secciones,
    }


def url_seccion(parte, numero):
    return ("https://www.ecfr.gov/current/title-21/part-" + str(parte)
            + "/section-" + str(numero))


# --- Troceado -----------------------------------------------------------------

def _partir(texto, limite=CHUNK_CHARS):
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


# --- Registros ----------------------------------------------------------------

def registros(fecha_version):
    """Genera registros con el MISMO esquema que el corpus chileno.

    Mismo esquema a propósito: si algún día esta sección se enciende, el motor
    de recuperación y la web no necesitan saber que la fuente es otra. Lo que
    cambia es `categoria`, que arranca con `fda_` y permite separarlas.
    """
    prio = {p["parte"]: p for p in cargar_prioritarias()}
    vig_fuente = ("eCFR, texto consolidado vigente del 21 CFR "
                  "(enmiendas incorporadas al " + str(fecha_version) + ")")

    for path in sorted(FUENTES.glob("part-*.xml")):
        parte = parsear(path)
        num = parte["parte"]
        meta = prio.get(num, {})
        categoria = "fda_" + (meta.get("categoria") or "general")
        doc_id = "fda/21 CFR " + num
        titulo_doc = "21 CFR Part " + num + " — " + (parte["titulo"] or meta.get("titulo", ""))

        for i, sec in enumerate(parte["secciones"]):
            if sec["reservada"] or len(sec["texto"]) < 60:
                continue
            for j, pieza in enumerate(_partir(sec["texto"])):
                if len(pieza) < 60 and j > 0:
                    continue
                alerta = ""
                if sec["historia"]:
                    alerta = "ℹ️ Historia de enmiendas: " + sec["historia"][:220]
                yield {
                    "doc_id": doc_id,
                    "chunk_id": doc_id + "#" + str(i) + "-" + str(j),
                    "norma_id": "21 cfr|" + num,
                    "categoria": categoria,
                    "categorias": [categoria, "fda"],
                    "tipo": "21 CFR Part",
                    "numero": num,
                    "titulo": titulo_doc,
                    "titulo_fuente": "ecfr",
                    "fecha": str(fecha_version),
                    "vigencia": "vigente",
                    "vigencia_fuente": vig_fuente,
                    "modificada": bool(sec["historia"]),
                    "modificada_por": [],
                    "disposicion_modificada": False,
                    "alerta_vigencia": alerta,
                    "seccion": "articulado",
                    "fuente_texto": "xml",
                    "alertas_ocr": [],
                    "fuente_url": url_seccion(num, sec["numero"]),
                    "pdf_path": "",
                    "pagina": 0,
                    "articulo": "§ " + sec["numero"],
                    "texto": (("[21 CFR " + num
                               + (" › " + sec["subparte"] if sec["subparte"] else "")
                               + "]\n") + pieza) if j == 0 else pieza,
                }


def construir():
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    ver = json.loads((FUENTES / "_version.json").read_text(encoding="utf-8"))
    fecha = ver.get("latest_amended_on") or ver.get("fecha_solicitada")
    destino = CORPUS_DIR / "corpus-fda.jsonl"
    n, docs = 0, set()
    with destino.open("w", encoding="utf-8") as fh:
        for rec in registros(fecha):
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            docs.add(rec["doc_id"])
            n += 1
    (CORPUS_DIR / "estado-fda.json").write_text(json.dumps({
        "generado": datetime.now().date().isoformat(),
        "titulo": TITULO,
        "fecha_version": fecha,
        "documentos": len(docs),
        "pasajes": n,
        "en_vivo": False,
        "nota": ("Sección en preparación. No la publica el pipeline: "
                 "build_corpus.py no importa este módulo."),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(docs), n, fecha


# --- Vigilancia ---------------------------------------------------------------

def snapshot():
    """Reduce el 21 CFR curado a lo comparable entre dos corridas."""
    ver = json.loads((FUENTES / "_version.json").read_text(encoding="utf-8"))
    partes = {}
    for path in sorted(FUENTES.glob("part-*.xml")):
        p = parsear(path)
        partes[p["parte"]] = {
            "titulo": p["titulo"],
            "n_secciones": len(p["secciones"]),
            "secciones": {
                s["numero"]: {
                    "nombre": s["nombre"],
                    "historia": s["historia"],
                    # Huella del texto: la historia de enmiendas no siempre se
                    # actualiza, pero el texto sí. Comparar ambas evita perder
                    # un cambio silencioso.
                    #
                    # sha1 y no hash(): el hash() de Python lleva una semilla
                    # aleatoria por proceso, así que la huella cambiaría en cada
                    # corrida y la vigilancia reportaría que cambió todo, todos
                    # los días. Es un falso positivo que además esconde los
                    # cambios de verdad.
                    "largo": len(s["texto"]),
                    "huella": hashlib.sha1(s["texto"].encode("utf-8")).hexdigest()[:16],
                }
                for s in p["secciones"]
            },
        }
    return {
        "titulo": TITULO,
        "fecha_version": ver.get("latest_amended_on"),
        "capturado": datetime.now().astimezone().isoformat(timespec="seconds"),
        "partes": partes,
    }


def diff(anterior, actual):
    ant = (anterior or {}).get("partes", {}) or {}
    act = (actual or {}).get("partes", {}) or {}
    cambios = {"version_antes": (anterior or {}).get("fecha_version"),
               "version_ahora": (actual or {}).get("fecha_version"),
               "partes_nuevas": sorted(set(act) - set(ant)),
               "partes_idas": sorted(set(ant) - set(act)),
               "secciones_nuevas": [], "secciones_idas": [], "secciones_modificadas": []}
    for parte in sorted(set(ant) & set(act)):
        sa, sb = ant[parte].get("secciones", {}), act[parte].get("secciones", {})
        for k in sorted(set(sb) - set(sa)):
            cambios["secciones_nuevas"].append({"parte": parte, "seccion": k,
                                                "nombre": sb[k].get("nombre", "")})
        for k in sorted(set(sa) - set(sb)):
            cambios["secciones_idas"].append({"parte": parte, "seccion": k})
        for k in sorted(set(sa) & set(sb)):
            if sa[k].get("huella") != sb[k].get("huella"):
                cambios["secciones_modificadas"].append({
                    "parte": parte, "seccion": k, "nombre": sb[k].get("nombre", ""),
                    "historia": sb[k].get("historia", ""),
                })
    return cambios


def hay_cambios(d):
    return bool(d["partes_nuevas"] or d["partes_idas"] or d["secciones_nuevas"]
                or d["secciones_idas"] or d["secciones_modificadas"]
                or d["version_antes"] != d["version_ahora"])


# --- CLI ----------------------------------------------------------------------

def _main():
    import argparse
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="21 CFR (FDA) — sección EN PREPARACIÓN, no en vivo.")
    ap.add_argument("--inventario", action="store_true", help="qué partes se bajarían y por qué")
    ap.add_argument("--descargar", action="store_true", help="baja las partes prioritarias")
    ap.add_argument("--construir", action="store_true", help="arma el corpus FDA (aparte)")
    ap.add_argument("--vigilar", action="store_true", help="compara con la corrida anterior")
    args = ap.parse_args()

    if args.inventario or not any([args.descargar, args.construir, args.vigilar]):
        prio = cargar_prioritarias()
        print("21 CFR — partes curadas: " + str(len(prio)))
        cat = {}
        for p in prio:
            cat.setdefault(p["categoria"], []).append(p)
        for c in sorted(cat):
            print("\n  " + c + " (" + str(len(cat[c])) + ")")
            for p in cat[c]:
                print("    " + ("Part " + p["parte"]).ljust(10) + p["titulo"][:62])
        print("\n(sección en preparación: build_corpus.py NO importa este módulo)")

    if args.descargar:
        fecha, bajadas, fallidas = descargar()
        total = sum(bajadas.values())
        print("[ok] " + str(len(bajadas)) + " partes al " + fecha
              + " (" + str(round(total / 1024)) + " KB comprimidos)")
        for p, e in fallidas:
            print("[warn] parte " + p + ": " + e)

    if args.construir:
        docs, n, fecha = construir()
        print("[ok] corpus FDA: " + str(docs) + " documentos, " + str(n)
              + " pasajes, versión " + str(fecha))
        print("     -> " + str(CORPUS_DIR / "corpus-fda.jsonl") + "  (NO se publica)")

    if args.vigilar:
        actual = snapshot()
        previo = None
        if REFERENCIA.exists():
            try:
                previo = json.loads(REFERENCIA.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                previo = None
        if previo is None:
            REFERENCIA.write_text(json.dumps(actual, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
            print("[21 CFR] línea base establecida (primera corrida).")
        else:
            d = diff(previo, actual)
            if not hay_cambios(d):
                print("[21 CFR] sin cambios (versión " + str(d["version_ahora"]) + ").")
            else:
                print("[21 CFR] CAMBIÓ · " + str(d["version_antes"]) + " → "
                      + str(d["version_ahora"]))
                for s in d["secciones_modificadas"]:
                    print("    § " + s["seccion"] + " (" + s["nombre"][:50] + ")")
                for s in d["secciones_nuevas"]:
                    print("    § " + s["seccion"] + ": NUEVA")
                for s in d["secciones_idas"]:
                    print("    § " + s["seccion"] + ": DESAPARECIÓ")
            REFERENCIA.write_text(json.dumps(actual, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
