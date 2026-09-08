"use client";

// Elegir día, elegir hora, dejar los datos. Tres pasos visibles a la vez para
// que se entienda de un vistazo cuánto falta.

import { useEffect, useMemo, useState } from "react";

interface Slot {
  inicio: string;
  fin: string;
}

interface Dia {
  fecha: string;
  slots: Slot[];
}

interface Disponibilidad {
  disponible: boolean;
  motivo?: string;
  zona?: string;
  duracionMin?: number;
  dias: Dia[];
}

function etiquetaDia(fechaIso: string, zona: string) {
  // Mediodía UTC para que el día no se corra al formatear en zona chilena.
  const d = new Date(`${fechaIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: zona,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function hora(iso: string, zona: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function AgendaReserva() {
  const [datos, setDatos] = useState<Disponibilidad | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [slotElegido, setSlotElegido] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", empresa: "", motivo: "", web: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmada, setConfirmada] = useState<{ cuando: string; meetUrl: string | null } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/agenda/huecos")
      .then((r) => r.json())
      .then((d: Disponibilidad) => {
        setDatos(d);
        if (d.dias?.length) setDiaElegido(d.dias[0].fecha);
      })
      .catch(() => setDatos({ disponible: false, motivo: "error_calendario", dias: [] }));
  }, []);

  const zona = datos?.zona || "America/Santiago";
  const slots = useMemo(
    () => datos?.dias.find((d) => d.fecha === diaElegido)?.slots ?? [],
    [datos, diaElegido]
  );

  async function reservar(e: React.FormEvent) {
    e.preventDefault();
    if (!slotElegido) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/agenda/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inicio: slotElegido }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          cuerpo.error === "hueco_tomado"
            ? "Ese horario se acaba de ocupar. Elige otro, la lista ya se actualizó."
            : cuerpo.error === "demasiadas_reservas"
              ? "Demasiadas reservas desde esta conexión. Intenta más tarde."
              : "No pudimos confirmar la hora. Intenta de nuevo en un momento."
        );
        if (cuerpo.error === "hueco_tomado") {
          const frescos = await fetch("/api/agenda/huecos").then((r) => r.json());
          setDatos(frescos);
          setSlotElegido(null);
        }
        return;
      }
      setConfirmada({ cuando: cuerpo.cuando, meetUrl: cuerpo.meetUrl ?? null });
    } catch {
      setError("No pudimos confirmar la hora. Intenta de nuevo en un momento.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmada) {
    return (
      <div className="flex flex-col gap-3 border border-emerald-800 bg-emerald-950/20 p-5">
        <h2 className="font-display text-xl">Reunión confirmada</h2>
        <p className="text-sm text-muted">{confirmada.cuando}</p>
        {confirmada.meetUrl && (
          <p className="text-sm">
            Videollamada:{" "}
            <a href={confirmada.meetUrl} className="underline" target="_blank" rel="noreferrer">
              {confirmada.meetUrl}
            </a>
          </p>
        )}
        <p className="text-xs text-muted">
          Te llegó un correo con el enlace y un archivo .ics para tu calendario. Ahí mismo está el
          enlace para cancelar si te cambia el día.
        </p>
      </div>
    );
  }

  if (!datos) return <p className="text-sm text-muted">Buscando horarios disponibles…</p>;

  if (!datos.disponible || !datos.dias.length) {
    return (
      <div className="border border-line p-5 text-sm text-muted">
        <p>
          Por ahora no hay horas publicadas. Escríbeme a{" "}
          <a href="/#contacto" className="underline">
            el formulario de contacto
          </a>{" "}
          y coordinamos por correo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-muted">1 · Elige el día</h2>
        <div className="flex flex-wrap gap-2">
          {datos.dias.map((d) => (
            <button
              key={d.fecha}
              type="button"
              onClick={() => {
                setDiaElegido(d.fecha);
                setSlotElegido(null);
              }}
              className={`border px-3 py-2 text-xs transition-colors ${
                diaElegido === d.fecha
                  ? "border-foreground text-foreground"
                  : "border-line text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {etiquetaDia(d.fecha, zona)}
              <span className="ml-2 text-muted">({d.slots.length})</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-muted">2 · Elige la hora</h2>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s.inicio}
              type="button"
              onClick={() => setSlotElegido(s.inicio)}
              className={`border px-4 py-2 text-sm transition-colors ${
                slotElegido === s.inicio
                  ? "border-foreground text-foreground"
                  : "border-line text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {hora(s.inicio, zona)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Horario de Chile · {datos.duracionMin ?? 30} minutos.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-muted">3 · Tus datos</h2>
        <form onSubmit={reservar} className="flex max-w-lg flex-col gap-3">
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre y apellido"
            className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Correo"
            className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
          />
          <input
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            placeholder="Empresa (opcional)"
            className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
          />
          <textarea
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            rows={3}
            placeholder="¿Qué necesitas resolver? (opcional, pero ayuda a llegar preparado)"
            className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
          />
          {/* Trampa para bots: invisible para una persona. */}
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.web}
            onChange={(e) => setForm({ ...form, web: e.target.value })}
            className="hidden"
            aria-hidden="true"
          />
          {error && (
            <p role="alert" className="text-sm text-amber-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!slotElegido || enviando}
            className="self-start bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40"
          >
            {enviando ? "Confirmando…" : "Confirmar hora"}
          </button>
          {!slotElegido && (
            <p className="text-xs text-muted">Elige un horario arriba para poder confirmar.</p>
          )}
        </form>
      </section>
    </div>
  );
}
