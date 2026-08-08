import { NextResponse } from "next/server";
import { getPlazosProximos } from "@/lib/normativa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ plazos: getPlazosProximos(8) });
}
