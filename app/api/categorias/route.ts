import { NextResponse } from "next/server";
import { listCategorias } from "@/lib/search";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ categorias: listCategorias() });
}
