import { NextResponse } from "next/server";
import { getUltimasNormas } from "@/lib/normativa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ normas: getUltimasNormas(10) });
}
