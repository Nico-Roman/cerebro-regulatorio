// El cupo diario aplicado en el servidor: lo usan /api/search (cada pregunta)
// y los flujos del asistente (cada ejecución). La regla está en lib/ia/cupo.ts.

import { NextResponse } from "next/server";
import { DIA, MENSAJE_LIMITE_DIARIO, PREGUNTAS_DIARIAS, claveCupoDiario, decidirCupo, type DecisionCupo } from "@/lib/ia/cupo";
import { consumirCupo } from "@/lib/rate-limit";
import { esAdmin } from "@/lib/sesion";

/** Descuenta 1 del día (salvo administradores). Sin devoluciones. */
export async function consumirPreguntaDiaria(usuario: { id: string; email: string }): Promise<DecisionCupo> {
  const sinLimite = esAdmin(usuario.email);
  const usadas = sinLimite ? 0 : (await consumirCupo(claveCupoDiario(usuario.id), PREGUNTAS_DIARIAS, DIA)).contador;
  return decidirCupo(usadas, sinLimite);
}

/** La respuesta 429 cuando se acabaron las preguntas del día. */
export function respuestaLimiteDiario() {
  return NextResponse.json({ error: "limite_diario", mensaje: MENSAJE_LIMITE_DIARIO, restantesHoy: 0 }, { status: 429 });
}
