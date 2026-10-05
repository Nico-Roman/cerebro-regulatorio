import Link from "next/link";
import { jsonParaScript } from "@/lib/html";
import { AREAS, FAQS, SERVICIOS, SITE, WHATSAPP_URL } from "@/lib/site";
import { guiasPublicadas } from "@/lib/guias";
import { BuscadorHome } from "@/components/buscador-home";
import { FormularioContacto } from "@/components/formulario-contacto";
import { VideoVsl } from "@/components/video-vsl";
import { BloquePerfil, Cifras, Credenciales, Testimonios } from "@/components/prueba-social";

const RUBROS = [
  "Farmacéuticos",
  "Cosméticos",
  "Dispositivos médicos",
  "Alimentos especiales",
  "Farmacovigilancia",
];

// Schema de FAQ: es lo que puede hacer que Google muestre las preguntas
// desplegadas directamente en el resultado de búsqueda.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.p,
    acceptedAnswer: { "@type": "Answer", text: f.r },
  })),
};

export default function Home() {
  const guias = guiasPublicadas();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonParaScript(faqJsonLd) }}
      />

      {/* ── Buscador gratuito: abre la página ─────────────────────────── */}
      <section
        id="buscador"
        className="mx-auto w-full max-w-6xl px-5 pt-16 pb-16 sm:px-8 sm:pt-20 sm:pb-20"
      >
        <span className="label-micro text-muted">Buscador de normativa · ISP / ANAMED</span>

        <h2 className="font-display mt-5 max-w-4xl text-[2rem] leading-[1.1] font-medium tracking-tight sm:text-5xl lg:text-6xl">
          Encuentra la norma
          <br className="hidden sm:block" /> que estás buscando.
        </h2>

        {/* El texto de esta sección es el primero que lee alguien que llega de
            LinkedIn o WhatsApp: se explica qué hace el buscador en una frase, en
            palabras de todos los días. El detalle técnico (cómo se cita, cómo se
            verifica el borrador) vive en la página del buscador, donde ya está
            usándolo, y no acá antes de que apriete la primera tecla.

            Lo que esta frase NO hace, desde el 16-09-2026, es apoyarse en la
            palabra "IA". En el mercado chileno ya hay competencia vendiendo
            registros ISP "con agentes de IA", así que decirlo iguala en vez de
            separar. Lo que no hace nadie más es devolver el párrafo literal de
            la norma con su enlace oficial. Desde el 23-09 ya no promete "no lo
            resume": el asistente redacta un borrador, y la frase lo dice. */}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Escribe tu pregunta como se te ocurra. Te muestra los artículos que la
          responden, con el enlace oficial del ISP, y un borrador con IA que cita
          cada frase.
        </p>

        <div className="mt-9 max-w-3xl">
          <BuscadorHome />
        </div>

        <p className="mt-7 max-w-2xl text-sm leading-relaxed text-muted">
          Es gratuito y va a seguir siéndolo. Solo tienes que registrarte.
        </p>
      </section>

      {/* ── Asesoría ─────────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Asesoría regulatoria</span>

          <h1 className="font-display mt-5 max-w-4xl text-[2.25rem] leading-[1.08] font-medium tracking-tight sm:text-6xl lg:text-7xl">
            Te asesoramos en tus
            <br className="hidden sm:block" /> trámites regulatorios.
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {SITE.nombre} se hace cargo del trámite ante el ISP: registrar tu producto,
            mantenerlo vigente y responder lo que la autoridad pida. Trabajamos con
            laboratorios, importadores y marcas de productos farmacéuticos, cosméticos y
            dispositivos médicos.
          </p>

          {/* Las cifras van entre el titular y el video, que es donde más se
              miran. Desaparecen solas mientras CIFRAS esté vacío en site.ts. */}
          <Cifras className="mt-12" />

          <ul className="mt-9 flex flex-wrap gap-2">
            {RUBROS.map((r) => (
              <li key={r} className="label-micro border border-line px-3 py-1.5 text-muted">
                {r}
              </li>
            ))}
          </ul>

          {/* El video va acá mismo en vez de detrás de un botón a /asesoria: el
              que llega a esta sección ya está evaluando si contratar, y mandarlo
              a otra página para eso es un clic que muchos no dan. /asesoria sigue
              existiendo como landing para mandar por WhatsApp y LinkedIn.
              El reproductor es diferido (ver components/video-vsl.tsx), así que
              sumarlo a la portada no le cuesta nada a quien no le da play. */}
          <div className="mt-12 max-w-3xl">
            <VideoVsl />

            <Link
              href="#contacto"
              className="mt-8 block bg-foreground px-8 py-5 text-center text-base font-medium text-background transition-opacity hover:opacity-90"
            >
              Agenda una evaluación
            </Link>
            <p className="mt-3 text-center text-xs text-muted">
              La primera evaluación no tiene costo.
            </p>
          </div>
        </div>
      </section>

      {/* ── Quién te va a atender ─────────────────────────────────────────
          Sube a la portada lo que hasta ahora vivía solo en /asesoria. En este
          mercado el que contrata no le compra a una marca: le compra a un
          químico farmacéutico identificable que responde con su título.

          Centrado en vez del layout de etiqueta-a-la-izquierda que usan
          Servicios/Áreas/FAQ: esta sección presenta a una persona, no una
          lista, así que funciona más como una portada de "conoce a quién te
          atiende" que como una fila de contenido más. */}
      <section id="quien" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="label-micro text-muted">Quién te va a atender</span>
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-left">
            <BloquePerfil />

            {/* Las credenciales cierran la presentación: primero quién es,
                después con qué lo respalda. Al revés —como estaban, en una
                franja sobre el buscador— son cinco nombres de diplomas sin
                una cara a la que pegarse. */}
            <Credenciales className="mt-12" />

            <Link
              href="/asesoria"
              className="label-micro mt-8 inline-block border border-line px-4 py-2.5 transition-colors hover:border-foreground"
            >
              Cómo trabajo contigo
            </Link>
          </div>
        </div>
      </section>

      {/* ── Servicios ────────────────────────────────────────────────── */}
      <section id="servicios" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Servicios</span>
          <h2 className="font-display mt-5 max-w-3xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
            Todo lo que necesitas para entrar y mantenerte en el mercado sanitario chileno.
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

          <p className="mt-8 text-sm text-muted">
            ¿Tu caso no está en la lista?{" "}
            <Link href="#contacto" className="text-foreground underline">
              Cuéntanos qué necesitas
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Áreas de práctica ────────────────────────────────────────── */}
      <section id="areas" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <span className="label-micro text-muted">Áreas de práctica</span>

          <div className="mt-12 flex flex-col">
            {AREAS.map((a, i) => (
              <div
                key={a.clave}
                className={`flex flex-col gap-8 py-12 lg:flex-row lg:gap-16 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <div className="lg:w-64 lg:shrink-0">
                  <h3 className="font-display text-xl font-medium tracking-tight">
                    {a.etiqueta}
                  </h3>
                  <ul className="mt-5 flex flex-col gap-2">
                    {a.items.map((it) => (
                      <li key={it} className="label-micro text-muted">
                        {it}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="label-micro mt-7 inline-block border border-line px-4 py-2.5 transition-colors hover:border-foreground"
                  >
                    Consultar
                  </a>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-display max-w-2xl text-xl leading-snug font-medium tracking-tight sm:text-3xl">
                    {a.titular}
                  </p>
                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <p className="text-sm leading-relaxed text-muted">{a.parrafoA}</p>
                    <p className="text-sm leading-relaxed text-muted">{a.parrafoB}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guías de trámites ─────────────────────────────────────────────
          El único contenido del sitio escrito para una búsqueda concreta y no
          para alguien que ya conoce la marca. Aparece cuando hay al menos una
          guía publicada (ver lib/guias.ts). */}
      {guias.length > 0 && (
        <section id="guias" className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <span className="label-micro text-muted">Guías de trámites</span>
            <h2 className="font-display mt-5 max-w-3xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
              Cómo se hace cada trámite, explicado completo.
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
              Lo mismo que te explicaríamos en una reunión, escrito y con el enlace a la
              fuente oficial.
            </p>

            <div className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2">
              {guias.slice(0, 4).map((g) => (
                <article key={g.slug} className="bg-background transition-colors hover:bg-surface">
                  <Link href={`/guias/${g.slug}`} className="flex h-full flex-col gap-3 p-7">
                    <h3 className="font-display text-base leading-snug font-medium tracking-tight sm:text-lg">
                      {g.titulo}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">{g.resumen}</p>
                  </Link>
                </article>
              ))}
            </div>

            {guias.length > 4 && (
              <p className="mt-8 text-sm text-muted">
                <Link href="/guias" className="text-foreground underline">
                  Ver todas las guías
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Testimonios ───────────────────────────────────────────────────
          Último bloque antes de las preguntas y el formulario: es el punto
          donde la persona decide si escribe o se va. */}
      <Testimonios />

      {/* ── Preguntas frecuentes ─────────────────────────────────────── */}
      <section id="faq" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-64 lg:shrink-0">
              <span className="label-micro text-muted">Preguntas frecuentes</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col">
                {FAQS.map((f, i) => {
                  // El enlace solo aparece si esa guía está publicada: una FAQ
                  // que apunta a un 404 es peor que una FAQ sin enlace.
                  const guia = f.guia ? guias.find((g) => g.slug === f.guia) : undefined;

                  return (
                    <details
                      key={f.p}
                      className={`group py-6 ${i > 0 ? "border-t border-line" : ""}`}
                    >
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                        <span className="font-display text-base leading-snug font-medium sm:text-lg">
                          {f.p}
                        </span>
                        <span
                          aria-hidden
                          className="label-micro mt-0.5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                        {f.r}
                        {guia && (
                          <>
                            {" "}
                            <Link
                              href={`/guias/${guia.slug}`}
                              className="text-foreground underline underline-offset-4"
                            >
                              Ver la guía completa
                            </Link>
                            .
                          </>
                        )}
                      </p>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contacto ─────────────────────────────────────────────────── */}
      <section id="contacto" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-80 lg:shrink-0">
              <span className="label-micro text-muted">Contacto</span>
              <h2 className="font-display mt-5 text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
                Cuéntanos tu caso.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                Revisamos tu situación y te decimos con claridad qué trámite corresponde,
                qué antecedentes necesitas y en qué orden conviene hacerlo. La primera
                evaluación no tiene costo y va a seguir sin tenerlo.
              </p>

              {/* Una acción dominante y dos alternativas, en vez de tres
                  canales compitiendo con el mismo peso visual. */}
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
