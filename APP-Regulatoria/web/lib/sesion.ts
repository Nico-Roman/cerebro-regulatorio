// Helpers de sesión para el servidor. Una sola forma de preguntar "¿quién es
// este usuario y puede buscar?", para que ninguna ruta se proteja a medias.

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { perfil } from "@/lib/db/schema";

export interface UsuarioActual {
  id: string;
  nombre: string;
  email: string;
  imagen?: string | null;
  perfilCompleto: boolean;
}

/** Sesión validada contra la base de datos. null si no hay sesión válida. */
export async function usuarioActual(): Promise<UsuarioActual | null> {
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion?.user) return null;

  const [fila] = await db
    .select({ aceptaPrivacidadAt: perfil.aceptaPrivacidadAt })
    .from(perfil)
    .where(eq(perfil.userId, sesion.user.id))
    .limit(1);

  return {
    id: sesion.user.id,
    nombre: sesion.user.name,
    email: sesion.user.email,
    imagen: sesion.user.image,
    // El perfil cuenta como completo solo si aceptó la política: es el campo
    // que sirve de evidencia y el que no se puede rellenar por defecto.
    perfilCompleto: Boolean(fila?.aceptaPrivacidadAt),
  };
}

/**
 * Solo identidad, sin consultar la tabla de perfil. La usa la barra superior,
 * que se renderiza en todas las páginas: con la caché de cookie de Better Auth
 * esto normalmente no toca la base de datos. Para decidir permisos usa
 * usuarioActual(), no esto.
 */
export async function sesionLigera() {
  const sesion = await auth.api.getSession({ headers: await headers() });
  return sesion?.user ?? null;
}

export function esAdmin(email: string): boolean {
  const lista = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
