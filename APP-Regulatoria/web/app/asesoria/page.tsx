import type { Metadata } from "next";
import Link from "next/link";
import { jsonParaScript } from "@/lib/html";
import { OG_IMAGEN, SERVICIOS, SITE, WHATSAPP_URL } from "@/lib/site";
import { LIMITES, PROCESO, TRAYECTORIA } from "@/lib/asesoria";
import { VSL, miniaturaUrl, vslConfigurado } from "@/lib/vsl";
import { FormularioContacto } from "@/components/formulario-contacto";
import { VideoVsl } from "@/components/video-vsl";
import { BloquePerfil, Cifras, Testimonios } from "@/components/prueba-social";

export const metadata: Metadata = {
  title: "Asesoría regulatoria — cómo trabajo contigo",
  description:
    "Asesoría en asuntos regulatorios para productos farmacéuticos, cosméticos y dispositivos médicos ante el ISP/ANAMED. Mira la presentación, revisa el proceso y agenda una primera evaluación sin costo.",
  alternates: { canonical: "/asesoria" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: `${SITE.url}/asesoria`,
    siteName: SITE.nombre,
    title: `Asesoría regulatoria · ${SITE.nombre}`,
    description:
      "Cómo trabajo el registro sanitario, la farmacovigilancia y el cumplimiento normativo ante el ISP de Chile.",
    images: [OG_IMAGEN],
  },
};

// VideoObject: solo se emite si hay video de verdad. Declararle a Google un
// video que no existe es la clase de dato estructurado que termina en una
// penalización manual.
function videoJsonLd() {
  if (!vslConfigurado()) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: VSL.titulo,
    description: VSL.descripcion,
    thumbnailUrl: [miniaturaUrl(VSL.youtubeId)],
    uploadDate: VSL.publicado,
    embedUrl: `https://www.youtube.com/embed/${VSL.youtubeId}`,
    publisher: {
      "@type": "Organization",
      name: SITE.nombre,
      url: SITE.url,
    },
  };
}

export default function Asesoria() {
  const jsonLd = videoJsonLd();
  const hayVideo = vslConfigurado();

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonParaScript(jsonLd) }}
        />
      )}

      {/* ── Presentación en video ─────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Asesoría regulatoria</span>

          <h1 className="font-display mt-5 max-w-4xl text-[2.25rem] leading-[1.08] font-medium tracking-tight sm:text-6xl">
            {hayVideo ? (
              <>
                Antes de que me escribas,
                <br className="hidden sm:block" /> escúchame {VSL.duracion}.
              </>
            ) : (
              <>
                Registro sanitario ante el ISP,
                <br className="hidden sm:block" /> con un químico farmacéutico a cargo.
              </>
            )}
          </h1>

          {hayVideo && (
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Contratar una asesoría regulatoria a ciegas es caro. En este video te
              cuento qué hago exactamente, cómo es el proceso y qué puedes esperar,
              para que la primera reunión empiece en la pregunta que te importa y
              no en la presentación.
            </p>
          )}

          <div className="mt-12 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
            {hayVideo && (
              <div className="min-w-0 flex-1">
                <VideoVsl />
              </div>
            )}

            <div className="lg:w-80 lg:shrink-0">
              {hayVideo && (
                <>
                  <span className="label-micro text-muted">En el video</span>
                  <ul className="mt-6 mb-8 flex flex-col">
                    {VSL.puntos.map((p, i) => (
                      <li
                        key={p}
                        className={`flex gap-4 py-4 text-sm leading-relaxed ${
                          i > 0 ? "border-t border-line" : ""
                        }`}
                      >
                        <span className="label-micro shrink-0 pt-0.5 text-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Link
                href="#contacto"
                className="block bg-foreground px-7 py-3.5 text-center text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Agenda una evaluación
              </Link>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block border border-line px-7 py-3.5 text-center text-sm transition-colors hover:border-foreground"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>

          {/* Las mismas cifras de la home. Esta es la página que se manda por
              WhatsApp y LinkedIn, así que la prueba social tiene que estar acá
              igual o más que en la portada. */}
          <Cifras className="mt-16" />
        </div>
      </section>

      {/* ── Proceso ──────────────────────────────────────────────────── */}
      <section id="proceso" className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Cómo trabajamos</span>
          <h2 className="font-display mt-5 max-w-3xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
            Cuatro etapas, y sabes en cuál estás en todo momento.
          </h2>

          <div className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2">
            {PROCESO.map((p) => (
              <article key={p.n} className="flex flex-col gap-3 bg-background p-7">
                <span className="font-display text-3xl font-medium tracking-tight text-neutral-600">
                  {p.n}
                </span>
                <h3 className="text-base leading-snug font-medium">{p.titulo}</h3>
                <p className="text-sm leading-relaxed text-muted">{p.detalle}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 border-l border-line pl-6">
            <span className="label-micro text-muted">Para que no haya sorpresas</span>
            <ul className="mt-4 flex flex-col gap-2">
              {LIMITES.map((l) => (
                <li key={l} className="text-sm leading-relaxed text-muted">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Trayectoria ──────────────────────────────────────────────── */}
      <section id="trayectoria" className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-72 lg:shrink-0">
              <span className="label-micro text-muted">Trayectoria</span>
              <p className="font-display mt-5 text-2xl leading-tight font-medium tracking-tight sm:text-3xl">
                Regulatorio, calidad y operación en la misma cabeza.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                La mayoría de los expedientes que fallan no fallan por la norma:
                fallan porque nadie miró cómo se ejecuta después. Yo trabajo en
                los dos lados.
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <BloquePerfil />

              <ol className="mt-14 flex flex-col border-t border-line">
                {TRAYECTORIA.map((h, i) => (
                  <li
                    key={`${h.rol}-${h.lugar}`}
                    className={`flex flex-col gap-2 py-7 sm:flex-row sm:gap-8 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span className="label-micro shrink-0 pt-1 text-muted sm:w-24">
                      {h.periodo}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base leading-snug font-medium">{h.rol}</h3>
                      <p className="label-micro mt-1.5 text-muted">{h.lugar}</p>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                        {h.detalle}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── Servicios ────────────────────────────────────────────────── */}
      <section id="servicios" className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Servicios</span>
          <h2 className="font-display mt-5 max-w-3xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
            En qué te puedo ayudar concretamente.
          </h2>

          <div className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {SERVICIOS.map((s) => (
              <article
                key={s.n}
                className="flex flex-col gap-3 bg-background p-6 transition-colors hover:bg-surface"
              >
                <span className="font-display text-3xl font-medium tracking-tight text-neutral-600">
                  {s.n}
                </span>
                <h3 className="text-sm leading-snug font-medium">{s.titulo}</h3>
                <p className="text-xs leading-relaxed text-muted">{s.descripcion}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────────────────── */}
      <Testimonios borde="border-b" />

      {/* ── Contacto ─────────────────────────────────────────────────── */}
      <section id="contacto">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-80 lg:shrink-0">
              <span className="label-micro text-muted">Contacto</span>
              <h2 className="font-display mt-5 text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
                Cuéntame tu caso.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                Reviso tu situación y te digo con claridad qué trámite
                corresponde, qué antecedentes necesitas y en qué orden conviene
                hacerlo. La primera evaluación no tiene costo.
              </p>
              <Link
                href="/agenda"
                className="mt-7 block bg-foreground px-7 py-4 text-center text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Reservar hora
              </Link>

              <div className="mt-6 flex flex-col gap-2 text-sm">
                <a href={`mailto:${SITE.email}`} className="text-muted hover:text-foreground">
                  {SITE.email}
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-foreground"
                >
                  {SITE.whatsappVisible}
                </a>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <FormularioContacto />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
