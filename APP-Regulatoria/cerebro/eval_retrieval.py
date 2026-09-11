#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eval_retrieval.py — Compuerta de calidad del Cerebro Regulatorio.

Mide dos cosas, porque un buscador legal puede fallar de dos maneras distintas:

  1. RECALL@k  — ¿recupera la fuente correcta cuando la respuesta existe?
     Set: preguntas-doradas.json. Gate: >= 90%.

  2. ABSTENCIÓN — ¿declara ausencia cuando la respuesta NO existe?
     Set: preguntas-fuera-corpus.json. Gate: 100% en `confianza: baja`.
     Sin esta segunda mitad, subir el recall a costa de responder siempre
     pasaría la evaluación mientras empeora la herramienta.

Además vigila que las preguntas doradas no caigan en `confianza: baja`: un
falso positivo de abstención convierte la señal en ruido que se termina
ignorando, que es peor que no tenerla.

Uso:
  python eval_retrieval.py --k 5
  python eval_retrieval.py --k 5 --gate 90 --json   # para el pipeline diario
"""

import argparse
import json
import sys
from pathlib import Path

import indice as IX
from respuesta import responder

DIR = Path(__file__).resolve().parent
GOLDEN = DIR / "preguntas-doradas.json"
FUERA = DIR / "preguntas-fuera-corpus.json"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def matches(result, fuente):
    # `doc_id` es igualdad exacta; `doc_contains` es subcadena. La distinción
    # importa: los doc_id del Código Sanitario son prefijos unos de otros
    # ("Libro V" es subcadena de "Libro VI", "VII" y "VIII"), así que con
    # `doc_contains` una pregunta sobre el Libro V pasaría recuperando el VIII.
    if "doc_id" in fuente:
        return result["doc_id"].lower() == fuente["doc_id"].lower()
    if "doc_contains" in fuente:
        return fuente["doc_contains"].lower() in result["doc_id"].lower()
    tipo_ok = result.get("tipo", "").lower() == fuente.get("tipo", "").lower()
    num_ok = result.get("numero", "").lstrip("0") == str(fuente.get("numero", "")).lstrip("0")
    return tipo_ok and num_ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--gate", type=float, default=90.0, help="recall mínimo aceptable (%%)")
    ap.add_argument("--json", action="store_true", help="salida JSON (para el pipeline)")
    args = ap.parse_args()

    idx = IX.load()
    data = json.loads(GOLDEN.read_text(encoding="utf-8"))
    preguntas = data["preguntas"]

    hits, fallos, falsas_abstenciones = 0, [], []
    filas = []
    for p in preguntas:
        resp = responder(p["pregunta"], idx=idx)
        # Lo que el buscador muestra, en orden: la principal y las relacionadas.
        mostradas = ([resp["principal"]] if resp["principal"] else []) + resp["relacionadas"]
        results = [{"doc_id": m["_doc_id"], "tipo": m["_tipo"], "numero": m["_numero"]} for m in mostradas[:args.k]]
        hit = next((r for r in results if any(matches(r, f) for f in p["fuentes_aceptables"])), None)
        if hit:
            hits += 1
            fuente = " ".join(x for x in [hit.get("tipo", ""), hit.get("numero", "")] if x) or hit["doc_id"]
        else:
            fallos.append(p["id"])
            fuente = "—"
        conf = {"encontrado": "alta", "parcial": "media", "ausente": "baja"}[resp["estado"]]
        if resp["estado"] == "ausente":
            falsas_abstenciones.append(p["id"])
        filas.append((p["id"], bool(hit), fuente, conf,
                      results[0].get("tipo", "") + " " + results[0].get("numero", "") if results else "—"))

    recall = 100.0 * hits / len(preguntas) if preguntas else 0.0

    # --- Abstención ---------------------------------------------------------
    fuera_ok, fuera_filas = 0, []
    fuera_data = json.loads(FUERA.read_text(encoding="utf-8"))["preguntas"] if FUERA.exists() else []
    for p in fuera_data:
        resp = responder(p["pregunta"], idx=idx)
        ok = resp["estado"] == "ausente"
        fuera_ok += 1 if ok else 0
        top = resp["principal"] or (resp["relacionadas"][0] if resp["relacionadas"] else None)
        fuera_filas.append((p["id"], ok, {"encontrado": "alta", "parcial": "media", "ausente": "baja"}[resp["estado"]],
                            round(top["_cobertura_frase"], 2) if top else 0.0))
    abstencion = 100.0 * fuera_ok / len(fuera_data) if fuera_data else 100.0

    pasa = recall >= args.gate and abstencion >= 100.0 and not falsas_abstenciones

    if args.json:
        print(json.dumps({
            "k": args.k, "gate": args.gate,
            "recall": round(recall, 1), "hits": hits, "total": len(preguntas), "fallos": fallos,
            "abstencion": round(abstencion, 1), "fuera_ok": fuera_ok, "fuera_total": len(fuera_data),
            "falsas_abstenciones": falsas_abstenciones,
            "pasa": pasa,
        }, ensure_ascii=False))
        sys.exit(0 if pasa else 1)

    print("\nEvaluación de recuperación · recall@" + str(args.k) + " · "
          + str(len(preguntas)) + " preguntas doradas\n")
    print("%-28s %-9s %-7s %s" % ("id", "resultado", "conf", "fuente recuperada"))
    print("-" * 82)
    for pid, ok, fuente, conf, top in filas:
        marca = "✅ OK" if ok else "❌ MISS"
        detalle = fuente if ok else "(top: " + top + ")"
        print("%-28s %-8s %-7s %s" % (pid, marca, conf, detalle))
    print("-" * 82)
    print("\nRecall@" + str(args.k) + ": " + str(hits) + "/" + str(len(preguntas))
          + " = " + ("%.0f%%" % recall) + "   "
          + ("✅ pasa gate (>=" + ("%.0f" % args.gate) + "%)" if recall >= args.gate
             else "⚠️ BAJO EL GATE (>=" + ("%.0f" % args.gate) + "%)"))
    if fallos:
        print("Fallos: " + ", ".join(fallos))
    if falsas_abstenciones:
        print("⚠️ Preguntas doradas con confianza BAJA (falsa abstención): "
              + ", ".join(falsas_abstenciones))

    if fuera_data:
        print("\nAbstención · " + str(len(fuera_data)) + " consultas fuera del corpus\n")
        print("%-28s %-9s %-7s %s" % ("id", "resultado", "conf", "cobertura mejor pasaje"))
        print("-" * 82)
        for pid, ok, conf, top in fuera_filas:
            print("%-28s %-8s %-7s %s" % (pid, "✅ OK" if ok else "❌ RESPONDE", conf, top))
        print("-" * 82)
        print("Abstención: " + str(fuera_ok) + "/" + str(len(fuera_data))
              + " = " + ("%.0f%%" % abstencion) + "   "
              + ("✅ pasa gate (100%)" if abstencion >= 100 else "⚠️ BAJO EL GATE (100%)"))

    print("\n" + ("✅ COMPUERTA APROBADA" if pasa else "⛔ COMPUERTA REPROBADA"))
    sys.exit(0 if pasa else 1)


if __name__ == "__main__":
    main()
