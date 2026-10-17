// Conversaciones del asistente (encargo C, fase 2). Toda lectura filtra por la
// persona en el servidor: el id de una conversación que viene del navegador no
// prueba nada.

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { consultas, conversaciones } from "@/lib/db/schema";
import { agruparHistorial, turnosParaContexto, type Conversacion } from "@/lib/conversaciones-agrupar";
import type { TurnoHistorial } from "@/lib/ia/planificar";

/** La conversación pedida si es de esta persona; si no (o no viene), una nueva. */
export async function conversacionPara(userId: string, pedida: string | null): Promise<string> {
  if (pedida) {
    const [c] = await db
      .select({ id: conversaciones.id })
      .from(conversaciones)
      .where(and(eq(conversaciones.id, pedida), eq(conversaciones.userId, userId)))
      .limit(1);
    if (c) return c.id;
  }
  const id = randomUUID();
  await db.insert(conversaciones).values({ id, userId });
  return id;
}

/** Las 3 preguntas anteriores del mismo hilo (y de la misma persona), en orden. */
export async function historialDe(consulta: {
  conversacionId: string | null;
  userId: string;
  createdAt: Date;
}): Promise<TurnoHistorial[]> {
  if (!consulta.conversacionId) return [];
  const previas = await db
    .select({ pregunta: consultas.pregunta, respuestaLlm: consultas.respuestaLlm })
    .from(consultas)
    .where(
      and(
        eq(consultas.conversacionId, consulta.conversacionId),
        eq(consultas.userId, consulta.userId),
        lt(consultas.createdAt, consulta.createdAt)
      )
    )
    .orderBy(desc(consultas.createdAt))
    .limit(3);
  return turnosParaContexto(previas.reverse());
}

/** El historial de /historial: las últimas conversaciones de esta persona. */
export async function conversacionesDe(userId: string, limite = 30): Promise<Conversacion[]> {
  const convs = await db
    .select({ id: conversaciones.id, creada: conversaciones.createdAt })
    .from(conversaciones)
    .where(eq(conversaciones.userId, userId))
    .orderBy(desc(conversaciones.createdAt))
    .limit(limite);
  if (!convs.length) return [];
  const filas = await db
    .select({
      conversacionId: consultas.conversacionId,
      userId: consultas.userId,
      consultaId: consultas.id,
      pregunta: consultas.pregunta,
      respuesta: consultas.respuestaLlm,
      fuentes: consultas.fuentesLlm,
      creada: consultas.createdAt,
    })
    .from(consultas)
    .where(and(eq(consultas.userId, userId), inArray(consultas.conversacionId, convs.map((c) => c.id))))
    .orderBy(asc(consultas.createdAt));
  const creada = new Map(convs.map((c) => [c.id, c.creada]));
  return agruparHistorial(
    filas.map((f) => ({
      ...f,
      conversacionId: f.conversacionId as string,
      conversacionCreada: creada.get(f.conversacionId as string) ?? f.creada,
      fuentes: (f.fuentes as Array<{ cita: string; fuenteUrl?: string }> | null) ?? null,
    })),
    userId
  );
}
