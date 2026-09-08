import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { perfil } from "@/lib/db/schema";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

function limpiar(v: unknown, max: number): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
}

export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ ok: false, mensaje: "Sesión no válida." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mensaje: "Solicitud inválida." }, { status: 400 });
  }

  const tipoPerfil = limpiar(body.tipoPerfil, 80);
  if (!tipoPerfil) {
    return NextResponse.json(
      { ok: false, mensaje: "Falta indicar desde dónde consultas." },
      { status: 400 }
    );
  }

  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const ahora = new Date();

  // El consentimiento solo se sella la primera vez: si ya existe, no se vuelve
  // a escribir la fecha, porque esa fecha es la evidencia de cuándo aceptó.
  const [existente] = await db
    .select({ aceptaPrivacidadAt: perfil.aceptaPrivacidadAt })
    .from(perfil)
    .where(eq(perfil.userId, usuario.id))
    .limit(1);

  const aceptaPrivacidadAt =
    existente?.aceptaPrivacidadAt ?? (body.aceptaPrivacidad ? ahora : null);

  if (!aceptaPrivacidadAt) {
    return NextResponse.json(
      { ok: false, mensaje: "Necesitamos tu aceptación para crear la cuenta." },
      { status: 400 }
    );
  }

  const valores = {
    empresa: limpiar(body.empresa, 160),
    cargo: limpiar(body.cargo, 120),
    tipoPerfil,
    telefono: limpiar(body.telefono, 40),
    aceptaPrivacidadAt,
    aceptaNovedades: Boolean(body.aceptaNovedades),
    utmSource: limpiar(utm.source, 80),
    utmMedium: limpiar(utm.medium, 80),
    utmCampaign: limpiar(utm.campaign, 120),
    updatedAt: ahora,
  };

  await db
    .insert(perfil)
    .values({ userId: usuario.id, ...valores })
    .onConflictDoUpdate({ target: perfil.userId, set: valores });

  return NextResponse.json({ ok: true });
}
