// Lo común a los flujos del asistente en el servidor: sesión, perfil, cupo
// diario (cada ejecución cuenta 1, sin devoluciones), ráfaga, techo del sitio
// y modelo activo. Devuelve el usuario y la configuración, o la respuesta de
// error lista para devolver.

import { NextResponse } from "next/server";
import { configIaActiva } from "@/lib/ia/config";
import { DIA } from "@/lib/ia/cupo";
import { consumirPreguntaDiaria, respuestaLimiteDiario } from "@/lib/ia/cupo-servidor";
import type { ConfigIa } from "@/lib/ia/proveedor";
import { consumirCupo } from "@/lib/rate-limit";
import { usuarioActual } from "@/lib/sesion";

const MAX_RESPUESTAS_MINUTO = Number.parseInt(process.env.LLM_CUOTA_MINUTO ?? "", 10) || 3;
const MAX_RESPUESTAS_DIA_SITIO = Number.parseInt(process.env.LLM_CUOTA_DIARIA_SITIO ?? "", 10) || 1000;

type Usuario = NonNullable<Awaited<ReturnType<typeof usuarioActual>>>;

export async function exigirSesion(): Promise<{ usuario: Usuario } | { error: NextResponse }> {
  const usuario = await usuarioActual();
  if (!usuario) return { error: NextResponse.json({ error: "sesion_requerida" }, { status: 401 }) };
  if (!usuario.perfilCompleto) return { error: NextResponse.json({ error: "perfil_incompleto" }, { status: 403 }) };
  return { usuario };
}

/** Cupo del día. Va después de validar la entrada: una solicitud mal formada no cuenta. */
export async function descontarDelDia(usuario: Usuario): Promise<{ restantesHoy: number | null } | { error: NextResponse }> {
  const cupo = await consumirPreguntaDiaria(usuario);
  if (!cupo.permitido) return { error: respuestaLimiteDiario() };
  return { restantesHoy: cupo.restantesHoy };
}

/** Modelo activo, ráfaga por persona y techo del sitio, antes de llamar al modelo. */
export async function prepararModelo(usuario: Usuario): Promise<{ config: ConfigIa } | { error: NextResponse }> {
  const config = await configIaActiva();
  if (!config) return { error: NextResponse.json({ error: "ia_no_configurada" }, { status: 503 }) };
  const rafaga = await consumirCupo(`ia:min:${usuario.id}`, MAX_RESPUESTAS_MINUTO, 60);
  if (!rafaga.permitido) {
    return {
      error: NextResponse.json(
        { error: "demasiado_rapido", mensaje: "Vas muy rápido. Espera unos segundos." },
        { status: 429, headers: { "Retry-After": String(rafaga.reinicioEn) } }
      ),
    };
  }
  const techo = await consumirCupo("ia:sitio", MAX_RESPUESTAS_DIA_SITIO, DIA);
  if (!techo.permitido) {
    return {
      error: NextResponse.json(
        { error: "techo_sitio", mensaje: "El asistente alcanzó su tope de hoy. Vuelve a intentarlo mañana." },
        { status: 503 }
      ),
    };
  }
  return { config };
}
