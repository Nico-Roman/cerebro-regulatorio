// Planes de la capa de IA. Los números salen de lib/planes.ts: esta página no
// escribe ningún precio ni cupo a mano, así que no puede quedar desalineada con
// lo que de verdad se cobra.
//
// Sin pasarela de pago todavía: "Contratar" abre WhatsApp con el plan escrito,
// y el plan se activa desde el panel (/admin/planes). Cuando haya pasarela,
// solo cambia el destino del botón.

import type { Metadata } from "next";
import Link from "next/link";
import { PACKS, PLANES, formatoClp, formatoMiles, type Pack, type Plan } from "@/lib/planes";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Planes — respuestas con IA",
  description:
    "El buscador de normativa es gratis. Las respuestas redactadas con IA vienen en tres planes: Gratis, Profesional y Director Técnico, más packs de créditos que no vencen.",
  alternates: { canonical: "/planes" },
};

function whatsappPara(texto: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(texto)}`;
}

function TarjetaPlan({ plan, destacado }: { plan: Plan; destacado?: boolean }) {
  const gratis = plan.precioMensualClp === 0;
  return (
    <div
      className={`flex flex-col gap-5 border px-6 py-7 ${
        destacado ? "border-foreground" : "border-line"
      }`}
    >
      <div>
        <span className="label-micro text-muted">{destacado ? "Recomendado" : " "}</span>
        <h2 className="font-display mt-2 text-2xl tracking-tight">{plan.nombre}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.resumen}</p>
      </div>

      <div>
        <span className="font-display text-4xl">{gratis ? "$0" : formatoClp(plan.precioMensualClp)}</span>
        {!gratis && <span className="text-sm text-muted"> /mes · IVA incluido</span>}
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <strong className="font-medium">{formatoMiles(plan.creditosMes)}</strong> respuestas con IA al mes
        </li>
        <li>Hasta {formatoMiles(plan.limiteDiario)} por día</li>
        <li>{plan.maxMiembros > 1 ? `Hasta ${plan.maxMiembros} personas del equipo` : "Una persona"}</li>
        <li>Buscador de normativa sin límite</li>
      </ul>

      <div className="mt-auto">
        {gratis ? (
          <Link
            href="/normativa"
            className="block border border-line px-6 py-3 text-center text-sm transition-colors hover:border-foreground"
          >
            Entrar al buscador
          </Link>
        ) : (
          <a
            href={whatsappPara(
              `Hola RegulaMED, quiero contratar el plan ${plan.nombre} (${formatoClp(plan.precioMensualClp)}/mes).`
            )}
            target="_blank"
            rel="noreferrer"
            className={`block px-6 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
              destacado ? "bg-foreground text-background" : "border border-foreground"
            }`}
          >
            Contratar {plan.nombre}
          </a>
        )}
      </div>
    </div>
  );
}

function FilaPack({ pack }: { pack: Pack }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4">
      <div>
        <span className="font-medium">{formatoMiles(pack.creditos)} respuestas</span>
        <span className="ml-2 text-sm text-muted">
          {formatoClp(pack.precioClp)} · {formatoClp(pack.precioClp / pack.creditos)} c/u
        </span>
      </div>
      <a
        href={whatsappPara(`Hola RegulaMED, quiero comprar el ${pack.nombre} (${formatoClp(pack.precioClp)}).`)}
        target="_blank"
        rel="noreferrer"
        className="border border-line px-4 py-2 text-xs transition-colors hover:border-foreground"
      >
        Comprar
      </a>
    </li>
  );
}

export default function PlanesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <span className="label-micro text-muted">Planes</span>
      <h1 className="font-display mt-4 max-w-3xl text-4xl leading-tight tracking-tight sm:text-5xl">
        El buscador es gratis. La IA, según cuánto la uses.
      </h1>
      <p className="mt-6 max-w-2xl text-muted">
        Buscar en la normativa y leer la frase exacta de la norma no tiene costo. La respuesta redactada con IA
        (que resume los pasajes y cita de dónde sale cada dato) se cuenta por consulta.
      </p>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        <TarjetaPlan plan={PLANES.gratis} />
        <TarjetaPlan plan={PLANES.profesional} destacado />
        <TarjetaPlan plan={PLANES.director_tecnico} />
      </section>

      <section className="mt-16 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight">Packs que no vencen</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Para cuando tu plan se acaba antes de fin de mes, o si prefieres pagar solo lo que usas. Se gastan después
          de las respuestas de tu plan y quedan en tu cuenta hasta que las ocupes.
        </p>
        <ul className="mt-6 border-b border-line">
          {Object.values(PACKS).map((p) => (
            <FilaPack key={p.id} pack={p} />
          ))}
        </ul>
      </section>

      <section className="mt-16 max-w-2xl text-sm leading-relaxed text-muted">
        <h2 className="font-display text-xl tracking-tight text-foreground">Cómo se cuenta</h2>
        <ul className="mt-4 flex flex-col gap-2">
          <li>Cada respuesta con IA descuenta una. Las consultas muy largas pueden descontar dos.</li>
          <li>Si la respuesta ya existía porque alguien hizo la misma pregunta, no descuenta nada.</li>
          <li>Si la IA falla y no te entrega respuesta, no se descuenta.</li>
          <li>Las respuestas del plan se renuevan cada mes y no se acumulan. Las de los packs no vencen.</li>
        </ul>
      </section>
    </main>
  );
}
