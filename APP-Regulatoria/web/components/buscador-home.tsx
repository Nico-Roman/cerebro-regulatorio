"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGERENCIAS = [
  "registro sanitario",
  "farmacovigilancia",
  "cosméticos",
  "dispositivos médicos",
  "buenas prácticas de manufactura",
];

/** Caja de búsqueda de la portada: no resuelve la consulta acá, la delega a
 *  /normativa para no cargar el corpus completo en la home. */
export function BuscadorHome() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function ir(query: string) {
    const destino = query.trim() ? `/normativa?q=${encodeURIComponent(query.trim())}` : "/normativa";
    router.push(destino);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ir(q);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej: plazo para notificar reacciones adversas al ISP"
          aria-label="Buscar en la normativa sanitaria chilena"
          className="min-w-0 flex-1 border border-line bg-transparent px-4 py-3.5 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-foreground"
        />
        <button
          type="submit"
          className="shrink-0 bg-foreground px-6 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Buscar norma
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label-micro text-muted">Prueba</span>
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ir(s)}
            className="border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
