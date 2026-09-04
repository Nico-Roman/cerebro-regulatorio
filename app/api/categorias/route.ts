import { NextResponse } from "next/server";
import { listCategorias } from "@/lib/search";
import { exigirSesion } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET() {
  const bloqueo = await exigirSesion();
  if (bloqueo) return bloqueo;
  return NextResponse.json({ categorias: listCategorias() });
}
