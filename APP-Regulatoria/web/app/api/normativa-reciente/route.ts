import { NextResponse } from "next/server";
import { getUltimasNormas } from "@/lib/normativa";
import { exigirSesion } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET() {
  const bloqueo = await exigirSesion();
  if (bloqueo) return bloqueo;
  return NextResponse.json({ normas: getUltimasNormas(10) });
}
