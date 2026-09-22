// Acciones del panel sobre planes, clientes y modelos de IA.
//
// Formularios HTML que postean acá y vuelven a la página de origen (`volver`,
// siempre una ruta /admin/…) con un mensaje, igual que la agenda. Mientras no
// haya pasarela de pago, esta es la única forma de activar un plan: después de
// cobrar (transferencia, link de pago), se registra acá con monto y referencia.

import { NextRequest, NextResponse } from "next/server";
import {
  ErrorPanel,
  agregarMiembro,
  ajustarCreditos,
  asignarPlan,
  cambiarVencimiento,
  cancelarSuscripcion,
  cargarPack,
  quitarMiembro,
  registrarPago,
} from "@/lib/creditos";
import {
  ErrorModelo,
  activarModelo,
  desactivarModelos,
  eliminarModelo,
  guardarModelo,
  probarModelo,
} from "@/lib/ia/config";
import { esIdPack, esIdPlan } from "@/lib/planes";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const runtime = "nodejs";
// La prueba de un modelo llama al proveedor: puede tardar varios segundos.
export const maxDuration = 60;

function numero(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function decimal(v: string): number {
  return Number(v.trim().replace(",", "."));
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !esAdmin(usuario.email)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 404 });
  }

  const form = await req.formData();
  const campo = (n: string) => (form.get(n)?.toString() ?? "").trim();
  // Solo rutas del panel: un `volver` externo sería un open redirect.
  const destino = /^\/admin(\/[\w\-/]*)?$/.test(campo("volver")) ? campo("volver") : "/admin/planes";
  const volver = (params: Record<string, string>) =>
    NextResponse.redirect(new URL(`${destino}?${new URLSearchParams(params)}`, req.url), 303);
  const pago = () => ({
    montoClp: numero(campo("monto")),
    medio: campo("medio"),
    referencia: campo("referencia"),
    fechaPago: campo("fechaPago") || null,
  });

  try {
    switch (campo("accion")) {
      // ── Suscripciones y créditos ────────────────────────────────────────
      case "asignar": {
        const plan = campo("plan");
        if (!esIdPlan(plan)) throw new ErrorPanel("Plan desconocido.");
        await asignarPlan({
          email: campo("email"),
          plan,
          meses: Number.parseInt(campo("meses") || "1", 10),
          admin: usuario.email,
          nota: campo("nota"),
          ...pago(),
        });
        return volver({ ok: `Plan asignado a ${campo("email")} y pago registrado.` });
      }
      case "miembro":
        await agregarMiembro(campo("suscripcionId"), campo("email"));
        return volver({ ok: `${campo("email")} agregado al equipo.` });
      case "quitar_miembro":
        await quitarMiembro(campo("suscripcionId"), campo("email"));
        return volver({ ok: "Miembro quitado." });
      case "cancelar":
        await cancelarSuscripcion(campo("suscripcionId"), usuario.email);
        return volver({ ok: "Suscripción cancelada." });
      case "vencimiento":
        await cambiarVencimiento(campo("suscripcionId"), campo("venceEn"), usuario.email);
        return volver({ ok: "Vencimiento actualizado." });
      case "pack": {
        const pack = campo("pack");
        if (!esIdPack(pack)) throw new ErrorPanel("Pack desconocido.");
        await cargarPack({ email: campo("email"), pack, admin: usuario.email, ...pago() });
        return volver({ ok: `Pack cargado a ${campo("email")} y pago registrado.` });
      }
      case "pago": {
        const concepto = campo("concepto");
        if (concepto !== "plan" && concepto !== "pack" && concepto !== "otro") throw new ErrorPanel("Concepto desconocido.");
        await registrarPago({ email: campo("email"), concepto, detalle: campo("detalle"), admin: usuario.email, ...pago() });
        return volver({ ok: "Pago registrado." });
      }
      case "ajuste":
        await ajustarCreditos({
          email: campo("email"),
          creditos: Number.parseInt(campo("creditos"), 10),
          nota: campo("nota"),
          admin: usuario.email,
        });
        return volver({ ok: `Créditos ajustados a ${campo("email")}.` });

      // ── Modelos de IA ───────────────────────────────────────────────────
      case "modelo_guardar": {
        const id = await guardarModelo({
          id: campo("id") || undefined,
          nombre: campo("nombre"),
          baseUrl: campo("baseUrl"),
          modelo: campo("modelo"),
          envClave: campo("envClave"),
          usdMillonEntrada: decimal(campo("usdEntrada")),
          usdMillonSalida: decimal(campo("usdSalida")),
          notas: campo("notas"),
        });
        return volver({ ok: `Modelo ${id} guardado. Pruébalo antes de activarlo.` });
      }
      case "modelo_probar": {
        const p = await probarModelo(campo("id"));
        return volver(
          p.ok
            ? { ok: `Prueba OK: ${p.latenciaMs} ms, ${p.creditos} crédito(s) por consulta.` }
            : { error: `La prueba falló: ${p.error}` }
        );
      }
      case "modelo_activar":
        await activarModelo(campo("id"));
        return volver({ ok: `Modelo ${campo("id")} activo. Las próximas consultas lo usan (en menos de 30 s).` });
      case "modelo_desactivar":
        await desactivarModelos();
        return volver({ ok: "Sin modelo activo: se usan las variables LLM_* de Railway." });
      case "modelo_eliminar":
        await eliminarModelo(campo("id"));
        return volver({ ok: "Modelo eliminado del catálogo." });

      default:
        throw new ErrorPanel("Acción desconocida.");
    }
  } catch (e) {
    if (e instanceof ErrorPanel || e instanceof ErrorModelo) return volver({ error: e.message });
    console.error("[admin/planes]", e);
    return volver({ error: "No se pudo guardar. Revisa el log del servicio." });
  }
}
