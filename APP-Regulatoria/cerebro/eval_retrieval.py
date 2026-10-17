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

Hay dos corpus con índice propio, y cada uno se mide con su par de sets:
  Chile          preguntas-doradas.json      + preguntas-fuera-corpus.json
  EE.UU. (FDA)   preguntas-doradas-fda.json  + preguntas-fuera-corpus-fda.json
La compuerta exige los dos: la sección FDA no se publica sin medirse.

Uso:
  python eval_retrieval.py --k 5
  python eval_retrieval.py --k 5 --gate 90 --json   # para el pipeline diario
  python eval_retrieval.py --k 5 --detalle           # por qué falló cada pregunta
"""

import argparse
import json
import sys
from pathlib import Path

import indice as IX
from respuesta import pregunta_aplica, responder

DIR = Path(__file__).resolve().parent
GOLDEN = DIR / "preguntas-doradas.json"
FUERA = DIR / "preguntas-fuera-corpus.json"
GOLDEN_FDA = DIR / "preguntas-doradas-fda.json"
FUERA_FDA = DIR / "preguntas-fuera-corpus-fda.json"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def matches(result, fuente):
    # `doc_id` es igualdad exacta; `doc_contains` es subcadena. La distinción
    # importa: los doc_id del Código Sanitario son prefijos unos de otros
    # ("Libro V" es subcadena de "Libro VI", "VII" y "VIII"), así que con
    # `doc_contains` una pregunta sobre el Libro V pasaría recuperando el VIII.
    if "doc_id" in fuente:
        return result["doc_id"].lower() == fuente["doc_id"].lower()
    # `doc_contains` junto con {tipo, numero} exige las dos cosas: el número de
    # un decreto exento se repite entre materias (hay un Decreto Exento 25 de
    # medicamentos y otro de dispositivos médicos).
    ok = True
    if "doc_contains" in fuente:
        ok = fuente["doc_contains"].lower() in result["doc_id"].lower()
    if "tipo" in fuente or "numero" in fuente:
        tipo_ok = result.get("tipo", "").lower() == fuente.get("tipo", "").lower()
        num_ok = result.get("numero", "").lstrip("0") == str(fuente.get("numero", "")).lstrip("0")
        ok = ok and tipo_ok and num_ok
    return ok


CONF = {"encontrado": "alta", "parcial": "media", "ausente": "baja"}


def evaluar(idx, golden, fuera, k, gate):
    """Recall@k + abstención de un par de sets sobre un índice."""
    todas = json.loads(golden.read_text(encoding="utf-8"))["preguntas"]
    # Una pregunta de una materia que el corpus todavía no trae (`requiere_categoria`)
    # no se cuenta: queda listada como pendiente.
    preguntas = [p for p in todas if pregunta_aplica(p, idx)]
    pendientes_corpus = [p["id"] for p in todas if not pregunta_aplica(p, idx)]

    hits, fallos, falsas_abstenciones = 0, [], []
    filas, detalles = [], []
    for p in preguntas:
        resp = responder(p["pregunta"], idx=idx)
        # Lo que el buscador muestra, en orden: la principal y las relacionadas.
        mostradas = ([resp["principal"]] if resp["principal"] else []) + resp["relacionadas"]
        results = [{"doc_id": m["_doc_id"], "tipo": m["_tipo"], "numero": m["_numero"]} for m in mostradas[:k]]
        hit = next((r for r in results if any(matches(r, f) for f in p["fuentes_aceptables"])), None)
        if hit:
            hits += 1
            fuente = " ".join(x for x in [hit.get("tipo", ""), hit.get("numero", "")] if x) or hit["doc_id"]
        else:
            fallos.append(p["id"])
            fuente = "—"
        if resp["estado"] == "ausente":
            falsas_abstenciones.append(p["id"])
        if not hit or resp["estado"] == "ausente":
            detalles.append((p, resp, mostradas[:k]))
        filas.append((p["id"], bool(hit), fuente, CONF[resp["estado"]],
                      results[0].get("tipo", "") + " " + results[0].get("numero", "") if results else "—"))

    recall = 100.0 * hits / len(preguntas) if preguntas else 0.0

    # --- Abstención ---------------------------------------------------------
    fuera_ok, fuera_filas = 0, []
    fuera_data = json.loads(fuera.read_text(encoding="utf-8"))["preguntas"] if fuera.exists() else []
    fuera_data = [p for p in fuera_data if pregunta_aplica(p, idx)]
    for p in fuera_data:
        resp = responder(p["pregunta"], idx=idx)
        ok = resp["estado"] == "ausente"
        fuera_ok += 1 if ok else 0
        top = resp["principal"] or (resp["relacionadas"][0] if resp["relacionadas"] else None)
        fuera_filas.append((p["id"], ok, CONF[resp["estado"]],
                            round(top["_cobertura_frase"], 2) if top else 0.0))
    abstencion = 100.0 * fuera_ok / len(fuera_data) if fuera_data else 100.0

    return {
        "recall": round(recall, 1), "hits": hits, "total": len(preguntas), "fallos": fallos,
        "abstencion": round(abstencion, 1), "fuera_ok": fuera_ok, "fuera_total": len(fuera_data),
        "falsas_abstenciones": falsas_abstenciones,
        "pendientes_corpus": pendientes_corpus,
        "pasa": recall >= gate and abstencion >= 100.0 and not falsas_abstenciones,
        "_filas": filas, "_fuera_filas": fuera_filas, "_detalles": detalles,
    }


def imprimir(nombre, r, k, gate, detalle=False):
    print("\n" + nombre + " · recall@" + str(k) + " · " + str(r["total"]) + " preguntas doradas\n")
    print("%-30s %-9s %-7s %s" % ("id", "resultado", "conf", "fuente recuperada"))
    print("-" * 82)
    for pid, ok, fuente, conf, top in r["_filas"]:
        marca = "✅ OK" if ok else "❌ MISS"
        detalle = fuente if ok else "(top: " + top + ")"
        print("%-30s %-8s %-7s %s" % (pid, marca, conf, detalle))
    print("-" * 82)
    print("\nRecall@" + str(k) + ": " + str(r["hits"]) + "/" + str(r["total"])
          + " = " + ("%.0f%%" % r["recall"]) + "   "
          + ("✅ pasa gate (>=" + ("%.0f" % gate) + "%)" if r["recall"] >= gate
             else "⚠️ BAJO EL GATE (>=" + ("%.0f" % gate) + "%)"))
    if r["fallos"]:
        print("Fallos: " + ", ".join(r["fallos"]))
    if r["pendientes_corpus"]:
        print("Sin evaluar (su categoría aún no está en el corpus): " + ", ".join(r["pendientes_corpus"]))
    if r["falsas_abstenciones"]:
        print("⚠️ Preguntas doradas con confianza BAJA (falsa abstención): "
              + ", ".join(r["falsas_abstenciones"]))

    if r["fuera_total"]:
        print("\nAbstención · " + str(r["fuera_total"]) + " consultas fuera del corpus\n")
        print("%-30s %-9s %-7s %s" % ("id", "resultado", "conf", "cobertura mejor pasaje"))
        print("-" * 82)
        for pid, ok, conf, top in r["_fuera_filas"]:
            print("%-30s %-8s %-7s %s" % (pid, "✅ OK" if ok else "❌ RESPONDE", conf, top))
        print("-" * 82)
        print("Abstención: " + str(r["fuera_ok"]) + "/" + str(r["fuera_total"])
              + " = " + ("%.0f%%" % r["abstencion"]) + "   "
              + ("✅ pasa gate (100%)" if r["abstencion"] >= 100 else "⚠️ BAJO EL GATE (100%)"))

    # La corrida de CI no deja el corpus a mano: esto es lo único que queda en el log.
    if detalle and r["_detalles"]:
        print("\nDetalle de las preguntas doradas que fallan\n")
        for p, resp, mostradas in r["_detalles"]:
            print("── " + p["id"] + " · " + resp["estado"] + " · " + p["pregunta"])
            print("   motivo: " + resp.get("motivo", ""))
            if resp.get("conceptos_fuera"):
                print("   conceptos fuera del corpus: " + ", ".join(resp["conceptos_fuera"]))
            for i, m in enumerate(mostradas, 1):
                print("   %d. %s · cobertura frase %.2f · puntaje %.2f · %s"
                      % (i, m["cita"], m["_cobertura_frase"], m["_puntaje"], m["_doc_id"]))
                print("      frase: " + " ".join((m.get("frase") or "").split())[:300])
            print()


def publico(r):
    return {k: v for k, v in r.items() if not k.startswith("_")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--gate", type=float, default=90.0, help="recall mínimo aceptable (%%)")
    ap.add_argument("--json", action="store_true", help="salida JSON (para el pipeline)")
    ap.add_argument("--detalle", action="store_true",
                    help="estado, motivo y pasajes de cada pregunta dorada que falla")
    args = ap.parse_args()

    chile = evaluar(IX.load(), GOLDEN, FUERA, args.k, args.gate)
    fda = evaluar(IX.load_fda(), GOLDEN_FDA, FUERA_FDA, args.k, args.gate)
    pasa = chile["pasa"] and fda["pasa"]

    if args.json:
        # Los campos de primer nivel siguen siendo los del corpus chileno (el
        # pipeline y los registros históricos los leen así); la FDA va aparte.
        # `pasa_cl` deja al pipeline publicar el corpus chileno aunque la FDA
        # repruebe (en ese caso se sigue sirviendo el 21 CFR de ayer).
        print(json.dumps(dict(publico(chile), k=args.k, gate=args.gate, fda=publico(fda), pasa=pasa,
                              pasa_cl=chile["pasa"]),
                         ensure_ascii=False))
        sys.exit(0 if pasa else 1)

    imprimir("Chile (ISP/ANAMED + Código Sanitario)", chile, args.k, args.gate, args.detalle)
    imprimir("EE.UU. (21 CFR, FDA)", fda, args.k, args.gate, args.detalle)
    print("\n" + ("✅ COMPUERTA APROBADA" if pasa else "⛔ COMPUERTA REPROBADA"))
    sys.exit(0 if pasa else 1)


if __name__ == "__main__":
    main()
