// Cuántos créditos de IA le quedan a la persona: plan, cupo del mes y del día,
// y saldo de pack. Lo lee el buscador para mostrarlo junto al botón de IA.

import { NextResponse } from "next/server";
import { estadoCreditos } from "@/lib/creditos";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });
  const estado = await estadoCreditos(usuario.id);
  return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
}
