// Puerta de entrada barata: redirige a /ingresar cuando no hay cookie de sesión.
//
// Ojo: esto NO es la protección real. El proxy corre antes del render y no
// consulta la base de datos, así que solo mira si la cookie existe — una cookie
// falsificada pasa por acá. La validación de verdad la hace cada ruta con
// usuarioActual(), que verifica la sesión contra Postgres.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTEGIDAS = ["/normativa", "/perfil", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!PROTEGIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (getSessionCookie(request)) return NextResponse.next();

  // La consulta que la persona ya escribió viaja con ella a través del login:
  // perder esa pregunta es perder el registro.
  const destino = new URL("/ingresar", request.url);
  destino.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/normativa/:path*", "/perfil/:path*", "/admin/:path*"],
};
