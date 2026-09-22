// Formularios del panel para planes, packs, pagos y créditos. HTML puro que
// postea a /api/admin/planes: los usan /admin/planes (con campo de correo) y la
// ficha de cada cliente (con el correo ya puesto).

import type { ReactNode } from "react";
import { PACKS, PLANES, formatoClp } from "@/lib/planes";

export const INPUT = "w-full min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";
export const BOTON =
  "border border-foreground px-4 py-2 text-xs transition-colors hover:bg-foreground hover:text-background";

const MEDIOS = ["transferencia", "link de pago", "flow", "mercadopago", "efectivo", "cortesia"];

function Caja({ titulo, children, ayuda }: { titulo: string; children: ReactNode; ayuda?: string }) {
  return (
    <form action="/api/admin/planes" method="post" className="flex flex-col gap-3 border border-line p-4">
      <h3 className="label-micro text-muted">{titulo}</h3>
      {children}
      {ayuda && <p className="text-xs text-muted">{ayuda}</p>}
    </form>
  );
}

function Correo({ email }: { email?: string }) {
  return email ? (
    <input type="hidden" name="email" value={email} />
  ) : (
    <input name="email" type="email" required placeholder="correo de la cuenta" className={INPUT} />
  );
}

function CamposPago({ montoSugerido }: { montoSugerido?: string }) {
  return (
    <>
      <input
        name="monto"
        inputMode="numeric"
        required={!montoSugerido}
        placeholder={montoSugerido ? `monto pagado (vacío = ${montoSugerido})` : "monto pagado, IVA incluido"}
        className={INPUT}
      />
      <div className="grid grid-cols-2 gap-2">
        <select name="medio" className={INPUT} defaultValue="transferencia">
          {MEDIOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input name="fechaPago" type="date" className={`${INPUT} px-2`} title="Fecha del pago (vacío = hoy)" />
      </div>
      <input name="referencia" placeholder="referencia (n° de transferencia, boleta…)" className={INPUT} />
    </>
  );
}

export function FormAsignarPlan({ email, volver }: { email?: string; volver: string }) {
  return (
    <Caja
      titulo="Asignar o renovar plan"
      ayuda="Mismo plan vigente: suma meses. Otro plan: reemplaza al anterior (no cuenta como baja). Registra el pago."
    >
      <input type="hidden" name="accion" value="asignar" />
      <input type="hidden" name="volver" value={volver} />
      <Correo email={email} />
      <div className="flex gap-2">
        <select name="plan" className={`${INPUT} flex-1`} defaultValue="profesional">
          <option value="profesional">Profesional · {formatoClp(PLANES.profesional.precioMensualClp)}</option>
          <option value="director_tecnico">
            Director Técnico · {formatoClp(PLANES.director_tecnico.precioMensualClp)}
          </option>
        </select>
        <input name="meses" type="number" min={1} max={24} defaultValue={1} className={`${INPUT} !w-16 shrink-0`} title="meses" />
      </div>
      <CamposPago montoSugerido="precio × meses" />
      <button className={BOTON}>Guardar</button>
    </Caja>
  );
}

export function FormCargarPack({ email, volver }: { email?: string; volver: string }) {
  return (
    <Caja titulo="Cargar pack">
      <input type="hidden" name="accion" value="pack" />
      <input type="hidden" name="volver" value={volver} />
      <Correo email={email} />
      <select name="pack" className={INPUT}>
        {Object.values(PACKS).map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} · {formatoClp(p.precioClp)}
          </option>
        ))}
      </select>
      <CamposPago montoSugerido="precio del pack" />
      <button className={BOTON}>Cargar</button>
    </Caja>
  );
}

export function FormAjuste({ email, volver }: { email?: string; volver: string }) {
  return (
    <Caja titulo="Regalar o corregir créditos" ayuda="Se suman al saldo de pack (no vencen). No es un pago.">
      <input type="hidden" name="accion" value="ajuste" />
      <input type="hidden" name="volver" value={volver} />
      <Correo email={email} />
      <input name="creditos" type="number" required placeholder="ej. 50 o -10" className={INPUT} />
      <input name="nota" placeholder="motivo" className={INPUT} />
      <button className={BOTON}>Aplicar</button>
    </Caja>
  );
}

export function FormPago({ email, volver }: { email?: string; volver: string }) {
  return (
    <Caja
      titulo="Registrar pago suelto"
      ayuda="Para un pago que faltó registrar, o una devolución (monto negativo). No activa nada."
    >
      <input type="hidden" name="accion" value="pago" />
      <input type="hidden" name="volver" value={volver} />
      <Correo email={email} />
      <select name="concepto" className={INPUT} defaultValue="plan">
        <option value="plan">plan</option>
        <option value="pack">pack</option>
        <option value="otro">otro</option>
      </select>
      <input name="detalle" placeholder="detalle (ej. profesional)" className={INPUT} />
      <CamposPago />
      <button className={BOTON}>Registrar</button>
    </Caja>
  );
}
