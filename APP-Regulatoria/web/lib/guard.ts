// Guardia compartida para las rutas de datos del buscador. Las tres rutas
// auxiliares (categorías, plazos, normativa reciente) alimentan la misma
// pantalla protegida y exponen metadatos del corpus, así que van tras sesión
// igual que la búsqueda.

import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/sesion";

export async function exigirSesion(): Promise<NextResponse | null> {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "sesion_requerida", mensaje: "Entra con tu cuenta para consultar." },
      { status: 401 }
    );
  }
  if (!usuario.perfilCompleto) {
    return NextResponse.json(
      { error: "perfil_incompleto", mensaje: "Completa tu perfil para consultar." },
      { status: 403 }
    );
  }
  return null;
}
