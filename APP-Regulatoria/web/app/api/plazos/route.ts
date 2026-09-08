import { NextResponse } from "next/server";
import { getPlazosProximos } from "@/lib/normativa";
import { exigirSesion } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET() {
  const bloqueo = await exigirSesion();
  if (bloqueo) return bloqueo;
  return NextResponse.json({ plazos: getPlazosProximos(8) });
}
