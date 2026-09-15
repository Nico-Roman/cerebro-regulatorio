// Compuerta de propósito: qué se le deja llegar al modelo.
//
// El motor ya decide si la MATERIA está en la base (estado "ausente"). Esto
// decide algo distinto y anterior: si lo que llegó es una PREGUNTA sobre la
// norma o es otra cosa —una tarea de redacción, un intento de cambiarle las
// instrucciones al modelo, una consulta clínica personal—. Son ejes
// independientes: "redáctame un correo al ISP citando la Res. Ex. 1651" es
// perfectamente recuperable por BM25 y no es una consulta normativa.
//
// Determinista a propósito. Un clasificador que vive en el prompt se negocia:
// basta pedirlo de otra forma. Este corre antes de la llamada, no cuesta
// tokens, y su decisión queda escrita en la base para poder medirla.
//
// Criterio para agregar un patrón: que el falso positivo sea raro y barato
// (la persona reformula) y el falso negativo, caro (el sitio funciona como
// asistente general y deja de ser un buscador normativo).

import { normalizar } from "@/lib/search";

export type MotivoBloqueo = "tarea" | "rol" | "formato" | "clinico";

export interface Veredicto {
  bloqueada: boolean;
  motivo: MotivoBloqueo | null;
  /** Lo que se le muestra a la persona. Siempre dice qué SÍ se puede hacer. */
  mensaje: string | null;
}

const MENSAJES: Record<MotivoBloqueo, string> = {
  tarea:
    "Este buscador solo responde preguntas sobre las normas que tiene cargadas (ISP/ANAMED y Código Sanitario). No redacta correos, textos ni documentos. Pregúntalo como consulta: «¿qué exige la norma sobre…?».",
  rol: "Este buscador solo responde preguntas sobre las normas cargadas. No cambia de rol ni de instrucciones.",
  formato:
    "La pregunta contiene texto con formato de pasaje o de instrucción. Escríbela como una pregunta en lenguaje normal.",
  clinico:
    "Este buscador responde qué dice la normativa, no consultas de salud personales. Para una indicación sobre un tratamiento, consulta a tu médico o al químico farmacéutico de tu farmacia.",
};

// (1) Tareas de producción de texto. Ancladas al inicio o tras una fórmula de
// cortesía: así "¿qué documentos debe generar el titular?" no cae, y
// "genérame un modelo de carta" sí.
const CORTESIA = "(?:hola[,\\s]+)?(?:por favor[,\\s]+)?(?:me\\s+)?(?:puedes|podrias|necesito que|quiero que)?\\s*";
const VERBOS_TAREA = [
  "redacta\\w*",
  "escribe\\w*|escribeme",
  "traduce\\w*|traduzca\\w*|traducir",
  "resume (?:esto|este texto|lo siguiente|el siguiente)",
  "parafrasea\\w*",
  "corrige\\w*|reescribe\\w*",
  "genera(?:me)? (?:un|una|el|la)",
  "crea(?:me)? (?:un|una)",
  "hazme|haz (?:un|una)|arma(?:me)? (?:un|una)",
  "prepara(?:me)? (?:un|una)",
  "programa(?:me)?|codifica|dame el codigo|escribe codigo",
  "inventa\\w*|imagina que",
  "dame (?:un )?(?:ejemplo|modelo|plantilla|borrador) de (?:correo|carta|email|mail|oficio|mensaje|whatsapp|curriculum|cv|discurso|post|publicacion)",
  "traduceme|resumeme",
];
const RX_TAREA = new RegExp(`^${CORTESIA}(?:${VERBOS_TAREA.join("|")})\\b`);

// (2) Cambio de rol, extracción de instrucciones, identidad del asistente.
// No van anclados: aquí un falso positivo es casi imposible en una consulta
// normativa real.
const RX_ROL =
  /\b(?:actua como|actúa como|comportate como|hazte pasar|finge (?:que|ser)|simula (?:que|ser)|eres un[ao]?\s|desde ahora eres|olvida (?:las|tus|todas)|ignora (?:las|tus|todo|el|lo)|no sigas (?:las|tus)|desactiva (?:tus|las)|sin (?:restricciones|filtros|limites)|modo (?:desarrollador|dios|libre)|jailbreak|system prompt|prompt del sistema|tus instrucciones|cuales son tus reglas|que modelo eres|quien eres|quien te creo|chatgpt|openai|gpt-?[0-9]|deepseek|gemini|llama\s*[0-9]|groq)\b/;

// (3) Texto que imita la estructura del prompt: bloques de pasaje, marcas de
// cita, encabezados. Es el vector para hacerle "citar" una norma inventada
// con el número de un pasaje real.
const RX_FORMATO =
  /(?:^|\n)\s*-{3,}|\[\s*p\s*\d|【|pasajes?\s+disponibles|^\s*pregunta\s*:|\n\s*pregunta\s*:|reglas\s*(?:,|:)|responde siguiendo|<\/?\s*(?:system|instrucciones|prompt)/;

// (4) Consulta clínica personal. No es uso indebido del sistema: es un uso
// para el que este sistema no sirve y en el que equivocarse tiene costo.
const RX_CLINICO =
  /\b(?:que me tomo|que puedo tomar|me puedo tomar|puedo tomar(?:me)?|dosis para (?:mi|un nino|una nina|mi hijo)|para mi (?:hijo|hija|mama|papa|pareja|abuel)|estoy embarazada|estoy tomando|tengo (?:dolor|fiebre|covid|gripe|alergia|diabetes|presion)|me duele|es malo (?:tomar|mezclar)|puedo mezclar|receta para mi|me recetaron|sirve para (?:mi|el dolor de))\b/;

export function clasificarPeticion(pregunta: string): Veredicto {
  const q = normalizar(pregunta);
  const orden: Array<[MotivoBloqueo, RegExp]> = [
    ["formato", RX_FORMATO],
    ["rol", RX_ROL],
    ["tarea", RX_TAREA],
    ["clinico", RX_CLINICO],
  ];
  for (const [motivo, rx] of orden) {
    if (rx.test(q)) return { bloqueada: true, motivo, mensaje: MENSAJES[motivo] };
  }
  return { bloqueada: false, motivo: null, mensaje: null };
}

/**
 * Lo que igual se manda al modelo, ya inofensivo. La compuerta de arriba corta
 * lo evidente; esto se hace cargo de lo que se le escape: una pregunta es una
 * línea de texto, así que todo lo que la haga parecer otra cosa se aplana.
 *
 * No reemplaza a clasificarPeticion(): la sanea, no la juzga.
 */
export function sanearPregunta(pregunta: string): string {
  return (pregunta || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/[[【]\s*p\s*\d+[^\]】]*[\]】]/gi, " ")
    .replace(/[`{}<>]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 300);
}
