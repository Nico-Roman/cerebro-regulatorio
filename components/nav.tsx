import Image from "next/image";
import Link from "next/link";
import { SITE, WHATSAPP_URL } from "@/lib/site";

const ENLACES = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#areas", label: "Áreas" },
  { href: "/normativa", label: "Buscador" },
  { href: "/#contacto", label: "Contacto" },
];

export function Nav() {
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
          {ENLACES.map((e) => (
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

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="label-micro shrink-0 border border-line px-3.5 py-2 transition-colors hover:border-foreground"
        >
          Hablemos
        </a>
      </nav>
    </header>
  );
}
