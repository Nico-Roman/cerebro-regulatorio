// Llamada al modelo por HTTP, contra cualquier proveedor con API compatible con
// OpenAI (Groq, OpenAI, DeepSeek, Together, y Gemini por su endpoint de
// compatibilidad).
//
// Sin SDK a propósito: es un POST con un JSON. Cambiar de proveedor es cambiar
// dos variables de entorno, no código ni dependencias, que era justamente el
// requisito del plan — con el beneficio extra de no sumar peso a la imagen.

export interface RespuestaModelo {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  latenciaMs: number;
}

export function iaConfigurada(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export function modeloActual(): string {
  // gpt-oss-120b en Groq: del orden de un dólar por cada mil respuestas y
  // buen español. Si algún día no rinde, se cambia acá o por variable.
  return process.env.LLM_MODEL || "openai/gpt-oss-120b";
}

/**
 * Esfuerzo de razonamiento bajo para los modelos que lo aceptan. Se envía solo
 * a gpt-oss (o si LLM_REASONING_EFFORT está definida): otros proveedores
 * rechazan parámetros que no conocen.
 */
function parametrosRazonamiento(modelo: string): Record<string, string> {
  const esfuerzo = process.env.LLM_REASONING_EFFORT;
  if (esfuerzo) return { reasoning_effort: esfuerzo };
  return /gpt-oss/i.test(modelo) ? { reasoning_effort: "low" } : {};
}

export async function completar(params: {
  sistema: string;
  usuario: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<RespuestaModelo> {
  const base = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const modelo = modeloActual();
  const inicio = Date.now();

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      // Temperatura 0: en normativa, la creatividad es el defecto, no la virtud.
      temperature: 0,
      // gpt-oss y otros modelos de razonamiento gastan tokens "pensando" antes
      // de escribir, y esos tokens cuentan contra el tope. Con 700 el texto
      // podía llegar vacío; 1.500 deja margen para 200 palabras.
      max_tokens: params.maxTokens ?? 1500,
      ...parametrosRazonamiento(modelo),
      messages: [
        { role: "system", content: params.sistema },
        { role: "user", content: params.usuario },
      ],
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    throw new Error(`El proveedor respondió ${res.status}: ${await res.text()}`);
  }

  const datos = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    texto: datos.choices?.[0]?.message?.content?.trim() || "",
    modelo,
    tokensEntrada: datos.usage?.prompt_tokens ?? 0,
    tokensSalida: datos.usage?.completion_tokens ?? 0,
    latenciaMs: Date.now() - inicio,
  };
}
