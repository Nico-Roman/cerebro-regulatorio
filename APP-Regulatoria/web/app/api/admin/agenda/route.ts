// Guardar la configuración de la agenda desde el panel.

import { NextRequest, NextResponse } from "next/server";
import { invalidarCacheHuecos } from "@/lib/agenda/cache";
import { CONFIG_POR_DEFECTO, leerConfig } from "@/lib/agenda/config";
import { guardarConfig, validar } from "@/lib/agenda/guardar";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

function entero(v: unknown, porDefecto: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : porDefecto;
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !esAdmin(usuario.email)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 404 });
  }

  const actual = await leerConfig();
  const form = await req.formData();
  const texto = (campo: string, porDefecto: string) =>
    (form.get(campo)?.toString() || porDefecto).trim();

  const nueva = {
    duracionMin: entero(form.get("duracionMin"), actual.duracionMin),
    bufferMin: entero(form.get("bufferMin"), actual.bufferMin),
    diaInicio: entero(form.get("diaInicio"), actual.diaInicio),
    diaFin: entero(form.get("diaFin"), actual.diaFin),
    horaInicio: texto("horaInicio", actual.horaInicio),
    horaFin: texto("horaFin", actual.horaFin),
    zona: texto("zona", actual.zona) || CONFIG_POR_DEFECTO.zona,
    antelacionHoras: entero(form.get("antelacionHoras"), actual.antelacionHoras),
    horizonteDias: entero(form.get("horizonteDias"), actual.horizonteDias),
    calendarios: texto("calendarios", actual.calendarios.join(","))
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    activa: form.get("activa") === "on",
  };

  const errores = validar(nueva);
  if (errores.length) {
    const params = new URLSearchParams({ error: errores[0].mensaje });
    return NextResponse.redirect(new URL(`/admin/agenda?${params}`, req.url), 303);
  }

  await guardarConfig(nueva);
  // La disponibilidad publicada se calculó con la configuración vieja.
  invalidarCacheHuecos();

  return NextResponse.redirect(new URL("/admin/agenda?guardado=1", req.url), 303);
}
