import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { jsonParaScript } from "@/lib/html";
import { SITE, WHATSAPP_URL } from "@/lib/site";
import { guiaPorSlug, guiasPublicadas } from "@/lib/guias";

// Solo se generan las guías publicadas. Una guía con `publicada: false` no
// tiene ruta, así que su URL responde 404 aunque alguien la adivine.
export function generateStaticParams() {
  return guiasPublicadas().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/guias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guia = guiaPorSlug(slug);
  if (!guia) return {};

  return {
    title: guia.titulo,
    description: guia.resumen,
    alternates: { canonical: `/guias/${guia.slug}` },
    openGraph: {
      type: "article",
      locale: "es_CL",
      url: `${SITE.url}/guias/${guia.slug}`,
      siteName: SITE.nombre,
      title: `${guia.titulo} · ${SITE.nombre}`,
      description: guia.resumen,
      publishedTime: guia.actualizada,
    },
  };
}

export default async function GuiaTramite({ params }: PageProps<"/guias/[slug]">) {
  const { slug } = await params;
  const guia = guiaPorSlug(slug);
  if (!guia) notFound();

  const articuloJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guia.titulo,
    description: guia.resumen,
    dateModified: guia.actualizada,
    inLanguage: "es-CL",
    author: { "@type": "Organization", name: SITE.nombre, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.nombre, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/guias/${guia.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonParaScript(articuloJsonLd) }}
      />

      <article className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <Link href="/guias" className="label-micro text-muted hover:text-foreground">
            ← Guías de trámites
          </Link>

          <h1 className="font-display mt-6 text-[2rem] leading-[1.1] font-medium tracking-tight sm:text-5xl">
            {guia.titulo}
          </h1>

          <p className="mt-7 text-base leading-relaxed text-muted sm:text-lg">{guia.resumen}</p>

          <p className="label-micro mt-7 text-muted">
            Revisada el{" "}
            {new Date(`${guia.actualizada}T12:00:00`).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          <div className="mt-14 flex flex-col gap-12">
            {guia.secciones.map((s) => (
              <section key={s.h}>
                <h2 className="font-display text-xl leading-snug font-medium tracking-tight sm:text-2xl">
                  {s.h}
                </h2>
                <div className="mt-5 flex flex-col gap-4">
                  {s.p.map((parrafo) => (
                    <p key={parrafo.slice(0, 40)} className="leading-relaxed text-muted">
                      {parrafo}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {guia.fuenteOficial && (
            <div className="mt-14 border-l border-line pl-6">
              <span className="label-micro text-muted">Fuente oficial</span>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Antes de decidir, confirma en la fuente y revisa si hay modificaciones
                posteriores:{" "}
                <a
                  href={guia.fuenteOficial.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  {guia.fuenteOficial.etiqueta}
                </a>
                .
              </p>
            </div>
          )}

          {/* Cierre comercial de la guía: quien llegó hasta acá leyó el trámite
              completo y ya sabe si lo quiere hacer solo o no. */}
          <div className="mt-14 border border-line p-8">
            <h2 className="font-display text-xl leading-snug font-medium tracking-tight">
              ¿Prefieres que lo hagamos nosotros?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Revisamos tu caso en 30 minutos y te decimos qué trámite corresponde, qué
              antecedentes necesitas y en qué orden conviene hacerlo. La primera
              evaluación no tiene costo.
            </p>
            <Link
              href="/agenda"
              className="mt-7 block bg-foreground px-7 py-4 text-center text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Agenda una evaluación
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block px-7 py-2 text-center text-sm text-muted transition-colors hover:text-foreground"
            >
              O escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
