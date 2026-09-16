// Bloques de prueba social, compartidos entre la home y /asesoria.
//
// Los tres que dependen de datos que solo Nico tiene —cifras, testimonios y la
// foto— devuelven null cuando esos datos no están. Así el sitio se puede
// desplegar hoy sin nada inventado en pantalla, y el día que se llenen las
// constantes de lib/site.ts los bloques aparecen solos, sin tocar JSX.
//
// De la auditoría del 15-09-2026: de nueve competidores chilenos auditables,
// cinco publican cifras propias y cuatro publican testimonios. RegulaMED no
// tenía ninguno de los dos.

import Image from "next/image";
import { CIFRAS, TESTIMONIOS } from "@/lib/site";
import { CREDENCIALES, PERFIL, REGISTRO_PROFESIONAL } from "@/lib/asesoria";

/**
 * Franja de credenciales. Va justo debajo del buscador, antes de que nadie
 * baje: es la primera señal de que detrás de la herramienta hay un profesional
 * verificable.
 */
export function BandaCredenciales() {
  const items = REGISTRO_PROFESIONAL
    ? [...CREDENCIALES, `Registro profesional N° ${REGISTRO_PROFESIONAL}`]
    : CREDENCIALES;

  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {items.map((c) => (
        <li key={c} className="label-micro flex items-center gap-2.5 text-muted">
          <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-muted" />
          {c}
        </li>
      ))}
    </ul>
  );
}

/** Tres cifras propias. Desaparece mientras CIFRAS esté vacío. */
export function Cifras({ className = "" }: { className?: string }) {
  if (CIFRAS.length === 0) return null;

  return (
    <dl className={`flex flex-wrap gap-x-14 gap-y-8 ${className}`}>
      {CIFRAS.map((c) => (
        <div key={c.etiqueta} className="flex flex-col gap-1">
          <dt className="font-display text-4xl leading-none font-medium tracking-tight sm:text-5xl">
            {c.valor}
          </dt>
          <dd className="label-micro max-w-[14rem] text-muted">{c.etiqueta}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Quién atiende: nombre, título y dos párrafos. La foto es opcional —
 * mientras PERFIL.foto esté vacía el bloque se arma igual, solo sin imagen.
 */
export function BloquePerfil() {
  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:gap-9">
      {PERFIL.foto && (
        <Image
          src={PERFIL.foto}
          alt={`${PERFIL.nombre} — ${PERFIL.rol}`}
          width={320}
          height={320}
          className="h-28 w-28 shrink-0 object-cover sm:h-36 sm:w-36"
        />
      )}

      <div className="min-w-0">
        <h3 className="font-display text-xl leading-tight font-medium tracking-tight sm:text-2xl">
          {PERFIL.nombre}
        </h3>
        <p className="label-micro mt-2 text-muted">{PERFIL.rol}</p>

        <div className="mt-5 flex max-w-2xl flex-col gap-4">
          {PERFIL.parrafos.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Testimonios. Van siempre como último bloque antes del formulario: es el
 * punto donde la persona decide si escribe o se va.
 */
export function Testimonios({
  titulo = "Lo que dicen quienes ya pasaron por esto",
  borde = "border-t",
}: {
  titulo?: string;
  /** La home separa secciones con border-t; /asesoria con border-b. */
  borde?: "border-t" | "border-b";
}) {
  if (TESTIMONIOS.length === 0) return null;

  return (
    <section id="testimonios" className={`${borde} border-line`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <span className="label-micro text-muted">Clientes</span>
        <h2 className="font-display mt-5 max-w-3xl text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
          {titulo}
        </h2>

        <div className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIOS.map((t) => (
            <figure key={t.nombre} className="flex flex-col justify-between gap-6 bg-background p-7">
              <blockquote className="text-sm leading-relaxed">{t.texto}</blockquote>
              <figcaption className="label-micro text-muted">
                {t.nombre}
                <span className="mt-1 block normal-case">{t.empresa}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
