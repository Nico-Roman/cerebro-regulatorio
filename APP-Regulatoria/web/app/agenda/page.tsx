import type { Metadata } from "next";
import { AgendaReserva } from "@/components/agenda-reserva";
import { OG_IMAGEN, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agendar una reunión",
  description:
    "Reserva 30 minutos para revisar un tema regulatorio concreto: registro sanitario, GMP/GDP, importación o farmacovigilancia.",
  // Sin esto hereda el canonical y el og:url de la home, y al compartir el
  // enlace de la agenda LinkedIn y WhatsApp muestran la portada.
  alternates: { canonical: "/agenda" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "/agenda",
    siteName: SITE.nombre,
    title: `Agenda una evaluación · ${SITE.nombre}`,
    description: "30 minutos para revisar tu caso regulatorio, por Google Meet.",
    images: [OG_IMAGEN],
  },
};

export const dynamic = "force-dynamic";

export default function AgendaPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-16 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="label-micro text-muted">Agenda</span>
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Reserva 30 minutos
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Los horarios que ves son huecos reales de mi calendario: si aparece, está libre. La
          reunión es por Google Meet y el enlace llega al confirmar.
        </p>
      </header>

      <AgendaReserva />
    </main>
  );
}
