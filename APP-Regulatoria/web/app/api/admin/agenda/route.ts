// Guardar la configuración de la agenda desde el panel.

import { NextRequest, NextResponse } from "next/server";
import { invalidarCacheHuecos } from "@/lib/agenda/cache";
import { CONFIG_POR_DEFECTO, leerConfig, type Ventana } from "@/lib/agenda/config";
import { guardarConfig, validar } from "@/lib/agenda/guardar";
import { redirigir } from "@/lib/redirigir";
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

  // Una fila por día en el panel: `dia6` marcado + `inicio6` y `fin6`.
  const ventanas: Ventana[] = [];
  for (let dia = 1; dia <= 7; dia++) {
    if (form.get(`dia${dia}`) !== "on") continue;
    ventanas.push({
      dia,
      inicio: texto(`inicio${dia}`, ""),
      fin: texto(`fin${dia}`, ""),
    });
  }

  const nueva = {
    duracionMin: entero(form.get("duracionMin"), actual.duracionMin),
    bufferMin: entero(form.get("bufferMin"), actual.bufferMin),
    pasoMin: entero(form.get("pasoMin"), actual.pasoMin),
    ventanas,
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
    return redirigir(`/admin/agenda?${params}`);
  }

  await guardarConfig(nueva);
  // La disponibilidad publicada se calculó con la configuración vieja.
  invalidarCacheHuecos();

  return redirigir("/admin/agenda?guardado=1");
}
