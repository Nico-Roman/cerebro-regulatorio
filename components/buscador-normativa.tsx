"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  modificada: boolean;
  disposicion_modificada: boolean;
  alerta_vigencia: string;
  fuente_texto: string;
  alertas_ocr: string[];
  pdf_path: string;
  fuente_url: string;
  texto: string;
}

interface Confianza {
  confianza: "alta" | "media" | "baja";
  cobertura: number;
  cobertura_top: number;
  recomendacion: "responder" | "responder_con_reservas" | "declarar_ausencia";
  motivo: string;
  conceptos_fuera_del_corpus: string[];
}

// El sello de vigencia es por DISPOSICIÓN, no por norma: una norma puede seguir
// vigente y aun así tener el punto concreto que se está citando ya reemplazado.
function selloVigencia(r: SearchResult) {
  if (r.disposicion_modificada) return { texto: "⛔ disposición modificada", clase: "text-red-400" };
  if (r.vigencia !== "vigente") return { texto: "⚠️ vigencia no verificada", clase: "text-amber-400" };
  if (r.modificada) return { texto: "✅ vigente (norma modificada)", clase: "text-amber-300" };
  return { texto: "✅ vigente", clase: "text-emerald-400" };
}

function PlazosPanel({ plazos }: { plazos: PlazoDetectado[] | null }) {
  return (
    <section>
      <h2 className="label-micro mb-4 text-muted">Plazos con fecha límite</h2>
      {plazos === null ? (
        <p className="text-xs text-muted">Cargando…</p>
      ) : plazos.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
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
                className={`block border border-amber-900/60 bg-amber-950/20 p-3 text-xs transition-colors ${
                  p.fuente_url ? "hover:border-amber-700" : "pointer-events-none opacity-70"
                }`}
              >
                <div className="font-medium text-amber-300">
                  {[p.tipo, p.numero].filter(Boolean).join(" ")}
                </div>
                <p className="mt-1 leading-snug text-muted">{p.resumen}</p>
                <div className="mt-2 font-medium text-amber-400">Vence: {p.fechaLimite}</div>
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
      <h2 className="label-micro mb-4 text-muted">Últimas normas</h2>
      {normas === null ? (
        <p className="text-xs text-muted">Cargando…</p>
      ) : normas.length === 0 ? (
        <p className="text-xs text-muted">Sin normas en el corpus.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {normas.map((n, i) => (
            <li key={i}>
              <a
                href={n.fuente_url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block border border-line p-3 text-xs transition-colors ${
                  n.fuente_url ? "hover:border-neutral-600" : "pointer-events-none opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {[n.tipo, n.numero].filter(Boolean).join(" ")}
                  </span>
                  {n.fecha && <span className="whitespace-nowrap text-muted">{n.fecha}</span>}
                </div>
                <p className="mt-1 leading-snug text-muted">
                  {n.titulo.length > 130 ? `${n.titulo.slice(0, 130)}…` : n.titulo}
                </p>
                <span
                  className={`mt-2 inline-block text-[10px] uppercase tracking-wide ${
                    n.vigencia === "vigente" ? "text-emerald-400" : "text-amber-500"
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

export function BuscadorNormativa() {
  const searchParams = useSearchParams();
  // La home manda la consulta por querystring (?q=), así que es el valor
  // inicial del campo, no algo que se asigne después con un efecto.
  const consultaUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(consultaUrl);
  const [vigente, setVigente] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [confianza, setConfianza] = useState<Confianza | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [plazos, setPlazos] = useState<PlazoDetectado[] | null>(null);
  const [normasRecientes, setNormasRecientes] = useState<NormaReciente[] | null>(null);

  const runSearch = useCallback(
    async (query: string, opts?: { vigente?: boolean; categoria?: string }) => {
      if (!query.trim()) return;
      setLoading(true);
      setSearched(true);
      try {
        const params = new URLSearchParams({ q: query, k: "8" });
        if (opts?.vigente ?? vigente) params.set("vigente", "1");
        const cat = opts?.categoria ?? categoria;
        if (cat) params.set("categoria", cat);
        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();
        setResults(data.resultados || []);
        setConfianza(data.confianza || null);
      } finally {
        setLoading(false);
      }
    },
    [vigente, categoria]
  );

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

  // Dispara la búsqueda que venía en la URL una sola vez al montar; después el
  // usuario manda desde el formulario de esta misma página.
  const yaBuscoDesdeUrl = useRef(false);
  useEffect(() => {
    if (yaBuscoDesdeUrl.current || !consultaUrl) return;
    yaBuscoDesdeUrl.current = true;
    runSearch(consultaUrl);
  }, [consultaUrl, runSearch]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="label-micro text-muted">Herramienta gratuita</span>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Buscador de normativa sanitaria chilena
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Busca en la normativa farmacéutica y sanitaria chilena (ISP/ANAMED) y obtén los
          pasajes normativos exactos con cita trazable a la fuente. No redacta respuestas por
          IA: recuperación pura, sin invención.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="order-2 lg:order-1 lg:w-60 lg:shrink-0">
          <PlazosPanel plazos={plazos} />
        </aside>

        <main className="order-1 flex w-full min-w-0 flex-1 flex-col gap-8 lg:order-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: plazo para notificar reacciones adversas al ISP"
                aria-label="Buscar en la normativa"
                className="min-w-0 flex-1 border border-line bg-transparent px-3 py-2.5 text-base outline-none focus:border-foreground sm:py-2 sm:text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50 sm:py-2"
              >
                {loading ? "Buscando…" : "Buscar"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <label className="flex items-center gap-1.5 py-1">
                <input
                  type="checkbox"
                  checked={vigente}
                  onChange={(e) => setVigente(e.target.checked)}
                  className="h-4 w-4 accent-neutral-200"
                />
                solo vigencia verificada
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                aria-label="Filtrar por categoría"
                className="w-full border border-line bg-background px-2 py-1.5 text-base sm:w-auto sm:text-xs"
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
            <div className="flex flex-col gap-3">
              <span className="label-micro text-muted">Ejemplos</span>
              <div className="flex flex-wrap gap-2">
                {EJEMPLOS.map((ej) => (
                  <button
                    key={ej}
                    onClick={() => {
                      setQ(ej);
                      runSearch(ej);
                    }}
                    className="border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
                  >
                    {ej}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searched && !loading && results && results.length === 0 && (
            <p className="text-sm text-muted">
              Sin resultados en el corpus. El cerebro no inventa: declara ausencia de fuente.
            </p>
          )}

          {searched && !loading && confianza && results && results.length > 0 && (
            <div
              className={
                "border-l-2 px-4 py-3 text-xs leading-relaxed " +
                (confianza.recomendacion === "declarar_ausencia"
                  ? "border-red-500 bg-red-500/5 text-red-300"
                  : confianza.confianza === "media"
                    ? "border-amber-500 bg-amber-500/5 text-amber-200"
                    : "border-emerald-500 bg-emerald-500/5 text-emerald-200")
              }
            >
              {confianza.recomendacion === "declarar_ausencia" ? (
                <>
                  <strong>La evidencia no alcanza para responder.</strong> Los pasajes de abajo son
                  los más cercanos que hay en el corpus, pero {confianza.motivo}. Trátalos como
                  contexto, no como respuesta.
                </>
              ) : confianza.confianza === "media" ? (
                <>
                  <strong>Cobertura parcial.</strong> {confianza.motivo}. Contrasta entre pasajes
                  antes de concluir.
                </>
              ) : (
                <>
                  <strong>Cobertura completa.</strong> Los pasajes recuperados cubren los términos
                  de la consulta.
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {results?.map((r, i) => (
              <article key={i} className="flex flex-col gap-2 border border-line p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">
                    {[r.tipo, r.numero].filter(Boolean).join(" ") || r.categoria}
                  </span>
                  {r.articulo && <span className="text-muted">· {r.articulo}</span>}
                  <span className="text-muted">· pág. {r.pagina}</span>
                  <span className={selloVigencia(r).clase}>{selloVigencia(r).texto}</span>
                  {r.fuente_texto === "ocr" && (
                    <span className="text-amber-400/80">· ⚠ texto OCR</span>
                  )}
                </div>
                <h2 className="text-sm font-medium leading-snug">{r.titulo}</h2>
                {r.alerta_vigencia && (
                  <p
                    className={
                      "border-l-2 pl-3 text-xs leading-relaxed " +
                      (r.disposicion_modificada
                        ? "border-red-500 text-red-300"
                        : "border-amber-500 text-amber-300")
                    }
                  >
                    {r.alerta_vigencia}
                  </p>
                )}
                {r.alertas_ocr?.length > 0 && (
                  <ul className="flex flex-col gap-1 border-l-2 border-amber-500/50 pl-3 text-xs text-amber-300/80">
                    {r.alertas_ocr.map((a, j) => (
                      <li key={j}>⚠ OCR: {a} — verifica la cifra contra el PDF.</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm leading-relaxed text-neutral-300">
                  “{r.texto.replace(/\s+/g, " ").trim().slice(0, 420)}
                  {r.texto.length > 420 ? "…" : ""}”
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  <span>categoría: {r.categoria}</span>
                  {r.fuente_url ? (
                    <a
                      href={r.fuente_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-foreground"
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

        <aside className="order-3 lg:w-60 lg:shrink-0">
          <NormasRecientesPanel normas={normasRecientes} />
        </aside>
      </div>
    </div>
  );
}