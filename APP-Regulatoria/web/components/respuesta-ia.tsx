"use client";

// Botón para redactar la respuesta con IA. No se dispara solo: la mayoría de
// las consultas se resuelven leyendo los pasajes, y cada llamada cuesta.

import { useEffect, useState } from "react";

type Estado = "inicial" | "cargando" | "listo" | "ausencia" | "error";

export function RespuestaIa({ consultaId }: { consultaId: string }) {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [texto, setTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setEstado("inicial");
    setTexto(null);
    setAviso(null);
  }, [consultaId]);

  async function pedir() {
    setEstado("cargando");
    setAviso(null);
    try {
      const res = await fetch("/api/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultaId }),
      });
      const datos = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setAviso("La redacción automática todavía no está habilitada.");
        setEstado("error");
        return;
      }
      if (res.status === 429) {
        setAviso(datos.mensaje || "Llegaste a la cuota diaria de respuestas redactadas.");
        setEstado("error");
        return;
      }
      if (!res.ok) {
        setAviso("No pudimos redactar la respuesta. Los pasajes de arriba siguen sirviendo.");
        setEstado("error");
        return;
      }
      if (datos.ausencia) {
        setAviso(datos.motivo);
        setEstado("ausencia");
        return;
      }
      setTexto(datos.respuesta);
      setEstado("listo");
    } catch {
      setAviso("No pudimos redactar la respuesta. Los pasajes de arriba siguen sirviendo.");
      setEstado("error");
    }
  }

  if (estado === "inicial") {
    return (
      <button
        type="button"
        onClick={pedir}
        className="self-start border border-line px-4 py-2 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
      >
        Redactar respuesta con los pasajes de arriba
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-l-2 border-line px-4 py-3">
      {estado === "cargando" && <p className="text-sm text-muted">Redactando…</p>}

      {estado === "listo" && texto && (
        <>
          <span className="label-micro text-muted">Respuesta redactada</span>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            {texto}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Redactada por un modelo a partir de los pasajes de esta búsqueda, con temperatura cero
            y sin acceso a nada más. Verifica siempre contra la fuente oficial antes de decidir: es
            apoyo a la investigación, no asesoría regulatoria ni legal.
          </p>
        </>
      )}

      {(estado === "ausencia" || estado === "error") && aviso && (
        <p className={estado === "ausencia" ? "text-sm text-amber-200" : "text-sm text-muted"}>
          {aviso}
        </p>
      )}
    </div>
  );
}
