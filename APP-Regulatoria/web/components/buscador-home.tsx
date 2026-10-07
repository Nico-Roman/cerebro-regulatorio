"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Cada una devuelve la norma correcta con el corpus actual (probado el 23-09).
// `extra` trae las que dependen del corpus del día ("dispositivos médicos"): la
// compuerta del pipeline las comprueba y las anota en estado-corpus.json.
// Antes de agregar otra, búscala: una sugerencia que falla es peor que ninguna.
const SUGERENCIAS = [
  "vigencia del registro sanitario",
  "validez de la receta retenida",
  "rotulado de cosméticos",
  "qué es una droguería",
  "publicidad de medicamentos con receta",
];

/** Caja de búsqueda de la portada: no resuelve la consulta acá, la delega a
 *  /normativa para no cargar el corpus completo en la home. */
export function BuscadorHome({ extra = [] }: { extra?: string[] }) {
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
          className="min-w-0 flex-1 border border-line bg-transparent px-4 py-3.5 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
        />
        <button
          type="submit"
          className="shrink-0 boton-neon px-6 py-3.5 text-sm font-medium"
        >
          Buscar norma
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label-micro text-muted">Prueba</span>
        {[...SUGERENCIAS, ...extra].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ir(s)}
            className="border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
