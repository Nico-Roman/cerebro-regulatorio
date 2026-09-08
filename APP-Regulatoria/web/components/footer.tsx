import Image from "next/image";
import Link from "next/link";
import { SITE, WHATSAPP_URL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-regulamed-asuntos-regulatorios.jpg"
                alt={`${SITE.nombre} — ${SITE.claim}`}
                width={577}
                height={577}
                className="block h-6 w-6"
              />
              <span className="font-display text-base font-medium tracking-tight">
                {SITE.nombre}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Asuntos regulatorios para productos farmacéuticos, cosméticos y dispositivos
              médicos en Chile.
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            <div>
              <h3 className="label-micro text-muted">Navegación</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <Link href="/#servicios" className="text-muted hover:text-foreground">
                    Servicios
                  </Link>
                </li>
                <li>
                  <Link href="/#areas" className="text-muted hover:text-foreground">
                    Áreas de práctica
                  </Link>
                </li>
                <li>
                  <Link href="/normativa" className="text-muted hover:text-foreground">
                    Buscador de normativa
                  </Link>
                </li>
                <li>
                  <Link href="/#contacto" className="text-muted hover:text-foreground">
                    Contacto
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="label-micro text-muted">Contacto</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <a href={`mailto:${SITE.email}`} className="text-muted hover:text-foreground">
                    {SITE.email}
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:text-foreground"
                  >
                    {SITE.whatsappVisible}
                  </a>
                </li>
                <li className="text-muted">
                  {SITE.ciudad}, Chile
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-xs leading-relaxed text-muted">
            © {new Date().getFullYear()} {SITE.nombre}. El buscador de normativa es una
            herramienta de apoyo a la investigación regulatoria y no constituye asesoría
            regulatoria ni legal formal. Verifica siempre contra la fuente oficial del
            Instituto de Salud Pública antes de tomar decisiones.
          </p>
        </div>
      </div>
    </footer>
  );
}
