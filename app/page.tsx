"use client";

import { useEffect, useState } from "react";

interface SearchResult {
  score: number;
  cita: string;
  titulo: string;
  tipo: string;
  numero: string;
  categoria: string;
  articulo: string;
  pagina: number;
  vigencia: string;
  vigencia_fuente: string;
  fuente_texto: string;
  pdf_path: string;
  fuente_url: string;
  texto: string;
}

const EJEMPLOS = [
  "plazo para notificar reacciones adversas al ISP",
  "requisitos para importar productos farmacéuticos",
  "qué regula el Decreto Supremo 3 de 2010",
  "buenas prácticas de manufactura estériles",
  "requisitos GCP ensayos clínicos",
];

export default function Home() {
  const [q, setQ] = useState("");
  const [vigente, setVigente] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || []))
      .catch(() => {});
  }, []);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, k: "8" });
      if (vigente) params.set("vigente", "1");
      if (categoria) params.set("categoria", categoria);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.resultados || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-10 gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cerebro Regulatorio Chile <span className="text-neutral-400 font-normal">· RegBrain</span>
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
          Busca en la normativa farmacéutica y sanitaria chilena (ISP/ANAMED) y obtén los
          pasajes normativos exactos con cita trazable a la fuente. No redacta respuestas
          por IA: recuperación pura, sin invención.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q);
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: plazo para notificar reacciones adversas al ISP"
            className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={vigente}
              onChange={(e) => setVigente(e.target.checked)}
            />
            solo vigencia verificada
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1"
          >
            <option value="">todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </form>

      {!searched && (
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Ejemplos:</span>
          <div className="flex flex-wrap gap-2">
            {EJEMPLOS.map((ej) => (
              <button
                key={ej}
                onClick={() => {
                  setQ(ej);
                  runSearch(ej);
                }}
                className="rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {ej}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !loading && results && results.length === 0 && (
        <p className="text-sm text-neutral-500">
          Sin resultados en el corpus. El cerebro no inventa: declara ausencia de fuente.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {results?.map((r, i) => (
          <article
            key={i}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{[r.tipo, r.numero].filter(Boolean).join(" ") || r.categoria}</span>
              {r.articulo && <span className="text-neutral-500">· {r.articulo}</span>}
              <span className="text-neutral-500">· pág. {r.pagina}</span>
              <span
                className={
                  r.vigencia === "vigente"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {r.vigencia === "vigente" ? "✅ vigente" : "⚠️ vigencia no verificada"}
              </span>
            </div>
            <h2 className="text-sm font-medium leading-snug">{r.titulo}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              “{r.texto.replace(/\s+/g, " ").trim().slice(0, 420)}
              {r.texto.length > 420 ? "…" : ""}”
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
              <span>categoría: {r.categoria}</span>
              {r.fuente_url ? (
                <a
                  href={r.fuente_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  ver fuente oficial ↗
                </a>
              ) : (
                <span>fuente: {r.pdf_path}</span>
              )}
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-auto pt-8 text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-200 dark:border-neutral-800">
        Esta herramienta es un apoyo a la investigación regulatoria y no constituye
        asesoría regulatoria ni legal formal. Verifica siempre contra la fuente oficial
        antes de tomar decisiones. Vigencia mostrada según el listado oficial del ISP
        (última sincronización del corpus).
      </footer>
    </div>
  );
}
