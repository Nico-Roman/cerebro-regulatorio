// Agrupar el historial de una persona en conversaciones. Puro (lo prueban
// tests/conversaciones.test.mts) y defensivo: aunque la consulta SQL ya filtra
// por user_id, acá se vuelve a descartar cualquier fila ajena. El historial es
// lo único del sitio que muestra texto que escribió otra persona si algo falla.

export interface FilaHistorial {
  conversacionId: string;
  conversacionCreada: Date;
  userId: string;
  consultaId: string | null;
  pregunta: string | null;
  respuesta: string | null;
  fuentes: Array<{ cita: string; fuenteUrl?: string }> | null;
  creada: Date | null;
}

export interface Conversacion {
  id: string;
  creada: Date;
  turnos: Array<{ consultaId: string; pregunta: string; respuesta: string | null; citas: Array<{ cita: string; fuenteUrl?: string }>; creada: Date }>;
}

export function agruparHistorial(filas: FilaHistorial[], userId: string): Conversacion[] {
  const porId = new Map<string, Conversacion>();
  for (const f of filas) {
    if (f.userId !== userId) continue;
    let c = porId.get(f.conversacionId);
    if (!c) {
      c = { id: f.conversacionId, creada: f.conversacionCreada, turnos: [] };
      porId.set(f.conversacionId, c);
    }
    if (f.consultaId && f.pregunta && f.creada) {
      c.turnos.push({ consultaId: f.consultaId, pregunta: f.pregunta, respuesta: f.respuesta, citas: f.fuentes ?? [], creada: f.creada });
    }
  }
  const salida = [...porId.values()].filter((c) => c.turnos.length);
  for (const c of salida) c.turnos.sort((a, b) => a.creada.getTime() - b.creada.getTime());
  return salida.sort((a, b) => b.creada.getTime() - a.creada.getTime());
}

/** Lo que viaja como contexto: pregunta y una respuesta breve, las 3 últimas. */
export function turnosParaContexto(
  previas: Array<{ pregunta: string; respuestaLlm: string | null }>,
  max = 3
): Array<{ pregunta: string; respuesta: string }> {
  return previas.slice(-max).map((p) => ({
    pregunta: p.pregunta,
    respuesta: (p.respuestaLlm ?? "(sin respuesta redactada)").replace(/\s+/g, " ").slice(0, 300),
  }));
}
