"use client";

// Voto de utilidad debajo de los resultados. Deliberadamente pequeño: dos
// botones y, solo si la respuesta fue "no", una caja para contar qué faltaba.
// Ese texto es la parte valiosa — dice qué norma buscaba la persona cuando el
// corpus no la tenía.

import { useState } from "react";

type Estado = "inicial" | "enviando" | "listo" | "error";

export function FeedbackConsulta({ consultaId }: { consultaId: string }) {
  const [voto, setVoto] = useState<boolean | null>(null);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<Estado>("inicial");

  async function enviar(util: boolean, texto?: string) {
    setEstado("enviando");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultaId, util, comentario: texto ?? null }),
      });
      setEstado(res.ok ? "listo" : "error");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "listo") {
    return (
      <p className="border border-line px-4 py-3 text-xs text-muted">
        Gracias. Tu respuesta entra directo a la lista de lo que le falta al corpus.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">¿Encontraste lo que buscabas?</span>
        <button
          type="button"
          disabled={estado === "enviando"}
          onClick={() => {
            setVoto(true);
            void enviar(true);
          }}
          className={`border px-3 py-1.5 transition-colors disabled:opacity-50 ${
            voto === true
              ? "border-emerald-500 text-emerald-300"
              : "border-line text-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          disabled={estado === "enviando"}
          onClick={() => setVoto(false)}
          className={`border px-3 py-1.5 transition-colors disabled:opacity-50 ${
            voto === false
              ? "border-amber-500 text-amber-300"
              : "border-line text-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          No
        </button>
      </div>

      {voto === false && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(false, comentario.trim() || undefined);
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="feedback-comentario" className="text-xs text-muted">
            ¿Qué norma o dato esperabas encontrar? (opcional, pero es lo que más ayuda)
          </label>
          <textarea
            id="feedback-comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <button
            type="submit"
            disabled={estado === "enviando"}
            className="self-start bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {estado === "enviando" ? "Enviando…" : "Enviar"}
          </button>
        </form>
      )}

      {estado === "error" && (
        <p role="alert" className="text-xs text-amber-300">
          No pudimos registrar tu respuesta. Vuelve a intentar en unos segundos.
        </p>
      )}
    </div>
  );
}
