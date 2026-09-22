// Ficha de un cliente: su plan, sus suscripciones con fechas, lo que pagó, lo
// que gastó en créditos, lo que costó atenderlo y su uso mes a mes. Desde acá
// se administra la suscripción (renovar, cambiar de plan, vencimiento, equipo,
// cancelar) y se cargan packs o pagos.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BOTON, FormAjuste, FormAsignarPlan, FormCargarPack, FormPago, INPUT } from "@/components/admin-formularios";
import { GraficoMeses } from "@/components/grafico-meses";
import { fichaCliente } from "@/lib/clientes";
import { estadoCreditos } from "@/lib/creditos";
import { PLANES, formatoClp, formatoMiles } from "@/lib/planes";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Ficha de cliente",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="border border-line px-4 py-3">
      <div className="font-display text-xl">{valor}</div>
      <div className="label-micro mt-1 text-muted">{etiqueta}</div>
      {detalle && <div className="mt-1 text-xs text-muted">{detalle}</div>}
    </div>
  );
}

function Oculto({ campos }: { campos: Record<string, string> }) {
  return (
    <>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

const TIPO_MOV: Record<string, string> = {
  consumo: "consulta",
  ajuste_consumo: "consulta (extra)",
  reembolso: "devolución",
  compra: "compra de pack",
  ajuste: "ajuste manual",
};

export default async function FichaClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const usuario = await usuarioActual();
  const { id } = await params;
  if (!usuario) redirect(`/ingresar?next=/admin/clientes/${id}`);
  if (!esAdmin(usuario.email)) redirect("/");

  const [ficha, saldo, mensajes] = await Promise.all([fichaCliente(id), estadoCreditos(id), searchParams]);
  if (!ficha) notFound();
  const c = ficha.cliente;
  const volver = `/admin/clientes/${id}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin/clientes" className="label-micro text-muted underline">
          ← Clientes
        </Link>
        <h1 className="font-display text-3xl tracking-tight">{c.nombre}</h1>
        <p className="text-sm text-muted">
          {c.email}
          {ficha.telefono ? ` · ${ficha.telefono}` : ""}
          {c.empresa ? ` · ${c.empresa}` : ""} · registrado {c.registrado}
          {c.ultimaActividad ? ` · última actividad ${c.ultimaActividad}` : ""}
        </p>
        {mensajes.ok && <p className="text-sm text-emerald-300">{mensajes.ok}</p>}
        {mensajes.error && <p className="text-sm text-red-300">{mensajes.error}</p>}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato
          etiqueta="plan"
          valor={saldo.plan.nombre}
          detalle={saldo.venceEn ? `vence ${saldo.venceEn.slice(0, 10)}` : undefined}
        />
        <Dato
          etiqueta="quedan este mes"
          valor={formatoMiles(saldo.restantes.mes)}
          detalle={`${formatoMiles(saldo.restantes.hoy)} hoy · de ${formatoMiles(saldo.plan.creditosMes)}`}
        />
        <Dato etiqueta="saldo pack" valor={formatoMiles(saldo.restantes.pack)} />
        <Dato etiqueta="preguntas" valor={formatoMiles(c.preguntas)} detalle={`${formatoMiles(c.preguntas30d)} en 30 d`} />
        <Dato etiqueta="redacciones IA" valor={formatoMiles(c.redaccionesIa)} />
        <Dato etiqueta="créditos usados" valor={formatoMiles(c.creditosUsados)} detalle={`${formatoMiles(c.creditosMes)} este mes`} />
        <Dato
          etiqueta="pagado"
          valor={formatoClp(c.pagadoBrutoClp)}
          detalle={`${formatoClp(c.pagadoNetoClp)} neto · ${c.pagos} pago(s)`}
        />
        <Dato
          etiqueta="LTV (margen)"
          valor={formatoClp(c.margenClp)}
          detalle={`costo IA ${formatoClp(c.costoIaClp)}`}
        />
      </section>

      {/* ── Suscripciones ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl tracking-tight">Suscripciones</h2>
        {ficha.suscripciones.length === 0 && <p className="text-sm text-muted">Nunca tuvo un plan pagado.</p>}
        <ul className="flex flex-col gap-3">
          {ficha.suscripciones.map((s) => {
            const plan = PLANES[s.plan];
            const vigente = s.estado === "activa" && new Date(`${s.venceEn}T23:59:59`) > new Date();
            return (
              <li key={s.id} className={`flex flex-col gap-3 border p-4 text-sm ${vigente ? "border-foreground" : "border-line"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <strong className="font-medium">{plan.nombre}</strong>{" "}
                    <span className="text-xs text-muted">({s.rol})</span>{" "}
                    <span className={vigente ? "text-emerald-300" : "text-muted"}>
                      {vigente
                        ? "● vigente"
                        : s.motivoFin === "reemplazada"
                          ? "cambió de plan"
                          : s.estado === "cancelada"
                            ? "cancelada"
                            : "vencida"}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    alta {s.vigenteDesde} · vence {s.venceEn}
                    {s.canceladaEn ? ` · terminó ${s.canceladaEn}` : ""}
                  </span>
                </div>
                {s.nota && <p className="text-xs text-muted">{s.nota}</p>}

                {plan.maxMiembros > 1 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted">
                      Equipo {s.miembros.length}/{plan.maxMiembros}:
                    </span>
                    {s.miembros.map((m) => (
                      <span key={m} className="flex items-center gap-1 border border-line px-2 py-1">
                        {m}
                        {vigente && s.rol === "titular" && m !== c.email && (
                          <form action="/api/admin/planes" method="post">
                            <Oculto campos={{ accion: "quitar_miembro", suscripcionId: s.id, email: m, volver }} />
                            <button className="text-muted hover:text-red-300" aria-label={`Quitar ${m}`}>
                              ×
                            </button>
                          </form>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {vigente && (
                  <div className="flex flex-wrap items-end gap-3">
                    {plan.maxMiembros > 1 && s.miembros.length < plan.maxMiembros && (
                      <form action="/api/admin/planes" method="post" className="flex gap-2">
                        <Oculto campos={{ accion: "miembro", suscripcionId: s.id, volver }} />
                        <input name="email" type="email" required placeholder="correo del miembro" className={INPUT} />
                        <button className={BOTON}>Agregar</button>
                      </form>
                    )}
                    <form action="/api/admin/planes" method="post" className="flex gap-2">
                      <Oculto campos={{ accion: "vencimiento", suscripcionId: s.id, volver }} />
                      <input name="venceEn" type="date" required defaultValue={s.venceEn} className={INPUT} />
                      <button className={BOTON}>Cambiar vencimiento</button>
                    </form>
                    <form action="/api/admin/planes" method="post" className="ml-auto">
                      <Oculto campos={{ accion: "cancelar", suscripcionId: s.id, volver }} />
                      <button className="text-xs text-muted underline hover:text-red-300">Cancelar suscripción</button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FormAsignarPlan email={c.email} volver={volver} />
        <FormCargarPack email={c.email} volver={volver} />
        <FormAjuste email={c.email} volver={volver} />
        <FormPago email={c.email} volver={volver} />
      </section>

      {/* ── Uso mes a mes ─────────────────────────────────────────────── */}
      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <GraficoMeses
          titulo="Pagado vs. costo de IA, por mes"
          etiquetaA="Pagado (bruto)"
          etiquetaB="Costo IA"
          puntos={ficha.meses.map((m) => ({ mes: m.mes, a: m.pagadoClp, b: m.costoClp }))}
        />
        <table className="w-full text-left text-xs">
          <thead className="label-micro text-muted">
            <tr>
              <th className="py-1 pr-3">Mes</th>
              <th className="py-1 pr-3 text-right">Preg.</th>
              <th className="py-1 pr-3 text-right">IA</th>
              <th className="py-1 pr-3 text-right">Créd.</th>
              <th className="py-1 text-right">Costo</th>
            </tr>
          </thead>
          <tbody>
            {ficha.meses.map((m) => (
              <tr key={m.mes} className="border-t border-line">
                <td className="py-1 pr-3">{m.mes}</td>
                <td className="py-1 pr-3 text-right">{formatoMiles(m.preguntas)}</td>
                <td className="py-1 pr-3 text-right">{formatoMiles(m.redacciones)}</td>
                <td className="py-1 pr-3 text-right">{formatoMiles(m.creditos)}</td>
                <td className="py-1 text-right">{formatoClp(m.costoClp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Pagos y movimientos ───────────────────────────────────────── */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="label-micro text-muted">Pagos ({ficha.pagos.length})</h2>
          <table className="w-full text-left text-xs">
            <tbody>
              {ficha.pagos.map((p, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 text-muted">{p.fecha}</td>
                  <td className="py-1.5 pr-3">
                    {p.concepto}
                    {p.detalle ? ` · ${p.detalle}` : ""}
                    <div className="text-muted">
                      {[p.medio, p.referencia, p.registradoPor].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className={`py-1.5 text-right ${p.montoClp < 0 ? "text-red-300" : ""}`}>{formatoClp(p.montoClp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ficha.pagos.length === 0 && <p className="text-xs text-muted">Sin pagos.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="label-micro text-muted">Movimientos de créditos (últimos 100)</h2>
          <div className="max-h-96 overflow-y-auto border-b border-line">
          <table className="w-full text-left text-xs">
            <tbody>
              {ficha.movimientos.map((m, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 text-muted">{m.fecha}</td>
                  <td className="py-1.5 pr-3">
                    {TIPO_MOV[m.tipo] ?? m.tipo} <span className="text-muted">· {m.fuente}</span>
                    {m.nota && <div className="text-muted">{m.nota}</div>}
                  </td>
                  <td className={`py-1.5 text-right ${m.creditos < 0 ? "" : "text-emerald-300"}`}>
                    {m.creditos > 0 ? `+${formatoMiles(m.creditos)}` : `-${formatoMiles(-m.creditos)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {ficha.movimientos.length === 0 && <p className="text-xs text-muted">Sin movimientos.</p>}
        </div>
      </section>
    </main>
  );
}
