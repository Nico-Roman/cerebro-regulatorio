// Cancelación con enlace firmado. El token es el único secreto: quien lo tiene
// recibió el correo, así que puede cancelar sin crearse una cuenta.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { invalidarCacheHuecos } from "@/lib/agenda/cache";
import { leerConfig } from "@/lib/agenda/config";
import { cancelarEvento } from "@/lib/agenda/google";
import { fechaLargaEnZona, horaEnZona } from "@/lib/agenda/tiempo";
import { enviarCorreo } from "@/lib/correo";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let cuerpo: { token?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const token = typeof cuerpo.token === "string" ? cuerpo.token : "";
  if (!token) return NextResponse.json({ error: "token_faltante" }, { status: 400 });

  const [reserva] = await db
    .select()
    .from(reservas)
    .where(eq(reservas.tokenGestion, token))
    .limit(1);

  if (!reserva) return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  if (reserva.estado === "cancelada") return NextResponse.json({ ok: true, yaEstaba: true });

  const config = await leerConfig();

  if (reserva.googleEventId) {
    try {
      await cancelarEvento(config.calendarios[0], reserva.googleEventId);
    } catch (e) {
      // Se marca cancelada igual: el hueco vuelve a estar disponible en la web
      // y el evento huérfano se ve a simple vista en el calendario.
      console.error("[agenda] no se pudo borrar el evento en Google:", e);
    }
  }

  await db
    .update(reservas)
    .set({ estado: "cancelada" })
    .where(eq(reservas.id, reserva.id));

  invalidarCacheHuecos();

  const cuando = `${fechaLargaEnZona(new Date(reserva.inicio), config.zona)}, ${horaEnZona(
    new Date(reserva.inicio),
    config.zona
  )} h`;

  const avisos = [reserva.email, process.env.CONTACTO_TO].filter(Boolean) as string[];
  for (const destino of avisos) {
    try {
      await enviarCorreo({
        to: destino,
        subject: `Reunión cancelada · ${cuando}`,
        html: `<p>La reunión del ${cuando} quedó cancelada.</p>
               <p>Si fue un error, puedes agendar otra hora en
               <a href="https://regulamed.cl/agenda">regulamed.cl/agenda</a>.</p>`,
      });
    } catch (e) {
      console.error("[agenda] no se pudo avisar la cancelación:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
