// Export CSV del panel. Mismo origen de datos que la pantalla: si la tabla y el
// archivo dijeran cosas distintas, el archivo sería el que termina en el correo
// de un cliente.

import { NextRequest, NextResponse } from "next/server";
import { aCsv, consultasRecientes, huecosDelCorpus, usuarios } from "@/lib/admin";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !esAdmin(usuario.email)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 404 });
  }

  const tipo = new URL(req.url).searchParams.get("tipo") || "usuarios";
  const hoy = new Date().toISOString().slice(0, 10);

  const filas =
    tipo === "consultas"
      ? await consultasRecientes(5000)
      : tipo === "huecos"
        ? await huecosDelCorpus(365, 500)
        : await usuarios(5000);

  // BOM: sin él, Excel en Windows abre los acentos rotos.
  const csv = "\uFEFF" + aCsv(filas as unknown as Record<string, unknown>[]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="regulamed-${tipo}-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
