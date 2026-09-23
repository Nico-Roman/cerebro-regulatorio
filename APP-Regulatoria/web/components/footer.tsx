import Image from "next/image";
import Link from "next/link";
import { SITE, WHATSAPP_URL } from "@/lib/site";
import { guiasPublicadas } from "@/lib/guias";
import { EnlacePlanesFooter } from "@/components/enlace-planes-footer";

export function Footer() {
  // El footer es lo que deja cada guía enlazada desde todas las páginas del
  // sitio, que es la mitad del trabajo para que lleguen a indexarse.
  const guias = guiasPublicadas();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-regulamed-asuntos%20regulatorios%20farmaceuticos%20gicona%20safis%20isp%20seremi%20salud%20regulacion%20medicamentos%20cosmeticos%20dispositivos%20medicos.png"
                alt={`${SITE.nombre} — ${SITE.claim}`}
                width={577}
                height={577}
                className="block h-[38px] w-[38px]"
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
                <EnlacePlanesFooter />
                {guias.length > 0 && (
                  <li>
                    <Link href="/guias" className="text-muted hover:text-foreground">
                      Guías de trámites
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/#contacto" className="text-muted hover:text-foreground">
                    Contacto
                  </Link>
                </li>
              </ul>
            </div>

            {guias.length > 0 && (
              <div>
                <h3 className="label-micro text-muted">Guías</h3>
                <ul className="mt-3 flex max-w-[16rem] flex-col gap-2 text-sm">
                  {guias.map((g) => (
                    <li key={g.slug}>
                      <Link
                        href={`/guias/${g.slug}`}
                        className="text-muted hover:text-foreground"
                      >
                        {g.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="label-micro text-muted">Legal</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <Link href="/privacidad" className="text-muted hover:text-foreground">
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link href="/terminos" className="text-muted hover:text-foreground">
                    Términos del Servicio
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
