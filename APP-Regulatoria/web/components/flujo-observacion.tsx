"use client";

// Flujo «Responder una observación del ISP»: el formulario y las cuatro partes
// de la respuesta. El borrador siempre lleva la etiqueta fija de revisión.

import Link from "next/link";
import { useState } from "react";

const MAX = 8000;

interface Fuente {
  n: number;
  cita: string;
  norma: string;
  fuenteUrl: string;
}

interface Resultado {
  etiqueta: string;
  secciones: Record<string, string>;
  fuentes: Fuente[];
  cifrasSinRespaldo: string[];
  normasSinRespaldo: string[];
  afirmacionesSinCita: string[];
  restantesHoy: number | null;
}

/** Destaca los [COMPLETAR: …] para que no se presenten por descuido. */
function ConHuecos({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\[COMPLETAR:[^\]]*\])/gi).map((t, i) =>
        /^\[COMPLETAR:/i.test(t) ? (
          <mark key={i} className="bg-amber-400/20 px-0.5 text-amber-200">
            {t}
          </mark>
        ) : (
          t
        )
      )}
    </>
  );
}

export function FlujoObservacion({ productos }: { productos: string[] }) {
  const [texto, setTexto] = useState("");
  const [producto, setProducto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [limite, setLimite] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setAviso(null);
    setLimite(false);
    setResultado(null);
    try {
      const res = await fetch("/api/asistente/observacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, producto }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLimite(res.status === 429 && datos.error === "limite_diario");
        setAviso(datos.mensaje || "No pudimos procesar la observación. Intenta de nuevo en un momento.");
        return;
      }
      setResultado(datos as Resultado);
    } catch {
      setAviso("No pudimos procesar la observación. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">Tipo de producto</span>
          <select
            required
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            className="border border-line bg-background px-3 py-2.5 text-base outline-none focus:border-accent sm:text-sm"
          >
            <option value="" disabled>
              Elige uno
            </option>
            {productos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">La observación del ISP</span>
          <textarea
            required
            rows={10}
            maxLength={MAX}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pega aquí el texto de la observación, sin datos de pacientes."
            className="resize-y border border-line bg-transparent px-3 py-3 text-base outline-none focus:border-accent sm:text-sm"
          />
          <span className="text-right text-xs text-muted">
            {texto.length.toLocaleString("es-CL")} / {MAX.toLocaleString("es-CL")}
          </span>
        </label>
        <button
          type="submit"
          disabled={cargando || !texto.trim() || !producto}
          className="self-start boton-neon px-5 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          {cargando ? "Analizando…" : "Analizar observación"}
        </button>
      </form>

      {aviso && (
        <div role="alert" className="flex flex-col gap-3 border-l-2 border-amber-500/60 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-200">{aviso}</p>
          {limite && (
            <Link href="/agenda" className="self-start text-sm font-medium underline underline-offset-4">
              ¿Es urgente? Agenda una evaluación
            </Link>
          )}
        </div>
      )}

      {resultado && (
        <section aria-live="polite" className="flex flex-col gap-6">
          <p className="border border-amber-700/70 bg-amber-950/20 px-4 py-3 text-sm font-medium text-amber-200">
            {resultado.etiqueta}
          </p>
          {(resultado.cifrasSinRespaldo.length > 0 || resultado.normasSinRespaldo.length > 0) && (
            <p className="border-l-2 border-red-500/70 pl-3 text-xs leading-relaxed text-red-200">
              Menciona cifras o normas que no están en los pasajes ni en tu observación (
              {[...resultado.cifrasSinRespaldo, ...resultado.normasSinRespaldo].join(", ")}). Verifícalas antes de usarlas.
            </p>
          )}
          {Object.entries(resultado.secciones).map(([titulo, cuerpo]) => (
            <article key={titulo} className="flex flex-col gap-2">
              <h2 className="label-micro text-muted">{titulo}</h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                {cuerpo ? <ConHuecos texto={cuerpo} /> : <span className="text-muted">—</span>}
              </div>
              {titulo === "Qué exige la norma" && resultado.afirmacionesSinCita.length > 0 && (
                <p className="text-xs text-red-200">
                  Afirmación sin cita: {resultado.afirmacionesSinCita.map((o) => `«${o}»`).join(" ")}
                </p>
              )}
            </article>
          ))}
          {resultado.fuentes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label-micro text-muted">Pasajes citados</span>
              <ul className="flex flex-col gap-1">
                {resultado.fuentes.map((f) => (
                  <li key={f.n} className="text-xs text-muted">
                    {f.fuenteUrl ? (
                      <a href={f.fuenteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {f.cita} ↗
                      </a>
                    ) : (
                      f.cita
                    )}{" "}
                    <span className="text-neutral-500">— {f.norma}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-3 border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">¿Quieres que lo revisemos antes de presentarlo?</p>
            <Link href="/agenda" className="boton-neon px-5 py-2.5 text-center text-sm font-medium">
              Agenda una evaluación
            </Link>
          </div>
          {resultado.restantesHoy !== null && (
            <p className="text-xs text-muted">Te quedan {resultado.restantesHoy} preguntas hoy.</p>
          )}
        </section>
      )}
    </div>
  );
}
