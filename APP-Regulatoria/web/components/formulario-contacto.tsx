"use client";

import { useState } from "react";
import { SITE, WHATSAPP_URL } from "@/lib/site";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "enviando" }
  | { tipo: "ok" }
  | { tipo: "error"; mensaje: string };

const AREAS_CONSULTA = [
  "Registro de producto farmacéutico",
  "Inscripción de cosméticos",
  "Registro de dispositivos médicos",
  "Farmacovigilancia / Tecnovigilancia",
  "Buenas prácticas y auditorías",
  "Otro",
];

export function FormularioContacto() {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form));
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setEstado({ tipo: "ok" });
        form.reset();
      } else {
        setEstado({
          tipo: "error",
          mensaje: json.mensaje || "No se pudo enviar el mensaje.",
        });
      }
    } catch {
      setEstado({
        tipo: "error",
        mensaje: "No se pudo enviar el mensaje. Revisa tu conexión.",
      });
    }
  }

  if (estado.tipo === "ok") {
    return (
      <div className="border border-line bg-surface p-6">
        <p className="font-display text-lg">Mensaje recibido.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Te respondemos a tu correo dentro de las próximas 24 horas hábiles. Si necesitas
          una respuesta más rápida, escríbenos por WhatsApp.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="label-micro mt-5 inline-block border border-line px-4 py-2.5 transition-colors hover:border-foreground"
        >
          Abrir WhatsApp
        </a>
      </div>
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">Nombre</span>
          <input
            name="nombre"
            required
            maxLength={120}
            className="border border-line bg-transparent px-3 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">Empresa</span>
          <input
            name="empresa"
            maxLength={120}
            className="border border-line bg-transparent px-3 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">Correo</span>
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            className="border border-line bg-transparent px-3 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-micro text-muted">Tema</span>
          <select
            name="area"
            defaultValue={AREAS_CONSULTA[0]}
            className="border border-line bg-background px-3 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
          >
            {AREAS_CONSULTA.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="label-micro text-muted">Cuéntanos tu caso</span>
        <textarea
          name="mensaje"
          required
          rows={5}
          maxLength={4000}
          placeholder="Qué producto es, en qué etapa estás y qué necesitas resolver."
          className="resize-y border border-line bg-transparent px-3 py-3 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-foreground sm:text-sm"
        />
      </label>

      {/* Trampa para bots: invisible para personas, irresistible para spam. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {estado.tipo === "error" && (
        <div className="border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-300">
          {estado.mensaje} Puedes escribirnos directo a{" "}
          <a href={`mailto:${SITE.email}`} className="underline">
            {SITE.email}
          </a>{" "}
          o por{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="underline">
            WhatsApp
          </a>
          .
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar consulta"}
        </button>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="border border-line px-6 py-3 text-sm transition-colors hover:border-foreground"
        >
          O escríbenos por WhatsApp
        </a>
      </div>
    </form>
  );
}
