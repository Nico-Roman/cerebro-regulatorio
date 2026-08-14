import Link from "next/link";
import { AREAS, FAQS, SERVICIOS, SITE, WHATSAPP_URL } from "@/lib/site";
import { BuscadorHome } from "@/components/buscador-home";
import { FormularioContacto } from "@/components/formulario-contacto";

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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20">
        <h1 className="font-display max-w-4xl text-[2.25rem] leading-[1.08] font-medium tracking-tight sm:text-6xl lg:text-7xl">
          Te asesoramos en tus
          <br className="hidden sm:block" /> asuntos regulatorios.
        </h1>

        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          {SITE.nombre} acompaña a laboratorios, importadores y marcas en el registro
          sanitario, la vigilancia post-comercialización y el cumplimiento normativo de
          productos farmacéuticos, cosméticos y dispositivos médicos ante el Instituto de
          Salud Pública de Chile.
        </p>

        <ul className="mt-9 flex flex-wrap gap-2">
          {RUBROS.map((r) => (
            <li key={r} className="label-micro border border-line px-3 py-1.5 text-muted">
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="#contacto"
            className="bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Agenda una evaluación
          </Link>
          <Link
            href="#servicios"
            className="border border-line px-7 py-3.5 text-sm transition-colors hover:border-foreground"
          >
            Ver servicios
          </Link>
        </div>
      </section>

      {/* ── Buscador gratuito ────────────────────────────────────────── */}
      <section id="buscador" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-64 lg:shrink-0">
              <span className="label-micro text-muted">Herramienta gratuita</span>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Nuestro buscador de normativa es abierto y no cobramos nada por usarlo. No
                pedimos registro ni datos de contacto.
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display max-w-2xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
                ¿Aún no necesitas asesoría? Usa nuestro buscador para encontrar la
                regulación que buscas.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
                Devuelve el pasaje legal exacto de decretos, resoluciones y normas técnicas
                del ISP/ANAMED, con la cita y el enlace a la fuente oficial. No genera
                respuestas con inteligencia artificial: recupera el texto tal como está
                publicado.
              </p>

              <div className="mt-8">
                <BuscadorHome />
              </div>
            </div>
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

      {/* ── Preguntas frecuentes ─────────────────────────────────────── */}
      <section id="faq" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-64 lg:shrink-0">
              <span className="label-micro text-muted">Preguntas frecuentes</span>
            </div>
            <div className="min-w-0 flex-1">
              <dl className="flex flex-col">
                {FAQS.map((f, i) => (
                  <div key={f.p} className={`py-6 ${i > 0 ? "border-t border-line" : ""}`}>
                    <dt className="font-display text-base leading-snug font-medium sm:text-lg">
                      {f.p}
                    </dt>
                    <dd className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                      {f.r}
                    </dd>
                  </div>
                ))}
              </dl>
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
                evaluación no tiene costo.
              </p>
              <div className="mt-7 flex flex-col gap-2 text-sm">
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
