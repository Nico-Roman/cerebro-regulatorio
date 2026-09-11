#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eval_respuestas.py — Compuerta de lo que ve el químico farmacéutico.

eval_retrieval.py mide si la norma correcta sale entre las cinco primeras. Eso
daba 100 % mientras, en preguntas escritas como las escribe la gente, solo 8 de
22 mostraban la respuesta. Esta compuerta mide la pantalla:

  VISIBLE@3    ¿el dato pedido aparece en la frase destacada de alguno de los
               tres primeros resultados? (preguntas 'respondible')
  VERDE FALSO  ¿cuántas veces el estado fue "encontrado" sin que el dato
               estuviera a la vista? Es la métrica que más importa: un verde
               falso es una afirmación falsa del sistema.
  ABSTENCIÓN   las preguntas 'fuera' deben quedar "ausente".
  SIN TEXTO    preguntas del ámbito cuya respuesta no está en la base: nunca
               "encontrado".
  PARIDAD      si hay `node` disponible, el motor TypeScript de la web debe
               devolver exactamente lo mismo que este.

Se reporta por separado el set 'dev' (con el que se ajustó el vocabulario) y el
'holdout' (escrito antes de tocar el motor). La compuerta exige ambos.

Uso:
  python eval_respuestas.py            # tabla legible
  python eval_respuestas.py --json     # para el pipeline; exit 1 si reprueba
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import indice as IX
from respuesta import responder, VOCABULARIO

DIR = Path(__file__).resolve().parent
PREGUNTAS = DIR / "preguntas-reales.json"
WEB = DIR.parent / "web"

# Pisos de la compuerta. Medición al 11-09-2026: dev visible@3 19/22, holdout
# 16/17, cero verdes falsos, abstención dev 3/3 y holdout 2/3 (h16, "contrato de
# trabajo", queda en parcial). Los pisos dejan holgura a propósito: el corpus
# cambia a diario y una norma nueva que mueva un resultado no debe frenar la
# publicación de normativa actualizada (servir normativa vieja también es una
# falla). Lo que no tiene holgura es lo que hace daño: verdes falsos en el set
# dev, preguntas sin texto en verde y abstención en dev.
GATE = {
    "visible3_min": {"dev": 0.75, "holdout": 0.75},
    "verde_falso_max": {"dev": 0, "holdout": 1},
    "abstencion_min": {"dev": 1.0, "holdout": 0.66},
    "sin_texto_verde_max": 0,
}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def visibles(resp, n=3):
    """Lo que la persona ve sin abrir nada: frase principal y las primeras relacionadas."""
    if resp["estado"] == "ausente":
        return []
    filas = ([resp["principal"]] if resp["principal"] else []) + resp["relacionadas"]
    return filas[:n]


def cumple(fila, evidencia):
    for ev in evidencia:
        if ev.get("numero") and not re.fullmatch(ev["numero"], fila["_numero"] or ""):
            continue
        if re.search(ev["contiene"], fila["frase"], re.I):
            return True
    return False


def evaluar(idx, preguntas):
    filas, stats = [], {}
    for p in preguntas:
        s = stats.setdefault(p["set"], dict(resp=0, visible1=0, visible3=0, verdes=0, verdes_falsos=0,
                                             fuera=0, fuera_ok=0, sin_texto=0, sin_texto_verde=0,
                                             falsa_ausencia=0))
        resp = responder(p["pregunta"], idx=idx)
        vis = visibles(resp)
        v1 = bool(vis) and cumple(vis[0], p["evidencia"])
        v3 = any(cumple(f, p["evidencia"]) for f in vis)
        if p["tipo"] == "respondible":
            s["resp"] += 1
            s["visible1"] += v1
            s["visible3"] += v3
            if resp["estado"] == "ausente":
                s["falsa_ausencia"] += 1
        if resp["estado"] == "encontrado":
            s["verdes"] += 1
            if not (p["tipo"] == "respondible" and v3):
                s["verdes_falsos"] += 1
        if p["tipo"] == "fuera":
            s["fuera"] += 1
            s["fuera_ok"] += resp["estado"] == "ausente"
        if p["tipo"] == "sin_texto":
            s["sin_texto"] += 1
            s["sin_texto_verde"] += resp["estado"] == "encontrado"
        filas.append((p, resp, v1, v3))
    return filas, stats


def paridad(preguntas):
    """Corre el motor TypeScript sobre las mismas preguntas y compara."""
    node = shutil.which("node")
    script = WEB / "scripts" / "paridad-motor.mjs"
    if not node or not script.exists():
        return None, "node o scripts/paridad-motor.mjs no disponible: paridad no verificada"
    copia = WEB / "data" / "vocabulario.json"
    if not copia.exists() or copia.read_bytes() != VOCABULARIO.read_bytes():
        return False, "web/data/vocabulario.json no es idéntico a cerebro/vocabulario.json"
    corpus_web = WEB / "data" / "corpus.jsonl"
    corpus_local = DIR / "corpus" / "corpus.jsonl"
    entrada = json.dumps({"preguntas": [p["pregunta"] for p in preguntas],
                          "corpus": str(corpus_local if corpus_local.exists() else corpus_web)}, ensure_ascii=False)
    try:
        out = subprocess.run([node, "--experimental-strip-types", "--no-warnings", str(script)], input=entrada,
                             capture_output=True, text=True, cwd=str(WEB), timeout=300, encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        return False, "no se pudo correr el motor TypeScript: " + str(e)
    if out.returncode != 0:
        return False, "el motor TypeScript falló: " + out.stderr[-500:]
    ts = json.loads(out.stdout)
    idx = IX.load()
    difieren = []
    for p in preguntas:
        py = responder(p["pregunta"], idx=idx)
        a = firma(py)
        b = ts.get(p["pregunta"])
        if a != b:
            difieren.append(p["id"])
    if difieren:
        return False, "Python y TypeScript difieren en: " + ", ".join(difieren)
    return True, "Python y TypeScript idénticos en %d preguntas" % len(preguntas)


def firma(resp):
    filas = ([resp["principal"]] if resp["principal"] else []) + resp["relacionadas"]
    return {"estado": resp["estado"], "tipo": resp["tipo"], "avisos": resp["avisos"],
            "filas": [[f["cita"], f["frase"], f["resaltar"], f["avisos"]] for f in filas]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--sin-paridad", action="store_true")
    args = ap.parse_args()

    preguntas = json.loads(PREGUNTAS.read_text(encoding="utf-8"))["preguntas"]
    idx = IX.load()
    filas, stats = evaluar(idx, preguntas)

    motivos = []
    for nombre, s in stats.items():
        v3 = s["visible3"] / s["resp"] if s["resp"] else 1.0
        if v3 < GATE["visible3_min"][nombre]:
            motivos.append("%s: visible@3 %.0f%% bajo el piso %.0f%%" % (nombre, 100 * v3, 100 * GATE["visible3_min"][nombre]))
        if s["verdes_falsos"] > GATE["verde_falso_max"][nombre]:
            motivos.append("%s: %d verdes falsos" % (nombre, s["verdes_falsos"]))
        if s["fuera"] and s["fuera_ok"] / s["fuera"] < GATE["abstencion_min"][nombre]:
            motivos.append("%s: abstención %d/%d" % (nombre, s["fuera_ok"], s["fuera"]))
        if s["sin_texto_verde"] > GATE["sin_texto_verde_max"]:
            motivos.append("%s: %d preguntas sin texto salieron en verde" % (nombre, s["sin_texto_verde"]))

    par_ok, par_msg = (None, "omitida") if args.sin_paridad else paridad(preguntas)
    if par_ok is False:
        motivos.append(par_msg)
    pasa = not motivos

    if args.json:
        print(json.dumps({"stats": stats, "paridad": par_msg, "pasa": pasa, "motivos": motivos}, ensure_ascii=False))
        sys.exit(0 if pasa else 1)

    print("\nPreguntas reales · lo que ve el químico farmacéutico\n")
    print("%-30s %-11s %-10s %-4s %-4s %s" % ("id", "tipo", "estado", "v@1", "v@3", "principal"))
    print("-" * 110)
    for p, resp, v1, v3 in filas:
        top = resp["principal"] or (resp["relacionadas"][0] if resp["relacionadas"] else None)
        marca = ""
        if resp["estado"] == "encontrado" and not (p["tipo"] == "respondible" and v3):
            marca = "  ⛔ VERDE FALSO"
        elif p["tipo"] == "fuera" and resp["estado"] != "ausente":
            marca = "  ⛔ NO SE ABSTUVO"
        print("%-30s %-11s %-10s %-4s %-4s %s%s" % (p["id"], p["tipo"], resp["estado"], "sí" if v1 else "·",
                                                  "sí" if v3 else "·", top["cita"] if top else "—", marca))
    print("-" * 110)
    for nombre, s in stats.items():
        print("%-8s visible@1 %d/%d · visible@3 %d/%d · verdes %d (falsos %d) · abstención %d/%d · sin texto en verde %d · falsas ausencias %d"
              % (nombre, s["visible1"], s["resp"], s["visible3"], s["resp"], s["verdes"], s["verdes_falsos"],
                 s["fuera_ok"], s["fuera"], s["sin_texto_verde"], s["falsa_ausencia"]))
    print("Paridad: " + par_msg)
    print("\n" + ("✅ COMPUERTA APROBADA" if pasa else "⛔ COMPUERTA REPROBADA: " + "; ".join(motivos)))
    sys.exit(0 if pasa else 1)


if __name__ == "__main__":
    main()
