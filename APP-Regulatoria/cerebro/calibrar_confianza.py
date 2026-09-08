#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
calibrar_confianza.py — Herramienta para re-calibrar los umbrales de confianza.

Los umbrales de `query.py` (COBERTURA_*, PESO_FUERA_CORPUS_MAX) separan dos
poblaciones que se solapan menos de lo que parece:

  - las preguntas DORADAS, que deben quedar en `media` o `alta`, y
  - las consultas FUERA DEL CORPUS, que deben caer todas en `baja`.

Este script imprime las métricas crudas de ambas poblaciones para poder mover un
umbral con los números a la vista en vez de a ojo. No modifica nada.

El criterio de calibración es asimétrico a propósito: un falso negativo (declarar
ausencia cuando sí se podía responder) cuesta una respuesta; un falso positivo
(responder cuando la evidencia no alcanza) cuesta la confiabilidad de toda la
herramienta. Ante la duda, apretar.

Uso:  python calibrar_confianza.py [--k 6]
"""

import argparse
import json
import sys
from pathlib import Path

import indice as IX
from indice import tokenize, stem
from query import analizar

DIR = Path(__file__).resolve().parent

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def fila(idx, cid, q, k):
    _, c = analizar(q, k=k, idx=idx)
    fuera = [t for t in dict.fromkeys(stem(t) for t in tokenize(q))
             if t not in (getattr(idx, "stem_idf", None) or {})]
    return (cid, c["cobertura"], c["cobertura_top"], c["confianza"], fuera)


def bloque(idx, titulo, items, k, esperado):
    print("### " + titulo + "  (esperado: " + esperado + ")")
    malas = []
    for cid, q in items:
        cid_, cob, top, conf, fuera = fila(idx, cid, q, k)
        ok = (conf == "baja") if esperado == "baja" else (conf != "baja")
        if not ok:
            malas.append(cid_)
        print("%-28s %-7.3f %-7.3f %-6s %-3s %s"
              % (cid_, cob, top, conf, "ok" if ok else "MAL", ", ".join(fuera)))
    print()
    return malas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=6)
    args = ap.parse_args()

    idx = IX.load()
    doradas = [(p["id"], p["pregunta"])
               for p in json.loads((DIR / "preguntas-doradas.json").read_text(encoding="utf-8"))["preguntas"]]
    fuera = [(p["id"], p["pregunta"])
             for p in json.loads((DIR / "preguntas-fuera-corpus.json").read_text(encoding="utf-8"))["preguntas"]]

    print("\n%-28s %-7s %-7s %-6s %-3s %s\n" % ("id", "cobert", "top", "conf", "", "conceptos fuera del corpus")
          + "-" * 95)
    mal_doradas = bloque(idx, "DORADAS", doradas, args.k, "media o alta")
    mal_fuera = bloque(idx, "FUERA DEL CORPUS", fuera, args.k, "baja")

    if mal_doradas:
        print("⚠️ doradas que se declararían ausentes: " + ", ".join(mal_doradas))
    if mal_fuera:
        print("⛔ consultas fuera del corpus que se responderían: " + ", ".join(mal_fuera))
    if not mal_doradas and not mal_fuera:
        print("✅ Los umbrales actuales separan ambas poblaciones sin errores.")


if __name__ == "__main__":
    main()
