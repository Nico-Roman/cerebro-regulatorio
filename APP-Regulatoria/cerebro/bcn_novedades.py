#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bcn_novedades.py — Normas NUEVAS del Minsal y del ISP, detectadas en la BCN.

## Por qué existe

El listado «Normativa ANAMED» del ISP no cambió entre julio y octubre de 2026
(170 filas, mismo hash todos los días), mientras el ISP seguía publicando
resoluciones en el Diario Oficial: la Res. Ex. 1.307/2026 de confianza
regulatoria para biológicos, por ejemplo, nunca apareció en ese listado. El
pipeline «actualizaba» a diario una fuente que no se mueve, y el corpus no
crecía.

La BCN sí registra todo lo que se publica. Su buscador (el mismo que usa
bcn.cl/leychile, sin clave) entrega, por tema y año de publicación, cada norma
con su idNorma, organismo, tipo, número y fecha. Con eso:

1. Se buscan los temas de ANAMED en el año en curso (y el anterior en enero).
2. Se quedan las normas del Ministerio de Salud o del ISP que no se habían visto.
3. Se lee su texto (XML de la BCN) y se clasifican: relevantes para el corpus o
   descartadas (aranceles, estructura orgánica, nombramientos…), con motivo.
4. Las relevantes se escriben en `fuentes-bcn-auto.json` y entran al corpus por
   `decretos_bcn.py`, igual que el RSA o el DS 825: troceadas por artículo, con
   vigencia certificada por la BCN y vigilancia de cambios.

Muchas resoluciones del ISP figuran en la BCN solo como EXTRACTO (el texto
íntegro queda en ispch.cl). Entran igual —saber que la norma existe, qué hace y
dónde leerla ya es la respuesta que el usuario necesita— y el pasaje lo dice.

Todo queda en `registro-cambios/estado/bcn-novedades.json` (lo visto y por qué
se decidió así) y en la bitácora. Una norma mal incorporada se saca agregando
su idNorma a `exclusiones` en ese mismo archivo.

    python bcn_novedades.py --buscar      # busca, clasifica, actualiza fuentes
    python bcn_novedades.py --resumen     # qué entró y qué se descartó
"""

import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

import codigo_sanitario as CS

BASE = Path(__file__).resolve().parent
ESTADO = CS.DIR_REGISTRO / "estado" / "bcn-novedades.json"
FUENTES_AUTO = BASE / "fuentes-bcn-auto.json"
LISTADO_ISP = BASE.parent.parent / "vigilancia-isp" / "snapshots" / "latest.json"

BUSCADOR = "https://nuevo.leychile.cl/servicios/buscarjson"
POR_PAGINA = 100
MAX_PAGINAS = 10

# Temas que se buscan. La búsqueda de la BCN es por relevancia, no exhaustiva:
# varios temas cubren lo que uno solo no trae.
TEMAS = [
    "instituto de salud publica",
    "productos farmaceuticos",
    "medicamentos",
    "registro sanitario",
    "cosmeticos",
    "dispositivos medicos",
    "reglamento sanitario de los alimentos",
    "suplementos alimentarios",
    "farmacias",
    "estupefacientes psicotropicos",
    "bioequivalencia",
    "farmacovigilancia",
]

ORGANISMOS = ("ministerio de salud", "instituto de salud publica")
# Dentro del Minsal, lo regional y lo de otros servicios no es normativa de
# ANAMED: arsenales de atención primaria de una SEREMI, la Superintendencia.
ORGANISMOS_FUERA = ("secretaria regional ministerial", "superintendencia de salud", "servicio de salud ")

# Relevancia para el corpus de ANAMED, sobre título + texto normalizados.
RELEVANTE = re.compile(
    r"producto[s]? farmaceutic|medicament|farmac|registro sanitario|biologic|biosimilar|vacuna|"
    r"cosmetic|dispositivo[s]? medic|elementos? de uso medico|tecnovigil|farmacovigil|reacciones adversas|"
    r"bioequival|equivalencia terapeutica|estupefac|psicotrop|droguer|botiquin|recetario|receta medica|"
    r"buenas practicas de (manufactura|laboratorio|almacenamiento|distribucion)|ensayo[s]? clinic|"
    r"investigacion cientifica en seres humanos|uso y disposicion|destinacion aduanera|"
    r"reglamento sanitario de los alimentos|suplemento[s]? alimentari|alimentos? para (deportistas|regimenes)|"
    r"rotulacion|rotulado|agencia nacional de medicamentos|anamed|desinfectante|sanitizante|plaguicidas? de uso sanitario|"
    r"control de calidad|norma tecnica"
)
# Administrativo: no es normativa de productos aunque nombre al ISP.
ADMINISTRATIVO = re.compile(
    r"aranceles?|prestaciones y aranceles|estructura organica|sujetos pasivos|delegacion de firma|"
    r"\bnombra\b|\bdesigna\b|nombramiento|planta de personal|encasillamiento|concurso publico|presupuest|"
    r"remuneracion|asignacion de (funciones|desempeno)|comision de servicio|feriado|horario de atencion|"
    r"licitacion|adjudica|convenio de|transferencia de recursos|laboratorio biomedico|antiglobulina|"
    r"banco de sangre|deja sin efecto designacion|subrogancia|orden de subrogacion|"
    r"alerta sanitaria|zona de riesgo sanitario|arsenal farmac|vacunacion obligatoria|campana de vacunacion"
)

# Materia del corpus, en orden de prioridad (la primera que calza gana).
CATEGORIAS = [
    ("alimentos", r"aliment|suplemento[s]? alimentari|nutricional|rotulado nutricional"),
    ("dispositivos_medicos", r"dispositivo[s]? medic|elementos? de uso medico|tecnovigil|diagnostico in vitro"),
    ("cosmeticos", r"cosmetic|odorizante|higiene personal"),
    ("farmacovigilancia", r"farmacovigil|reacciones adversas|esavi|eventos supuestamente atribuibles"),
    ("ensayos_clinicos", r"ensayo[s]? clinic|estudio[s]? clinic|investigacion cientifica en seres humanos"),
    ("importacion_y_exportacion_control_y_vigilancia", r"importacion|exportacion|internacion|uso y disposicion|destinacion aduanera"),
    ("establecimientos_autorizacion_y_fiscalizacion",
     r"farmacias?\b|droguer|botiquin|almacen farmaceutic|laboratorio[s]? farmaceutic|establecimiento|buenas practicas de (manufactura|almacenamiento|distribucion)"),
    ("medicamentos", r"producto[s]? farmaceutic|medicament|registro sanitario|biologic|biosimilar|vacuna|bioequival|estupefac|psicotrop"),
]

TIPO_RX = re.compile(r"^\s*(Decreto con Fuerza de Ley|Decreto Ley|Ley|Decreto|Resoluci[oó]n|Circular|Norma General)\s+"
                     r"([A-Z]?\s?[\d.]+)\s*(EXENT[AO])?", re.I)
MESES = {m: i for i, m in enumerate("ENE FEB MAR ABR MAY JUN JUL AGO SEP OCT NOV DIC".split(), 1)}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).lower().strip()


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": CS.UA, "Referer": "https://www.bcn.cl/leychile/"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def buscar(tema, anio):
    """Todas las normas del tema publicadas en el año (paginando)."""
    out = []
    for pagina in range(1, MAX_PAGINAS + 1):
        q = urllib.parse.urlencode({"cadena": tema, "itemsporpagina": POR_PAGINA, "npagina": pagina, "orden": 2})
        datos = json.loads(get(BUSCADOR + "?" + q + "&fc_pb=" + str(anio) + "+TO+" + str(anio)))
        filas, meta = datos[0], datos[1]
        out.extend(filas)
        if not filas or len(out) >= int(meta.get("totalitems") or 0):
            break
    return out


def fecha_iso(f):
    """'07-MAY-2026' -> '2026-05-07'."""
    m = re.match(r"(\d{2})-([A-Z]{3})-(\d{4})", f or "")
    return f"{m.group(3)}-{MESES[m.group(2)]:02d}-{m.group(1)}" if m else ""


def tipo_numero(norma):
    """'Resolución 1307 EXENTA; Resolución E 1307 EXENTA' -> ('Resolución Exenta', '1307')."""
    m = TIPO_RX.match((norma or "").split(";")[0])
    if not m:
        return "", ""
    tipo = m.group(1).capitalize().replace("Resolucion", "Resolución")
    if tipo.lower().startswith("resoluci"):
        tipo = "Resolución"
    if m.group(3):
        tipo += " Exenta" if m.group(3).upper().endswith("A") else " Exento"
    return tipo, re.sub(r"[^\d]", "", m.group(2))


def texto_xml(id_norma):
    raiz = ET.fromstring(get("https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma=" + str(id_norma)))
    return re.sub(r"\s+", " ", " ".join("".join(e.itertext()) for e in raiz.iter(CS.Q + "Texto"))).strip()


def clasificar(titulo, texto, desc=""):
    t = norm(titulo + " " + texto[:4000])
    admin = ADMINISTRATIVO.search(t)
    rel = RELEVANTE.search(t)
    if admin and not (rel and rel.start() < admin.start() and not re.search(r"arancel|estructura organica|sujetos pasivos", t)):
        return None, "administrativa: «" + admin.group(0) + "»"
    if not rel:
        return None, "sin materia ANAMED"
    # La materia sale primero de lo que la norma dice de sí misma (título o la
    # frase del extracto): el cuerpo de una resolución de folletos dice «tomar
    # con alimentos» y no por eso es de alimentos.
    cabeza = norm(titulo + " " + desc)
    for donde in (cabeza, t):
        for cat, rx in CATEGORIAS:
            m = re.search(rx, donde)
            if m:
                return cat, "materia: «" + m.group(0) + "»"
    return "otros", "relevante sin materia específica"


def descripcion(titulo, texto):
    """El título de la BCN, o —si es un extracto— la frase que dice qué hace."""
    if norm(titulo) not in ("extracto", ""):
        return titulo.strip().capitalize()
    m = re.search(r"(?:de \d{4},?|de \d{1,2} de \w+ de \d{4},?)\s+(.+?)(?:\.\s|\.-|\. El texto)", texto)
    return (m.group(1) if m else texto[:200]).strip().rstrip(".")


def conocidas():
    """(tipo, número, año) de lo que el corpus ya trae por otra vía: el listado
    del ISP y los archivos de fuentes. Evita indexar dos veces la misma norma."""
    claves = set()

    def clave(tipo, numero, anio):
        return (norm(tipo).split()[0] if tipo else "", re.sub(r"\D", "", str(numero)).lstrip("0"), str(anio))

    if LISTADO_ISP.exists():
        for r in json.loads(LISTADO_ISP.read_text(encoding="utf-8")).get("records", []):
            m = re.search(r"(\d{4})", r.get("fecha", ""))
            claves.add(clave(r.get("tipo", ""), r.get("numero", ""), m.group(1) if m else ""))
    for f in BASE.glob("fuentes-*.json"):
        if f.name == FUENTES_AUTO.name:
            continue
        for n in json.loads(f.read_text(encoding="utf-8")).get("normas", []):
            m = re.search(r"(\d{4})", n.get("fecha", ""))
            claves.add(clave(n.get("tipo", ""), n.get("numero", ""), m.group(1) if m else ""))
    return claves, clave


def cargar_estado():
    if ESTADO.exists():
        return json.loads(ESTADO.read_text(encoding="utf-8"))
    return {"vistas": {}, "exclusiones": [], "actualizado": None}


def guardar(estado):
    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    estado["actualizado"] = date.today().isoformat()
    ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    exclusiones = {str(x) for x in estado.get("exclusiones", [])}
    normas = [dict(v["fuente"], bcn_id_norma=k) for k, v in sorted(estado["vistas"].items())
              if v.get("decision") == "incorporada" and k not in exclusiones]
    normas.sort(key=lambda n: (n["fecha"][6:] + n["fecha"][3:5] + n["fecha"][:2], n["numero"]))
    FUENTES_AUTO.write_text(json.dumps({
        "_comentario": [
            "GENERADO por bcn_novedades.py: no editar a mano (se sobrescribe).",
            "Normas nuevas del Minsal y del ISP detectadas en la BCN e incorporadas al corpus.",
            "Para sacar una: agregar su idNorma a `exclusiones` en registro-cambios/estado/bcn-novedades.json.",
        ],
        "categoria": "Normas nuevas (BCN)",
        "normas": normas,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return normas


def bitacora(evento, **campos):
    with CS.BITACORA.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(dict(tipo_evento=evento, fecha=date.today().isoformat(), **campos), ensure_ascii=False) + "\n")


def correr():
    estado = cargar_estado()
    vistas = estado["vistas"]
    hoy = date.today()
    anios = [hoy.year - 1, hoy.year] if hoy.month == 1 else [hoy.year]
    claves, clave = conocidas()

    candidatas, errores = {}, 0
    for anio in anios:
        for tema in TEMAS:
            try:
                for r in buscar(tema, anio):
                    org = norm(r.get("ORGANISMO"))
                    if any(o in org for o in ORGANISMOS) and not any(o in org for o in ORGANISMOS_FUERA):
                        candidatas[str(r["IDNORMA"])] = r
            except Exception as e:  # la BCN caída no aborta el pipeline
                errores += 1
                print(f"[warn] BCN · búsqueda «{tema}» {anio}: {e}")
    nuevas = {k: r for k, r in candidatas.items() if k not in vistas}
    print(f"[info] BCN novedades: {len(candidatas)} normas Minsal/ISP en {anios} · nuevas: {len(nuevas)}"
          + (f" · búsquedas fallidas: {errores}" if errores else ""))

    incorporadas = 0
    for idn, r in sorted(nuevas.items()):
        tipo, numero = tipo_numero(r.get("NORMA", ""))
        fecha = fecha_iso(r.get("FECHA_PUBLICACION"))
        try:
            texto = texto_xml(idn)
        except Exception as e:
            print(f"[warn] BCN · sin XML para idNorma {idn} ({r.get('NORMA')}): {e}. Se reintenta mañana.")
            continue
        registro = {"norma": r.get("NORMA", "").split(";")[0].strip(), "organismo": r.get("ORGANISMO", ""),
                    "titulo": r.get("TITULO_NORMA", ""), "publicada": fecha,
                    "detectada": hoy.isoformat()}
        if clave(tipo, numero, fecha[:4]) in claves:
            registro.update(decision="ya_en_corpus", motivo="el corpus ya la trae por el listado del ISP o una fuente")
        elif not tipo or not numero:
            registro.update(decision="descartada", motivo="no se pudo leer tipo y número")
        else:
            cat, motivo = clasificar(r.get("TITULO_NORMA", ""), texto, descripcion(r.get("TITULO_NORMA", ""), texto))
            if cat is None:
                registro.update(decision="descartada", motivo=motivo)
            else:
                extracto = norm(texto).startswith("extracto")
                registro.update(decision="incorporada", motivo=motivo, fuente={
                    "tipo": tipo, "numero": numero,
                    "descripcion": descripcion(r.get("TITULO_NORMA", ""), texto),
                    "fecha": f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha else "",
                    "categoria_corpus": cat,
                    "extracto": extracto,
                    "aviso": ("Extracto publicado en el Diario Oficial: el texto íntegro está en el sitio del ISP "
                              "(www.ispch.cl).") if extracto else "",
                    "origen": "bcn_novedades",
                })
                incorporadas += 1
                bitacora("norma_nueva_bcn", norma=registro["norma"], norma_id=idn, categoria=cat,
                         publicada=fecha, descripcion=registro["fuente"]["descripcion"][:200],
                         enlace="https://www.bcn.cl/leychile/navegar?idNorma=" + idn)
        vistas[idn] = registro
        print(f"  [{registro['decision']}] {registro['norma']} ({fecha}) · {registro['motivo']}")

    normas = guardar(estado)
    print(f"[ok] BCN novedades: {incorporadas} incorporadas hoy · {len(normas)} en fuentes-bcn-auto.json")
    return {"candidatas": len(candidatas), "nuevas": len(nuevas), "incorporadas": incorporadas,
            "total_auto": len(normas), "errores": errores}


def resumen():
    estado = cargar_estado()
    por = {}
    for v in estado["vistas"].values():
        por.setdefault(v["decision"], []).append(v)
    for d, vs in sorted(por.items()):
        print(f"\n{d} ({len(vs)})")
        for v in sorted(vs, key=lambda x: x["publicada"]):
            print(f"  {v['publicada']} · {v['norma']} · {v['motivo']}"
                  + (f" · {v['fuente']['descripcion'][:90]}" if v.get("fuente") else ""))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if "--buscar" in sys.argv:
        r = correr()
        if "--json" in sys.argv:
            print(json.dumps(r))
    elif "--resumen" in sys.argv:
        resumen()
    else:
        print(__doc__)
