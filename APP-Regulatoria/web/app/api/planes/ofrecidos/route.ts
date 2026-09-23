// Marca que la persona ya vio la oferta única de planes (ver
// components/oferta-inicial.tsx). Idempotente: solo escribe la primera vez.

import { NextResponse } from "next/server";
import { marcarPlanesOfrecidos } from "@/lib/creditos";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

export async function POST() {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });
  await marcarPlanesOfrecidos(usuario.id);
  return NextResponse.json({ ok: true });
}
