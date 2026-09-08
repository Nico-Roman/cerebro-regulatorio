"use client";

// Cancelar es una acción destructiva: se pide un clic explícito y se dice qué
// va a pasar antes de hacerlo, no después.

import { useState } from "react";

export function GestionarReserva({ token }: { token: string }) {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "listo" | "error">("inicial");

  async function cancelar() {
    setEstado("enviando");
    try {
      const res = await fetch("/api/agenda/gestionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setEstado(res.ok ? "listo" : "error");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "listo") {
    return (
      <div className="flex flex-col gap-3 border border-line p-5">
        <p className="text-sm">La reunión quedó cancelada y el horario volvió a estar disponible.</p>
        <a href="/agenda" className="text-sm underline">
          Agendar otra hora
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-line p-5">
      <p className="text-sm text-muted">
        Al cancelar se borra el evento de ambos calendarios y se libera el horario para otra
        persona. Si solo quieres cambiar la hora, cancela y agenda de nuevo.
      </p>
      <button
        type="button"
        onClick={cancelar}
        disabled={estado === "enviando"}
        className="self-start border border-red-800 px-5 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-950/30 disabled:opacity-50"
      >
        {estado === "enviando" ? "Cancelando…" : "Cancelar la reunión"}
      </button>
      {estado === "error" && (
        <p role="alert" className="text-sm text-amber-300">
          No pudimos cancelarla. Escríbeme a contacto@regulamed.cl y lo resuelvo a mano.
        </p>
      )}
    </div>
  );
}
