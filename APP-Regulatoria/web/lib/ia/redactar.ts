// Redacción de la respuesta a partir de los pasajes que ya recuperó BM25.
//
// El modelo no busca ni sabe nada: solo ordena en prosa lo que el motor
// encontró. Todo lo que diga tiene que estar en los pasajes que se le pasan, y
// cada afirmación va con su cita. Si no alcanza, dice que no alcanza.
//
// Por qué importa tanto: el valor del buscador es que sus respuestas son
// trazables a la norma. Un modelo que "complete" con lo que recuerda de su
// entrenamiento destruye exactamente eso, y en normativa farmacéutica el costo
// de una cifra inventada lo paga un tercero.

import { completar, type RespuestaModelo } from "@/lib/ia/proveedor";

export const SISTEMA = [
  "Eres un asistente de consulta normativa farmacéutica chilena (ISP/ANAMED).",
  "",
  "Reglas, sin excepción:",
  "1. Responde ÚNICAMENTE con lo que dicen los pasajes entregados. No uses nada",
  "   que sepas por fuera, aunque estés seguro.",
  "2. Cada afirmación lleva su cita entre corchetes, tal como viene en el pasaje.",
  "3. Si los pasajes no alcanzan para responder, dilo en una frase y detente. No",
  "   completes con lo más parecido.",
  "4. Si los pasajes se contradicen o hay una modificación posterior, señálalo en",
  "   vez de elegir uno.",
  "5. Español de Chile, tono profesional y directo. Máximo 200 palabras.",
  "6. No des asesoría legal ni recomendaciones de cumplimiento: describe lo que",
  "   dice la norma.",
].join("\n");

export interface PasajeParaModelo {
  cita: string;
  titulo: string;
  texto: string;
  vigencia: string;
  alertaVigencia?: string;
}

export function armarMensaje(pregunta: string, pasajes: PasajeParaModelo[]): string {
  const bloques = pasajes.map((p, i) =>
    [
      `--- PASAJE ${i + 1} ---`,
      `Cita: ${p.cita}`,
      `Norma: ${p.titulo}`,
      `Vigencia: ${p.vigencia}${p.alertaVigencia ? ` (${p.alertaVigencia})` : ""}`,
      `Texto: ${p.texto.replace(/\s+/g, " ").trim()}`,
    ].join("\n")
  );

  return [
    `PREGUNTA: ${pregunta}`,
    "",
    "PASAJES DISPONIBLES:",
    ...bloques,
    "",
    "Responde siguiendo las reglas del sistema.",
  ].join("\n");
}

export async function redactarRespuesta(
  pregunta: string,
  pasajes: PasajeParaModelo[]
): Promise<RespuestaModelo> {
  return completar({
    sistema: SISTEMA,
    usuario: armarMensaje(pregunta, pasajes),
  });
}
