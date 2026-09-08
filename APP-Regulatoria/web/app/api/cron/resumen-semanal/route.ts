// Resumen semanal por correo: registros nuevos, preguntas más frecuentes y lo
// que el corpus no cubrió.
//
// Dos formas de dispararlo, a propósito:
//   1. Sesión de administrador (botón o URL desde /admin). Funciona hoy, sin
//      configurar nada más.
//   2. Cabecera `Authorization: Bearer <CRON_SECRET>`, para que un cron externo
//      (GitHub Actions) lo llame solo. Si CRON_SECRET no está definida, esa vía
//      queda cerrada: una variable vacía no debe convertirse en una puerta
//      abierta.

import { NextRequest, NextResponse } from "next/server";
import { consultasRecientes, huecosDelCorpus, resumen, usuarios } from "@/lib/admin";
import { enviarCorreo } from "@/lib/correo";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

function autorizadoPorSecreto(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const cabecera = req.headers.get("authorization") || "";
  return cabecera === `Bearer ${secreto}`;
}

export async function GET(req: NextRequest) {
  if (!autorizadoPorSecreto(req)) {
    const usuario = await usuarioActual();
    if (!usuario || !esAdmin(usuario.email)) {
      return NextResponse.json({ error: "no_autorizado" }, { status: 404 });
    }
  }

  const destino =
    process.env.RESUMEN_TO ||
    process.env.CONTACTO_TO ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();

  if (!destino) {
    return NextResponse.json(
      { error: "sin_destinatario", mensaje: "Define RESUMEN_TO o CONTACTO_TO." },
      { status: 500 }
    );
  }

  const [metricas, gente, preguntas, huecos] = await Promise.all([
    resumen(),
    usuarios(2000),
    consultasRecientes(200),
    huecosDelCorpus(7, 15),
  ]);

  const nuevos = gente.filter((u) => {
    const alta = new Date(`${u.registradoEn}T00:00:00Z`).getTime();
    return Date.now() - alta < 7 * 24 * 3600 * 1000;
  });

  const ultimaSemana = preguntas.filter(
    (c) => Date.now() - new Date(c.createdAt.replace(" ", "T")).getTime() < 7 * 24 * 3600 * 1000
  );

  const li = (xs: string[]) =>
    xs.length ? `<ul>${xs.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>";

  const html = `
    <h2>RegulaMED · resumen semanal</h2>
    <p>
      ${metricas.usuariosNuevos7d} registros nuevos ·
      ${metricas.consultas7d} consultas ·
      ${metricas.sinCobertura7d} sin cobertura ·
      ${metricas.votosNegativos7d} votos negativos
    </p>

    <h3>Registros nuevos</h3>
    ${li(
      nuevos.map(
        (u) =>
          `${u.nombre} &lt;${u.email}&gt;${u.empresa ? ` — ${u.empresa}` : ""}${
            u.tipoPerfil ? ` (${u.tipoPerfil})` : ""
          }`
      )
    )}

    <h3>Preguntas de la semana</h3>
    ${li(ultimaSemana.slice(0, 25).map((c) => `${c.pregunta} — ${c.confianza || "sin señal"}`))}

    <h3>Lo que el corpus no cubrió</h3>
    ${li(huecos.map((h) => `<strong>${h.concepto}</strong> (${h.veces}×) — ej: ${h.ejemplo}`))}

    <p style="color:#666;font-size:12px">
      Generado por /api/cron/resumen-semanal. Los datos salen de Postgres, no de analítica externa.
    </p>
  `;

  await enviarCorreo({
    to: destino,
    subject: `RegulaMED · ${metricas.usuariosNuevos7d} registros y ${metricas.consultas7d} consultas esta semana`,
    html,
  });

  return NextResponse.json({ ok: true, enviadoA: destino, metricas });
}
