"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { BotonSalir } from "@/components/boton-salir";

/**
 * El trozo de la barra superior que depende de quién está mirando.
 *
 * Vive en el cliente a propósito. Cuando esto se resolvía en el servidor, el
 * Nav llamaba a sesionLigera(), que lee cabeceras, y al estar el Nav en el
 * layout raíz eso volvía dinámica TODA ruta del sitio: hasta /privacidad y las
 * guías de trámites se renderizaban de nuevo en cada visita en vez de servirse
 * prerenderizadas. Justo las páginas que existen para traer tráfico de búsqueda
 * eran las que menos podían permitírselo.
 *
 * Moviendo solo este widget al cliente, el resto de la barra queda estático y
 * las páginas de contenido vuelven a prerenderizarse en el build. El costo es
 * una petición de sesión en el cliente, que para un widget de cuatro palabras
 * es un cambio barato.
 *
 * Para decidir permisos sigue usándose el servidor: las rutas que de verdad
 * dependen de la sesión (/perfil, /normativa, /ingresar, /admin) la consultan
 * con usuarioActual() y siguen siendo dinámicas, como corresponde.
 */
export function NavSesion() {
  const { data: sesion, isPending } = useSession();

  // Mientras la sesión se resuelve no se afirma nada. El hueco invisible
  // mantiene el ancho del caso más frecuente —visitante anónimo— para que la
  // barra no salte cuando llegue la respuesta.
  if (isPending) {
    return (
      <span aria-hidden className="label-micro invisible">
        Entrar
      </span>
    );
  }

  if (!sesion?.user) {
    return (
      <Link
        href="/ingresar"
        className="label-micro text-muted transition-colors hover:text-foreground"
      >
        Entrar
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/perfil"
        className="label-micro hidden text-muted transition-colors hover:text-foreground sm:block"
        title={sesion.user.email}
      >
        {sesion.user.email}
      </Link>
      <BotonSalir />
    </>
  );
}
