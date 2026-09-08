// Voto de utilidad sobre una búsqueda.
//
// La regla que importa: solo el autor de la consulta puede votarla. Sin esa
// verificación, cualquiera con un id de consulta podría ensuciar la señal que
// después usamos para decidir qué normas faltan en el corpus.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { consultas, feedback } from "@/lib/db/schema";
import { usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";

const MAX_COMENTARIO = 1000;

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "sesion_requerida" }, { status: 401 });
  }

  let cuerpo: { consultaId?: unknown; util?: unknown; comentario?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const consultaId = typeof cuerpo.consultaId === "string" ? cuerpo.consultaId : "";
  const util = cuerpo.util;
  if (!consultaId || typeof util !== "boolean") {
    return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });
  }

  const comentario =
    typeof cuerpo.comentario === "string" && cuerpo.comentario.trim()
      ? cuerpo.comentario.trim().slice(0, MAX_COMENTARIO)
      : null;

  // La consulta tiene que existir y ser suya. Un 404 acá no es un error del
  // sistema: es alguien votando algo que no le pertenece.
  const [duena] = await db
    .select({ id: consultas.id })
    .from(consultas)
    .where(and(eq(consultas.id, consultaId), eq(consultas.userId, usuario.id)))
    .limit(1);

  if (!duena) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  // Votar dos veces corrige el voto, no lo duplica: el índice único sobre
  // consulta_id convierte el segundo insert en una actualización.
  await db
    .insert(feedback)
    .values({
      id: randomUUID(),
      consultaId,
      userId: usuario.id,
      util,
      comentario,
    })
    .onConflictDoUpdate({
      target: feedback.consultaId,
      set: { util, comentario, createdAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
