"use client";

// Buscador de normativa para químicos farmacéuticos.
//
// La pantalla responde en tres niveles, en este orden:
//   1. Un estado en palabras de persona: "Pasaje más cercano", "Respuesta
//      parcial" o "Esto no está en nuestra base".
//   2. La frase exacta de la norma que responde, con su artículo y el dato
//      destacado. El texto completo del artículo está a un clic.
//   3. Otras normas relacionadas, sin competir con la respuesta principal.
//
// Lo que ya no se muestra, a propósito: puntajes de cobertura, raíces de
// palabras, "pág. 0", nombres de carpeta como categoría y el sello "norma
// modificada" en cada tarjeta. Eran señales para el motor, no para quien
// pregunta, y en la auditoría del 11-09-2026 eran la causa de que las
// respuestas se leyeran confusas.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WHATSAPP_URL } from "@/lib/site";
import type { NormaReciente, PlazoDetectado } from "@/lib/normativa";
import { FeedbackConsulta } from "@/components/feedback-consulta";
import { RespuestaIa } from "@/components/respuesta-ia";

type Estado = "encontrado" | "parcial" | "ausente";

// Dos bases con índice propio: la chilena y la de EE.UU. (21 CFR, FDA).
type Jurisdiccion = "cl" | "fda";

interface Resultado {
  cita: string;
  norma: string;
  titulo: string;
  articulo: string;
  pagina: number | null;
  categoria: string;
  frase: string;
  resaltar: Array<[number, number]>;
  texto: string;
  fuente_url: string;
  es_ocr: boolean;
  avisos: string[];
}

interface RespuestaApi {
  pregunta: string;
  estado: Estado;
  titular: string;
  motivo: string;
  principal: Resultado | null;
  relacionadas: Resultado[];
  avisos: string[];
  consultaId: string | null;
  iaDisponible: boolean;
  fda?: { fecha_version: string; documentos: number; pasajes: number } | null;
}

// Las categorías viajan al API como nombre de carpeta; acá se muestran como
// las nombraría una persona.
const ETIQUETAS_CATEGORIA: Record<string, string> = {
  codigo_sanitario: "Código Sanitario (ley)",
  cosmeticos: "Cosméticos",
  ensayos_clinicos: "Ensayos clínicos",
  establecimientos_autorizacion_y_fiscalizacion: "Establecimientos: autorización y fiscalización",
  farmacovigilancia: "Farmacovigilancia",
  importacion_y_exportacion_control_y_vigilancia: "Importación y exportación",
  laboratorio_nacional_de_control: "Laboratorio Nacional de Control",
  medicamentos: "Medicamentos",
  otros: "Otras normas del ISP",
};

function etiquetaCategoria(c: string): string {
  if (ETIQUETAS_CATEGORIA[c]) return ETIQUETAS_CATEGORIA[c];
  const texto = c.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const EJEMPLOS = [
  "¿En qué plazo se notifica una reacción adversa seria a un medicamento?",
  "¿Cuál es la validez de una receta retenida?",
  "¿Cuánto dura la vigencia de un registro sanitario?",
  "¿Qué es una droguería?",
  "¿Qué es la farmacovigilancia?",
];

// El 21 CFR está en inglés y el motor busca palabra por palabra: los ejemplos
// enseñan a preguntar en inglés.
const EJEMPLOS_FDA = [
  "What are the responsibilities of the quality control unit?",
  "electronic signature requirements",
  "basic elements of informed consent",
  "premarket notification 510(k) content",
  "declaration of ingredients on cosmetic labels",
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10-06" -> "6 de octubre de 2026", sin depender de la zona horaria. */
function fechaLarga(iso: string): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

function SelectorJurisdiccion({
  valor,
  onCambio,
}: {
  valor: Jurisdiccion;
  onCambio: (j: Jurisdiccion) => void;
}) {
  const opciones: Array<[Jurisdiccion, string]> = [
    ["cl", "Chile · ISP"],
    ["fda", "EE.UU. · FDA"],
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Normativa de qué país"
      className="flex w-full border border-line sm:w-auto sm:self-start"
    >
      {opciones.map(([j, etiqueta]) => (
        <button
          key={j}
          type="button"
          role="radio"
          aria-checked={valor === j}
          onClick={() => onCambio(j)}
          className={`flex-1 px-4 py-2 text-sm transition-colors sm:flex-none sm:py-1.5 sm:text-xs ${
            valor === j ? "bg-accent/15 font-medium text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

/** Siempre a la vista en la sección FDA: un pasaje del 21 CFR no rige en Chile. */
function AvisoFda({ version }: { version: string | null }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-sky-500/70 bg-sky-500/5 px-4 py-3 text-sm leading-relaxed">
      <p className="text-sky-200">
        <span className="font-medium">Normativa de EE.UU., no de Chile.</span> Buscas en el 21 CFR de la FDA: sirve
        como referencia comparada, pero no rige en Chile. Para cumplir en Chile, cambia a «Chile · ISP».
      </p>
      <p className="text-xs text-muted">
        El 21 CFR está en inglés: escribe la pregunta en inglés. Cubre 36 partes (GMP, ensayos clínicos, registro,
        etiquetado, biológicos, cosméticos y dispositivos)
        {version ? `, con las enmiendas al ${fechaLarga(version)}` : ""}. No incluye las guías de la FDA.
      </p>
    </div>
  );
}

const ESTILO_ESTADO: Record<Estado, { borde: string; punto: string; texto: string }> = {
  encontrado: { borde: "border-accent/70", punto: "bg-neon", texto: "text-accent" },
  parcial: { borde: "border-amber-500/70", punto: "bg-amber-400", texto: "text-amber-300" },
  ausente: { borde: "border-neutral-600", punto: "bg-neutral-400", texto: "text-neutral-200" },
};

/** Pinta la frase con los tramos destacados (el dato pedido y las palabras de la pregunta). */
function FraseResaltada({ frase, tramos }: { frase: string; tramos: Array<[number, number]> }) {
  const partes: ReactNode[] = [];
  let desde = 0;
  tramos.forEach(([a, b], i) => {
    if (a > desde) partes.push(frase.slice(desde, a));
    partes.push(
      <mark key={i} className="rounded-sm bg-accent/15 px-0.5 text-inherit">
        {frase.slice(a, b)}
      </mark>
    );
    desde = b;
  });
  if (desde < frase.length) partes.push(frase.slice(desde));
  return <>{partes}</>;
}

function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {avisos.map((a, i) => (
        <li key={i} className="border-l-2 border-amber-500/70 pl-3 text-xs leading-relaxed text-amber-200">
          <span className="font-medium">Ojo:</span> {a}
        </li>
      ))}
    </ul>
  );
}

function TextoCompleto({ r }: { r: Resultado }) {
  return (
    <details className="group text-xs">
      <summary className="cursor-pointer select-none text-muted underline-offset-4 hover:text-foreground hover:underline">
        Ver texto completo{r.cita.startsWith("21 CFR") ? " de la sección" : r.articulo ? " del artículo" : ""}
      </summary>
      <p className="mt-3 whitespace-pre-line border-l border-line pl-3 leading-relaxed text-neutral-300">
        {r.texto.trim()}
      </p>
    </details>
  );
}

function EnlaceFuente({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-accent/50 underline-offset-4 hover:text-foreground">
      Fuente oficial ↗
    </a>
  );
}

function TarjetaPrincipal({ r }: { r: Resultado }) {
  return (
    <article className="flex flex-col gap-4 border border-line bg-surface p-5">
      <header className="flex flex-col gap-1">
        <span className="font-display text-lg font-medium tracking-tight">{r.cita}</span>
        <span className="text-xs leading-snug text-muted">{r.titulo}</span>
      </header>
      <blockquote className="border-l-2 border-accent/70 pl-4 text-[15px] leading-relaxed text-neutral-100">
        «<FraseResaltada frase={r.frase} tramos={r.resaltar} />»
      </blockquote>
      <Avisos avisos={r.avisos} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <EnlaceFuente url={r.fuente_url} />
        <span className="text-xs text-muted">{r.categoria}</span>
      </div>
      <TextoCompleto r={r} />
    </article>
  );
}

function TarjetaRelacionada({ r }: { r: Resultado }) {
  return (
    <article className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium">{r.cita}</span>
        <EnlaceFuente url={r.fuente_url} />
      </div>
      <p className="line-clamp-1 text-xs text-muted">{r.titulo}</p>
      <p className="text-sm leading-relaxed text-neutral-300">
        «<FraseResaltada frase={r.frase} tramos={r.resaltar} />»
      </p>
      <Avisos avisos={r.avisos} />
      <TextoCompleto r={r} />
    </article>
  );
}

function PlazosPanel({ plazos }: { plazos: PlazoDetectado[] | null }) {
  // Vacío parece roto: sin plazos vigentes, el panel no se muestra.
  if (plazos !== null && plazos.length === 0) return null;
  return (
    <section>
      <h2 className="label-micro mb-4 text-muted">Plazos con fecha límite</h2>
      {plazos === null ? (
        <p className="text-xs text-muted">Cargando…</p>
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
                <div className="font-medium text-amber-300">{[p.tipo, p.numero].filter(Boolean).join(" ")}</div>
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
        <p className="text-xs text-muted">Sin normas en la base.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {normas.map((n, i) => (
            <li key={i}>
              <a
                href={n.fuente_url || undefined}
                target="_blank"
                rel="noreferrer"
                className={`block border border-line p-3 text-xs transition-colors ${
                  n.fuente_url ? "hover:border-accent/50" : "pointer-events-none opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{[n.tipo, n.numero].filter(Boolean).join(" ")}</span>
                  {n.fecha && <span className="whitespace-nowrap text-muted">{n.fecha}</span>}
                </div>
                <p className="mt-1 leading-snug text-muted">
                  {n.titulo.length > 130 ? `${n.titulo.slice(0, 130)}…` : n.titulo}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BuscadorNormativa() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // La home manda la consulta por querystring (?q=), así que es el valor
  // inicial del campo, no algo que se asigne después con un efecto.
  const consultaUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(consultaUrl);
  const [jurisdiccion, setJurisdiccion] = useState<Jurisdiccion>(searchParams.get("j") === "fda" ? "fda" : "cl");
  const [versionFda, setVersionFda] = useState<string | null>(null);
  const [vigente, setVigente] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [respuesta, setRespuesta] = useState<RespuestaApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [plazos, setPlazos] = useState<PlazoDetectado[] | null>(null);
  const [normasRecientes, setNormasRecientes] = useState<NormaReciente[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const runSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setLoading(true);
      setVerTodas(false);
      try {
        const params = new URLSearchParams({ q: query });
        if (jurisdiccion === "fda") {
          // Los filtros son del corpus chileno: en el 21 CFR todo es vigente y
          // las materias son otras.
          params.set("j", "fda");
        } else {
          if (vigente) params.set("vigente", "1");
          if (categoria) params.set("categoria", categoria);
        }
        const res = await fetch(`/api/search?${params.toString()}`);

        // La sesión puede vencer con la pantalla abierta. Sin esto, un 401 se
        // vería como "no está en la base", que es exactamente la conclusión
        // equivocada.
        if (res.status === 401) {
          // Navegación dura a propósito: la sesión acaba de morir y una
          // navegación blanda conservaría el encabezado de sesión iniciada.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = `/ingresar?next=${encodeURIComponent(
            `/normativa?q=${encodeURIComponent(query)}${jurisdiccion === "fda" ? "&j=fda" : ""}`
          )}`;
          return;
        }
        if (res.status === 403) {
          // La sesión es válida: solo falta completar el perfil.
          router.push("/perfil");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setAviso(err.mensaje || "No pudimos completar la búsqueda. Vuelve a intentar en unos segundos.");
          setRespuesta(null);
          return;
        }
        setAviso(null);
        const datos = (await res.json()) as RespuestaApi;
        if (datos.fda?.fecha_version) setVersionFda(datos.fda.fecha_version);
        setRespuesta(datos);
      } catch {
        setAviso("No pudimos completar la búsqueda. Revisa tu conexión y vuelve a intentar.");
        setRespuesta(null);
      } finally {
        setLoading(false);
      }
    },
    [vigente, categoria, jurisdiccion, router]
  );

  const cambiarJurisdiccion = (j: Jurisdiccion) => {
    if (j === jurisdiccion) return;
    // Una respuesta del otro país en pantalla se leería como de este: se limpia.
    setJurisdiccion(j);
    setRespuesta(null);
    setAviso(null);
    setQ("");
  };
  const ejemplos = jurisdiccion === "fda" ? EJEMPLOS_FDA : EJEMPLOS;

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

  // Dispara la búsqueda que venía en la URL una sola vez al montar.
  const yaBuscoDesdeUrl = useRef(false);
  useEffect(() => {
    if (yaBuscoDesdeUrl.current || !consultaUrl) return;
    yaBuscoDesdeUrl.current = true;
    runSearch(consultaUrl);
  }, [consultaUrl, runSearch]);

  const estilo = respuesta ? ESTILO_ESTADO[respuesta.estado] : null;
  const relacionadas = respuesta?.relacionadas ?? [];
  // Con respuesta, las dos primeras relacionadas quedan a la vista y el resto
  // plegado. Sin respuesta, los textos cercanos van plegados: no responden.
  const visibles = respuesta?.estado === "ausente" ? [] : relacionadas.slice(0, verTodas ? relacionadas.length : 2);
  const plegadas = respuesta?.estado === "ausente" ? relacionadas : verTodas ? [] : relacionadas.slice(2);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="label-micro text-accent">Herramienta gratuita para químicos farmacéuticos</span>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Pregúntale a la normativa</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Escribe tu pregunta como la harías en el mesón. Te mostramos la frase exacta de la norma que la
          responde, con su artículo y el enlace a la fuente oficial. Si la respuesta no está en la base, te lo
          decimos.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="order-2 lg:order-1 lg:w-60 lg:shrink-0">
          <PlazosPanel plazos={plazos} />
        </aside>

        <main className="order-1 flex w-full min-w-0 flex-1 flex-col gap-6 lg:order-2">
          <SelectorJurisdiccion valor={jurisdiccion} onCambio={cambiarJurisdiccion} />

          {jurisdiccion === "fda" && <AvisoFda version={versionFda} />}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="pregunta-normativa"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  jurisdiccion === "fda"
                    ? "Ej: What are the responsibilities of the quality control unit?"
                    : "Ej: ¿cuál es la validez de una receta retenida?"
                }
                aria-label="Tu pregunta sobre normativa"
                maxLength={500}
                className="min-w-0 flex-1 border border-line bg-transparent px-3 py-2.5 text-base outline-none focus:border-accent sm:py-2 sm:text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 boton-neon px-5 py-2.5 text-sm font-medium disabled:opacity-50 sm:py-2"
              >
                {loading ? "Buscando…" : "Preguntar"}
              </button>
            </div>
            {jurisdiccion === "cl" && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none hover:text-foreground">Filtros</summary>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-1.5 py-1">
                  <input
                    id="filtro-vigente"
                    type="checkbox"
                    checked={vigente}
                    onChange={(e) => setVigente(e.target.checked)}
                    className="h-4 w-4"
                  />
                  solo normas con vigencia verificada
                </label>
                <select
                  id="filtro-categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  aria-label="Filtrar por materia"
                  className="w-full border border-line bg-background px-2 py-1.5 text-base sm:w-auto sm:text-xs"
                >
                  <option value="">todas las materias</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {etiquetaCategoria(c)}
                    </option>
                  ))}
                </select>
              </div>
            </details>
            )}
          </form>

          {!respuesta && !loading && !aviso && (
            <div className="flex flex-col gap-3">
              <span className="label-micro text-muted">Prueba con</span>
              <div className="flex flex-wrap gap-2">
                {ejemplos.map((ej) => (
                  <button
                    key={ej}
                    type="button"
                    onClick={() => {
                      setQ(ej);
                      runSearch(ej);
                    }}
                    className="border border-line px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
                  >
                    {ej}
                  </button>
                ))}
              </div>
            </div>
          )}

          {aviso && (
            <p role="alert" className="border-l-2 border-amber-500/60 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              {aviso}
            </p>
          )}

          {respuesta && estilo && !loading && (
            <section aria-live="polite" className="flex flex-col gap-5">
              <div className={`flex flex-col gap-1 border-l-2 ${estilo.borde} py-1 pl-4`}>
                <span className={`flex items-center gap-2 text-sm font-medium ${estilo.texto}`}>
                  <span aria-hidden className={`h-2 w-2 rounded-full ${estilo.punto}`} />
                  {respuesta.titular}
                </span>
                <span className="text-sm leading-relaxed text-muted">{respuesta.motivo}</span>
              </div>

              <Avisos avisos={respuesta.avisos} />

              {/* El borrador se pide solo en cada búsqueda (desde el 07-10-2026 no
                  hay interruptor «Modo IA») y va antes del pasaje: en las pruebas
                  en vivo acertó donde la tarjeta de la norma no.
                  `key={consultaId}`: cada búsqueda trae un id nuevo y el widget
                  nace en su estado inicial. */}
              {respuesta.iaDisponible && respuesta.consultaId && respuesta.estado !== "ausente" && (
                <RespuestaIa key={respuesta.consultaId} consultaId={respuesta.consultaId} />
              )}

              {respuesta.principal && <TarjetaPrincipal r={respuesta.principal} />}

              {visibles.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h2 className="label-micro text-muted">Otras normas relacionadas</h2>
                  {visibles.map((r, i) => (
                    <TarjetaRelacionada key={`${r.cita}-${i}`} r={r} />
                  ))}
                </div>
              )}

              {plegadas.length > 0 &&
                (respuesta.estado === "ausente" ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer select-none text-xs text-muted hover:text-foreground">
                      Ver los textos más cercanos que encontramos ({plegadas.length}). No responden la pregunta.
                    </summary>
                    <div className="mt-4 flex flex-col gap-4">
                      {plegadas.map((r, i) => (
                        <TarjetaRelacionada key={`${r.cita}-${i}`} r={r} />
                      ))}
                    </div>
                  </details>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVerTodas(true)}
                    className="self-start text-xs text-muted underline underline-offset-4 hover:text-foreground"
                  >
                    Ver {plegadas.length} {plegadas.length === 1 ? "norma relacionada más" : "normas relacionadas más"}
                  </button>
                ))}

              <p className="text-xs leading-relaxed text-muted">
                Es apoyo a la consulta, no asesoría regulatoria ni legal. Antes de decidir, confirma en la fuente
                oficial y revisa si hay modificaciones posteriores.
              </p>

              {respuesta.consultaId && (
                <FeedbackConsulta key={`fb-${respuesta.consultaId}`} consultaId={respuesta.consultaId} />
              )}

              {/* Puente del buscador a la asesoría. Es el modelo que usan las
                  consultoras grandes con sus recursos gratuitos: la herramienta
                  resuelve algo real y, en ese mismo momento, ofrece hacerse
                  cargo del trámite. Va al final para no estorbar la lectura de
                  la norma, que es a lo que la persona vino. */}
              <div className="mt-2 flex flex-col gap-4 border border-accent/25 bg-accent/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm leading-snug font-medium">
                    ¿Tienes que cumplir con esto y no sabes por dónde partir?
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    Revisamos tu caso en 30 minutos, sin costo.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Link
                    href="/agenda"
                    className="boton-neon px-6 py-3 text-center text-sm font-medium"
                  >
                    Agenda una evaluación
                  </Link>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 py-1 text-center text-xs text-muted transition-colors hover:text-foreground"
                  >
                    O escríbenos por WhatsApp
                  </a>
                </div>
              </div>
            </section>
          )}
        </main>

        <aside className="order-3 lg:w-60 lg:shrink-0">
          <NormasRecientesPanel normas={normasRecientes} />
        </aside>
      </div>
    </div>
  );
}
