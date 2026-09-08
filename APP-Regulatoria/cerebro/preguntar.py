#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
preguntar.py — Buscador local del Cerebro Regulatorio conectado a Ollama.

Es el mismo motor de recuperación de query.py (BM25 híbrido con citas
trazables), pero en vez de dejar la síntesis a Claude Code, se la pide a un
modelo de Ollama corriendo en esta máquina. Pensado para revisar rápido y
gratis los registros del corpus sin depender de una API paga — el sitio
público en Vercel (search-only, sin LLM) es la contraparte para consulta
externa; esta herramienta es de uso local.

Uso:
  python preguntar.py "plazo para notificar reacciones adversas al ISP"
  python preguntar.py "qué regula el Decreto Supremo 3 de 2010" --modelo qwen3:8b
  python preguntar.py "requisitos GCP ensayos clínicos" --vigente --k 6

Requiere Ollama corriendo localmente (http://localhost:11434) con el modelo
indicado ya descargado (`ollama list` para ver los disponibles).
"""

import argparse
import json
import sys
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # consolas Windows (cp1252) no soportan emoji/acentos por defecto

from query import analizar, cite  # reutiliza el motor de recuperación existente

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen3:4b-instruct"

SYSTEM_PROMPT = """Eres el Cerebro Regulatorio Chile (RegBrain), un asistente que responde
preguntas de normativa farmacéutica y sanitaria chilena (ISP/ANAMED) usando
EXCLUSIVAMENTE los pasajes normativos entregados abajo, cada uno con un número [n].

Reglas estrictas:
- Responde solo con lo que dicen los pasajes. Si no cubren la pregunta, dilo
  explícitamente ("no encontrado en el corpus para: ...") en vez de inventar.
- Cita cada afirmación con su número [n] correspondiente.
- La vigencia es por DISPOSICIÓN, no por norma:
  · "⛔ disposición modificada" = ese pasaje fue reemplazado o derogado. NO lo
    presentes como derecho vigente; dilo y remite a la norma modificatoria.
  · "✅ vigente (norma modificada)" = la norma rige pero fue modificada; advierte
    que ese punto en particular podría no ser el texto vigente.
  · "⚠️ vigencia no verificada" = adviértelo siempre.
- Si un pasaje viene marcado "⚠ texto OCR", NO entregues sus cifras como dato
  definitivo: el OCR corrompe justamente los números. Márcalo y remite al PDF.
- Sé conciso y directo, en español.
- Termina siempre con el disclaimer: "Esta respuesta es apoyo a la
  investigación regulatoria, no asesoría regulatoria ni legal formal."
"""

# Cuando el motor dice que la evidencia no alcanza, no se le pide al modelo que
# "tenga cuidado": se le prohíbe responder. Un modelo local de 4B es justamente
# el que peor resiste la tentación de rellenar el vacío.
PROMPT_AUSENCIA = """La señal de confianza del motor de recuperación indica que el
corpus NO cubre esta pregunta ({motivo}).

Tu única respuesta permitida es declarar la ausencia: di que no se encontró la
materia consultada en el corpus ANAMED, menciona qué conceptos faltan y sugiere
dónde más buscar. NO respondas la pregunta, NO uses los pasajes de abajo como si
la respondieran: son solo vecinos temáticos. Termina con el disclaimer."""


def build_user_prompt(query, passages):
    bloques = []
    for i, (score, r) in enumerate(passages, 1):
        # Las alertas viajan DENTRO del bloque del pasaje, pegadas a su cita: si
        # van sueltas al final del prompt, el modelo las lee como comentario
        # general y sigue citando el pasaje derogado como si estuviera vigente.
        avisos = []
        if r.get("alerta_vigencia"):
            avisos.append(r["alerta_vigencia"])
        for a in r.get("alertas_ocr", []):
            avisos.append("⚠ OCR: " + a)
        aviso = ("\n" + "\n".join(avisos)) if avisos else ""
        bloques.append(
            f"[{i}] {cite(r)}\n{r['titulo']}{aviso}\n\"{r['texto'].strip()}\""
        )
    return f"Pregunta: {query}\n\nPasajes recuperados:\n\n" + "\n\n".join(bloques)


def ask_ollama(model, system, user):
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("message", {}).get("content", "").strip()


def main():
    ap = argparse.ArgumentParser(description="Buscador local con síntesis de Ollama")
    ap.add_argument("query", help="consulta en lenguaje natural")
    ap.add_argument("--k", type=int, default=6, help="nº de pasajes a recuperar")
    ap.add_argument("--vigente", action="store_true", help="solo normas con vigencia verificada")
    ap.add_argument("--categoria", help="filtrar por categoría (carpeta ANAMED)")
    ap.add_argument("--sin-ocr", dest="sin_ocr", action="store_true",
                    help="excluir pasajes provenientes de OCR (cifras poco confiables)")
    ap.add_argument("--modelo", default=DEFAULT_MODEL, help=f"modelo de Ollama (default: {DEFAULT_MODEL})")
    args = ap.parse_args()

    results, conf = analizar(args.query, k=args.k, vigente=args.vigente,
                             categoria=args.categoria, sin_ocr=args.sin_ocr)
    if not results:
        print("Sin resultados en el corpus. (El cerebro no inventa: declara ausencia de fuente.)")
        return

    icono = {"alta": "🟢", "media": "🟡", "baja": "🔴"}[conf["confianza"]]
    print(f"\n🔎 {len(results)} pasajes · {icono} confianza {conf['confianza']} "
          f"(cobertura {conf['cobertura']}) … sintetizando con {args.modelo}…\n")

    system = SYSTEM_PROMPT
    if conf["recomendacion"] == "declarar_ausencia":
        system = SYSTEM_PROMPT + "\n\n" + PROMPT_AUSENCIA.format(motivo=conf["motivo"])

    try:
        respuesta = ask_ollama(args.modelo, system, build_user_prompt(args.query, results))
    except Exception as e:
        sys.exit(
            f"No se pudo contactar a Ollama en {OLLAMA_URL} ({e}).\n"
            "¿Está corriendo? Prueba 'ollama list' o abre la app de Ollama."
        )

    print(respuesta)
    print("\n--- Fuentes citadas ---")
    for i, (score, r) in enumerate(results, 1):
        print(f"[{i}] {cite(r)} — {r['titulo'][:90]}")
        if r["fuente_url"]:
            print(f"    {r['fuente_url']}")


if __name__ == "__main__":
    main()
