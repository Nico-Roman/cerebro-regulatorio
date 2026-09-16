import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { guiasPublicadas } from "@/lib/guias";
import { NavSesion } from "@/components/nav-sesion";

// "Agenda" salió de los enlaces de texto: ahora es el botón sólido de la
// derecha. La regla es una sola llamada a la acción dominante por pantalla, y
// tres enlaces compitiendo al mismo peso visual —agenda, WhatsApp y
// formulario— era exactamente lo que la auditoría del 15-09-2026 marcó como
// causa de que nadie tome ninguno.
const ENLACES = [
  { href: "/asesoria", label: "Asesoría" },
  { href: "/#areas", label: "Áreas" },
  { href: "/normativa", label: "Buscador" },
  { href: "/#contacto", label: "Contacto" },
];

export function Nav() {
  const hayGuias = guiasPublicadas().length > 0;

  // Las guías entran al menú solo cuando existe al menos una publicada, para
  // que el menú nunca lleve a una sección vacía.
  const enlaces = hayGuias
    ? [
        ...ENLACES.slice(0, 3),
        { href: "/guias", label: "Guías" },
        ...ENLACES.slice(3),
      ]
    : ENLACES;

  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.nombre} — inicio`}>
          <Image
            src="/logo-regulamed-asuntos-regulatorios.jpg"
            alt={`${SITE.nombre} — ${SITE.claim}`}
            width={577}
            height={577}
            priority
            className="block h-7 w-7"
          />
          <span className="font-display text-base font-medium tracking-tight">
            {SITE.nombre}
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {enlaces.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="label-micro text-muted transition-colors hover:text-foreground"
              >
                {e.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-4">
          <NavSesion />

          {/* La acción dominante, visible en todo el scroll de todas las páginas. */}
          <Link
            href="/agenda"
            className="label-micro bg-foreground px-4 py-2.5 text-background transition-opacity hover:opacity-90"
          >
            Agenda
            <span className="hidden sm:inline"> una evaluación</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
