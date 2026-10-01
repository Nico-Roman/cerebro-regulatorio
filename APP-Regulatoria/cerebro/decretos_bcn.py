#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
decretos_bcn.py — Decretos de dispositivos médicos tomados del XML de la BCN.

Encargo B (24-09-2026). Si un decreto del área de dispositivos está en la BCN,
entra como el Código Sanitario: texto refundido en XML, troceado por artículo,
con `fechaVersion` por artículo para vigilar cambios y vigencia certificada por
la propia BCN. Es la vía preferida para el DS 825/1998: el PDF que publica el
ISP es de 1998 y probablemente un escaneo, mientras que el XML trae el texto
vigente con sus modificaciones ya incorporadas.

Qué decretos entran: los de `fuentes-dispositivos.json` que declaran
`bcn_id_norma`. Si el mismo decreto también tiene PDF (en el listado ANDID o
como fuente mínima), build_corpus.py indexa solo el XML: dos copias del mismo
texto devalúan los términos propios de la norma (hallazgo 06 de la auditoría).

    python decretos_bcn.py --descargar   # baja los XML
    python decretos_bcn.py --vigilar     # baja, compara con la referencia y anota
"""

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import codigo_sanitario as CS
from norma_registry import FUENTES_DISPOSITIVOS, canon_tipo, norm_key, norm_numero

CATEGORIA = "dispositivos_medicos"
DIR_FUENTES = CS.BASE / "fuentes"
DIR_ESTADO = CS.DIR_REGISTRO / "estado"


def fuentes():
    """Las normas de fuentes-dispositivos.json que se toman de la BCN."""
    if not FUENTES_DISPOSITIVOS.exists():
        return []
    datos = json.loads(FUENTES_DISPOSITIVOS.read_text(encoding="utf-8"))
    return [n for n in datos.get("normas") or [] if str(n.get("bcn_id_norma") or "").strip()]


def norma_id_de(f):
    """La misma clave que usa NormaRegistry, para poder deduplicar contra el PDF."""
    return norm_key(canon_tipo(f.get("tipo", ""))) + "|" + norm_numero(f.get("numero", ""))


def cache(id_norma):
    return DIR_FUENTES / ("bcn-" + str(id_norma) + ".xml")


def url_xml(id_norma):
    return "https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma=" + str(id_norma)


def url_humana(id_norma):
    return "https://www.bcn.cl/leychile/navegar?idNorma=" + str(id_norma)


def descargar(id_norma, timeout=60):
    """Baja el XML y lo deja en caché. Atómica, igual que el Código Sanitario."""
    req = urllib.request.Request(url_xml(id_norma), headers={
        "User-Agent": CS.UA, "Accept": "application/xml,text/xml,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        datos = r.read()
    raiz = ET.fromstring(datos)
    if raiz.get("normaId") != str(id_norma):
        raise ValueError("El XML no es la norma " + str(id_norma) + " (vino " + repr(raiz.get("normaId")) + ")")
    if not any(e.get("tipoParte") == "Artículo" for e in raiz.iter(CS.Q + "EstructuraFuncional")):
        raise ValueError("El XML de la norma " + str(id_norma) + " no trae artículos.")
    dest = cache(id_norma)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".xml.tmp")
    tmp.write_bytes(datos)
    tmp.replace(dest)
    return dest


class Decreto:
    def __init__(self, fecha_version, derogado, articulos):
        self.fecha_version = fecha_version
        self.derogado = derogado
        self.articulos = articulos   # [{numero, texto, fecha_version, derogado, id_parte, ruta}]


def cargar(id_norma):
    """Todos los artículos del decreto, a cualquier profundidad, con su ruta."""
    raiz = ET.parse(str(cache(id_norma))).getroot()
    articulos = []

    def recorrer(el, ruta):
        for ef in el.findall("n:EstructurasFuncionales/n:EstructuraFuncional", CS.NS):
            if (ef.get("tipoParte") or "") == "Artículo":
                articulos.append({
                    "numero": CS._limpiar(ef.findtext("n:Metadatos/n:NombreParte", "", CS.NS)) or "?",
                    "texto": CS._limpiar(ef.findtext("n:Texto", "", CS.NS)),
                    "fecha_version": ef.get("fechaVersion", ""),
                    "derogado": ef.get("derogado", "") != "no derogado",
                    "id_parte": ef.get("idParte", ""),
                    "ruta": [r for r in ruta if r],
                })
            else:
                recorrer(ef, ruta + [CS._titulo_de(ef)])

    recorrer(raiz, [])
    return Decreto(raiz.get("fechaVersion", ""), raiz.get("derogado", "") != "no derogado", articulos)


def registros(f, dec):
    """Registros con el MISMO esquema que build_corpus.py (ver CS.registros)."""
    idn = str(f["bcn_id_norma"])
    tipo = canon_tipo(f.get("tipo", ""))
    numero = norm_numero(f.get("numero", ""))
    nombre = (f.get("tipo", "") + " " + f.get("numero", "")).strip()
    doc_id = CATEGORIA + "/" + nombre + " (BCN)"
    version = dec.fecha_version or "?"
    vig_fuente = ("texto refundido de BCN LeyChile, versión " + version +
                  " (la BCN certifica la vigencia; no depende del listado del ISP)")
    titulo = f.get("descripcion", "") or nombre
    aviso = ("⏳ " + f["aviso"]) if f.get("aviso") else ""

    for i, art in enumerate(dec.articulos):
        piezas = CS._partir(art["texto"])
        for j, pieza in enumerate(piezas):
            if len(pieza) < 60 and len(piezas) > 1:
                continue
            if art["derogado"] or dec.derogado:
                vigencia = "derogada"
                alerta = ("⛔ Este artículo está DEROGADO según el texto refundido de la BCN "
                          "(versión " + version + "). No lo cites como vigente.")
            else:
                vigencia = "vigente"
                alerta = aviso
            ruta = " › ".join(art["ruta"]) if art["ruta"] else ""
            cabecera = "[" + nombre + (" · " + ruta if ruta else "") + "]\n"
            yield {
                "doc_id": doc_id,
                "chunk_id": doc_id + "#" + str(i) + "-" + str(j),
                "norma_id": norma_id_de(f),
                "categoria": CATEGORIA,
                "categorias": [CATEGORIA],
                "tipo": tipo,
                "numero": numero,
                "titulo": titulo,
                "titulo_fuente": "bcn_leychile",
                "fecha": f.get("fecha", ""),
                "vigencia": vigencia,
                "vigencia_fuente": vig_fuente,
                "modificada": False,
                "modificada_por": [],
                "disposicion_modificada": False,
                "alerta_vigencia": alerta,
                "seccion": "articulado",
                "fuente_texto": "xml",
                "alertas_ocr": [],
                "fuente_url": url_humana(idn) + "&idParte=" + art["id_parte"],
                "pdf_path": "",
                "pagina": 0,
                "articulo": "Artículo " + art["numero"],
                "texto": (cabecera + pieza) if j == 0 else pieza,
            }


def snapshot(f, dec):
    return {
        "norma_id": str(f["bcn_id_norma"]),
        "norma": (f.get("tipo", "") + " " + f.get("numero", "")).strip(),
        "capturado": datetime.now().astimezone().isoformat(timespec="seconds"),
        "fecha_version": dec.fecha_version,
        "derogado": dec.derogado,
        "articulos": {a["numero"]: {"fecha_version": a["fecha_version"], "derogado": a["derogado"],
                                    "id_parte": a["id_parte"], "libro": "",
                                    "resumen": re.sub(r"\s+", " ", a["texto"])[:160]}
                      for a in dec.articulos},
    }


def vigilar():
    """Baja cada decreto, lo compara con la última versión vista y anota los
    cambios en la bitácora append-only (mismo formato que el Código Sanitario).
    Nunca aborta: un decreto que no baja deja el XML en caché como estaba."""
    for f in fuentes():
        idn = str(f["bcn_id_norma"])
        nombre = (f.get("tipo", "") + " " + f.get("numero", "")).strip()
        try:
            descargar(idn)
        except Exception as e:
            print("[warn] " + nombre + ": no se pudo bajar de la BCN (" + str(e) + "). Se usa la caché.")
        if not cache(idn).exists():
            continue
        actual = snapshot(f, cargar(idn))
        ref = DIR_ESTADO / ("bcn-" + idn + "-snapshot.json")
        previo = None
        if ref.exists():
            try:
                previo = json.loads(ref.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                previo = None
        if previo is not None:
            d = CS.diff(previo, actual)
            if CS.hay_cambios(d):
                hoy = datetime.now().date().isoformat()
                with CS.BITACORA.open("a", encoding="utf-8") as fh:
                    for evento, lista in (("decreto_articulo_modificado", [m["articulo"] for m in d["modificados"]]),
                                          ("decreto_articulo_nuevo", d["nuevos"]),
                                          ("decreto_articulo_derogado", d["derogados"]),
                                          ("decreto_articulo_eliminado", d["eliminados"])):
                        for art in lista:
                            fh.write(json.dumps({"tipo_evento": evento, "fecha": hoy, "norma": nombre,
                                                 "norma_id": idn, "version": actual["fecha_version"],
                                                 "articulo": art, "enlace": url_humana(idn)},
                                                ensure_ascii=False) + "\n")
                print("[info] " + nombre + ": cambios anotados en " + str(CS.BITACORA))
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(json.dumps(actual, ensure_ascii=False, indent=2), encoding="utf-8")
        print("[ok] " + nombre + ": " + str(len(actual["articulos"])) + " artículos, versión "
              + (actual["fecha_version"] or "?"))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if "--descargar" in sys.argv:
        for f in fuentes():
            print(descargar(f["bcn_id_norma"]))
    elif "--vigilar" in sys.argv:
        vigilar()
    else:
        print(__doc__)
