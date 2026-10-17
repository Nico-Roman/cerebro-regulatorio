"use client";

// Flujo «¿Qué trámite necesito?»: cinco preguntas cerradas, la ruta de la tabla
// y la explicación con citas.

import Link from "next/link";
import { useState } from "react";

interface Pregunta {
  clave: string;
  texto: string;
  opciones: Record<string, string>;
}

interface Resultado {
  ruta: {
    id: string;
    tramites: string[];
    autoridad: string;
    normas: { norma: string; cita: string }[];
    nota: string | null;
  };
  enRevision: boolean;
  explicacion: string | null;
  fuentes: { n: number; cita: string; norma: string; fuenteUrl: string }[];
  aviso?: string;
  restantesHoy: number | null;
}

export function FlujoTramite({ preguntas }: { preguntas: Pregunta[] }) {
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const completas = preguntas.every((p) => respuestas[p.clave]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setAviso(null);
    setResultado(null);
    try {
      const res = await fetch("/api/asistente/tramite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAviso(datos.mensaje || "No pudimos calcular la ruta. Intenta de nuevo.");
        return;
      }
      setResultado(datos as Resultado);
    } catch {
      setAviso("No pudimos calcular la ruta. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={enviar} className="flex flex-col gap-5">
        {preguntas.map((p) => (
          <fieldset key={p.clave} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{p.texto}</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(p.opciones).map(([valor, etiqueta]) => (
                <label
                  key={valor}
                  className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                    respuestas[p.clave] === valor ? "border-accent text-accent" : "border-line text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={p.clave}
                    value={valor}
                    checked={respuestas[p.clave] === valor}
                    onChange={() => setRespuestas({ ...respuestas, [p.clave]: valor })}
                    className="sr-only"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          type="submit"
          disabled={!completas || cargando}
          className="self-start boton-neon px-5 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          {cargando ? "Calculando…" : "Ver mi ruta"}
        </button>
      </form>

      {aviso && (
        <p role="alert" className="border-l-2 border-amber-500/60 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {aviso}
        </p>
      )}

      {resultado && (
        <section aria-live="polite" className="flex flex-col gap-5">
          {resultado.enRevision && (
            <p className="border-l-2 border-amber-500/70 pl-3 text-sm text-amber-200">Ruta en revisión profesional.</p>
          )}
          <div className="flex flex-col gap-2 border border-line p-5">
            <span className="label-micro text-muted">Autoridad: {resultado.ruta.autoridad}</span>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
              {resultado.ruta.tramites.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            {resultado.ruta.nota && <p className="text-xs text-muted">{resultado.ruta.nota}</p>}
          </div>
          {resultado.explicacion && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{resultado.explicacion}</div>
          )}
          {resultado.aviso && <p className="text-xs text-muted">{resultado.aviso}</p>}
          {resultado.fuentes.length > 0 && (
            <ul className="flex flex-col gap-1">
              {resultado.fuentes.map((f) => (
                <li key={f.n} className="text-xs text-muted">
                  {f.fuenteUrl ? (
                    <a href={f.fuenteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      {f.cita} ↗
                    </a>
                  ) : (
                    f.cita
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">¿Quieres que lo revisemos contigo?</p>
            <Link href="/agenda" className="boton-neon px-5 py-2.5 text-center text-sm font-medium">
              Agenda una evaluación
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
