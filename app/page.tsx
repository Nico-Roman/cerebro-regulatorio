"use client";

import { useEffect, useState } from "react";
import type { NormaReciente, PlazoDetectado } from "@/lib/normativa";

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

function PlazosPanel({ plazos }: { plazos: PlazoDetectado[] | null }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
        Plazos con fecha límite
      </h2>
      {plazos === null ? (
        <p className="text-xs text-neutral-400">Cargando…</p>
      ) : plazos.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          No se detectan plazos con fecha límite vigente en el corpus actual. Este panel se
          actualiza solo con la vigilancia diaria del ISP.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {plazos.map((p, i) => (
            <li key={i}>
              <a
                href={p.fuente_url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs transition-colors ${
                  p.fuente_url
                    ? "hover:border-amber-400 dark:hover:border-amber-700"
                    : "pointer-events-none opacity-70"
                }`}
              >
                <div className="font-medium text-amber-800 dark:text-amber-300">
                  {[p.tipo, p.numero].filter(Boolean).join(" ")}
                </div>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1 leading-snug">{p.resumen}</p>
                <div className="mt-2 font-medium text-amber-700 dark:text-amber-400">
                  Vence: {p.fechaLimite}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NormasRecientesPanel({ normas }: { normas: NormaReciente[] | null }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
        Últimas normas
      </h2>
      {normas === null ? (
        <p className="text-xs text-neutral-400">Cargando…</p>
      ) : normas.length === 0 ? (
        <p className="text-xs text-neutral-500">Sin normas en el corpus.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {normas.map((n, i) => (
            <li key={i}>
              <a
                href={n.fuente_url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-xs transition-colors ${
                  n.fuente_url
                    ? "hover:border-neutral-400 dark:hover:border-neutral-600"
                    : "pointer-events-none opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{[n.tipo, n.numero].filter(Boolean).join(" ")}</span>
                  {n.fecha && <span className="text-neutral-400 whitespace-nowrap">{n.fecha}</span>}
                </div>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1 leading-snug">
                  {n.titulo.length > 130 ? `${n.titulo.slice(0, 130)}…` : n.titulo}
                </p>
                <span
                  className={`inline-block mt-2 text-[10px] uppercase tracking-wide ${
                    n.vigencia === "vigente"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-500"
                  }`}
                >
                  {n.vigencia === "vigente" ? "vigente" : "vigencia no verificada"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
  const [plazos, setPlazos] = useState<PlazoDetectado[] | null>(null);
  const [normasRecientes, setNormasRecientes] = useState<NormaReciente[] | null>(null);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || []))
      .catch(() => {});
    fetch("/api/plazos")
      .then((r) => r.json())
      .then((d) => setPlazos(d.plazos || []))
      .catch(() => setPlazos([]));
    fetch("/api/normativa-reciente")
      .then((r) => r.json())
      .then((d) => setNormasRecientes(d.normas || []))
      .catch(() => setNormasRecientes([]));
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
    <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto px-4 py-6 sm:py-10 gap-6 sm:gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Cerebro Regulatorio Chile <span className="text-neutral-400 font-normal">· RegBrain</span>
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
          Busca en la normativa farmacéutica y sanitaria chilena (ISP/ANAMED) y obtén los
          pasajes normativos exactos con cita trazable a la fuente. No redacta respuestas
          por IA: recuperación pura, sin invención.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:items-start">
        <aside className="order-2 lg:order-1 lg:w-64 lg:flex-shrink-0">
          <PlazosPanel plazos={plazos} />
        </aside>

        <main className="order-1 lg:order-2 flex-1 min-w-0 max-w-3xl mx-auto w-full flex flex-col gap-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: plazo para notificar reacciones adversas al ISP"
                className="flex-1 min-w-0 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2.5 sm:py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-neutral-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2.5 sm:py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Buscando…" : "Buscar"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <label className="flex items-center gap-1.5 py-1">
                <input
                  type="checkbox"
                  checked={vigente}
                  onChange={(e) => setVigente(e.target.checked)}
                  className="h-4 w-4"
                />
                solo vigencia verificada
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-base sm:text-xs w-full sm:w-auto"
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
                    className="rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
        </main>

        <aside className="order-3 lg:w-64 lg:flex-shrink-0">
          <NormasRecientesPanel normas={normasRecientes} />
        </aside>
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
