"use client";

// El único lugar donde se ofrecen planes a alguien que ya tiene cuenta, y solo
// en dos momentos:
//
//   "bienvenida"  una vez en la vida, al terminar el registro.
//   "limite"      cuando llega al tope de su plan (del mes o del día).
//
// Fuera de eso no se vende: ni banners, ni enlaces "ver planes" en el buscador,
// ni recordatorios. Es una decisión de Nico (22-09-2026): el buscador es gratis
// y tiene que sentirse así.
//
// Sin pasarela de pago todavía: cada opción abre WhatsApp con el plan o el
// pack escrito, y el plan se activa desde /admin/clientes.

import { useEffect, useId, useRef } from "react";
import { PACKS, PLANES, RANGO_PLAN, esIdPlan, formatoClp, formatoMiles, type IdPlan } from "@/lib/planes";
import { SITE } from "@/lib/site";

export type MotivoModal = "bienvenida" | "sin_creditos" | "limite_diario";

function whatsapp(texto: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(texto)}`;
}

const TEXTOS: Record<MotivoModal, { titulo: string; bajada: (plan: string) => string }> = {
  bienvenida: {
    titulo: "Tu cuenta está lista",
    bajada: () =>
      `El buscador de normativa es gratis y sin límite. Además tienes ${PLANES.gratis.creditosMes} respuestas con IA al mes, gratis. Si con el tiempo necesitas más, estas son las opciones. No te lo vamos a volver a mostrar.`,
  },
  sin_creditos: {
    titulo: "Usaste las respuestas con IA de este mes",
    bajada: (plan) =>
      `Tu plan ${plan} se renueva el próximo ciclo. El buscador y los pasajes siguen disponibles sin límite. Si necesitas más respuestas antes:`,
  },
  limite_diario: {
    titulo: "Llegaste al tope de respuestas con IA de hoy",
    bajada: (plan) =>
      `Tu plan ${plan} se renueva mañana. El buscador y los pasajes siguen disponibles. Si no quieres esperar, los créditos adicionales se pueden usar hoy mismo:`,
  },
};

export function ModalPlanes({
  motivo,
  planActual,
  onCerrar,
}: {
  motivo: MotivoModal;
  planActual: string;
  onCerrar: () => void;
}) {
  const idTitulo = useId();
  const cerrar = useRef<HTMLButtonElement>(null);
  const plan = PLANES[esIdPlan(planActual) ? planActual : "gratis"];
  const superiores = (Object.keys(PLANES) as IdPlan[])
    .filter((id) => RANGO_PLAN[id] > RANGO_PLAN[plan.id])
    .map((id) => PLANES[id]);
  const texto = TEXTOS[motivo];
  // En el tope del día, lo que resuelve hoy es un pack: va primero.
  const packsPrimero = motivo === "limite_diario";

  useEffect(() => {
    cerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [onCerrar]);

  const bloquePlanes = superiores.length > 0 && (
    <div className="flex flex-col gap-3">
      <span className="label-micro text-muted">{motivo === "bienvenida" ? "Planes" : "Cambiar de plan"}</span>
      <div className={`grid gap-3 ${superiores.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {superiores.map((p) => (
          <a
            key={p.id}
            href={whatsapp(`Hola RegulaMED, quiero el plan ${p.nombre} (${formatoClp(p.precioMensualClp)}/mes).`)}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-1 border border-line px-4 py-3 transition-colors hover:border-foreground"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{p.nombre}</span>
              <span className="text-sm">
                {formatoClp(p.precioMensualClp)}
                <span className="text-xs text-muted"> /mes</span>
              </span>
            </span>
            <span className="text-xs text-muted">
              {formatoMiles(p.creditosMes)} respuestas al mes · hasta {formatoMiles(p.limiteDiario)} por día
              {p.maxMiembros > 1 ? ` · hasta ${p.maxMiembros} personas` : ""}
            </span>
          </a>
        ))}
      </div>
    </div>
  );

  const bloquePacks = motivo !== "bienvenida" && (
    <div className="flex flex-col gap-3">
      <span className="label-micro text-muted">Créditos adicionales · no vencen</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(PACKS).map((p) => (
          <a
            key={p.id}
            href={whatsapp(`Hola RegulaMED, quiero comprar el ${p.nombre} (${formatoClp(p.precioClp)}).`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-baseline justify-between gap-2 border border-line px-4 py-3 transition-colors hover:border-foreground"
          >
            <span className="font-medium">{formatoMiles(p.creditos)} respuestas</span>
            <span className="text-sm">{formatoClp(p.precioClp)}</span>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-6 overflow-y-auto border border-line bg-background p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={idTitulo} className="font-display text-2xl leading-tight tracking-tight">
            {texto.titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 text-2xl leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted">{texto.bajada(plan.nombre)}</p>

        {packsPrimero ? (
          <>
            {bloquePacks}
            {bloquePlanes}
          </>
        ) : (
          <>
            {bloquePlanes}
            {bloquePacks}
          </>
        )}

        {motivo !== "bienvenida" && superiores.length === 0 && (
          <p className="text-xs text-muted">
            Ya estás en el plan más alto. Si tu equipo necesita un cupo mayor, escríbenos y lo conversamos.
          </p>
        )}

        <button
          ref={cerrar}
          type="button"
          onClick={onCerrar}
          className="self-stretch bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:self-end"
        >
          {motivo === "bienvenida" ? "Seguir con el plan gratis" : "Ahora no"}
        </button>
      </div>
    </div>
  );
}
