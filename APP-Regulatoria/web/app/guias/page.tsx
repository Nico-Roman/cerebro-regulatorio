import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/site";
import { guiasPublicadas } from "@/lib/guias";

export const metadata: Metadata = {
  title: "Guías de trámites ante el ISP",
  description:
    "Cómo se hace cada trámite sanitario en Chile, explicado completo: clave GICONA, registro de cosméticos, dispositivos médicos y renovación de registros.",
  alternates: { canonical: "/guias" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: `${SITE.url}/guias`,
    siteName: SITE.nombre,
    title: `Guías de trámites ante el ISP · ${SITE.nombre}`,
    description: "Cada trámite sanitario chileno explicado paso a paso, con la fuente oficial a la vista.",
  },
};

export default function Guias() {
  const guias = guiasPublicadas();

  // Mientras no haya ninguna guía escrita, la sección no existe: es preferible
  // un 404 a un índice vacío que le dice al visitante que el sitio está a medio
  // hacer. Los enlaces del menú y del footer también desaparecen solos.
  if (guias.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <span className="label-micro text-muted">Guías de trámites</span>

      <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.1] font-medium tracking-tight sm:text-5xl">
        Cómo se hace cada trámite, explicado completo.
      </h1>

      <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
        Lo mismo que te explicaríamos en una reunión, escrito y con el enlace a la
        fuente oficial. Si después de leer la guía prefieres que lo hagamos nosotros,
        al final de cada una está cómo.
      </p>

      <div className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-2">
        {guias.map((g) => (
          <article key={g.slug} className="bg-background transition-colors hover:bg-surface">
            <Link href={`/guias/${g.slug}`} className="flex h-full flex-col gap-4 p-7">
              <h2 className="font-display text-lg leading-snug font-medium tracking-tight sm:text-xl">
                {g.titulo}
              </h2>
              <p className="text-sm leading-relaxed text-muted">{g.resumen}</p>
              <span className="label-micro mt-auto pt-3 text-muted">Leer la guía</span>
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
