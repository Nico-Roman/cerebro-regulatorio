// Clientes: todos los usuarios con su plan, uso, créditos, pagos y margen, y
// arriba las métricas del negocio (MRR, churn, ARPU, LTV) con la serie de 12
// meses. Cada fila abre la ficha del cliente, donde se administra su
// suscripción.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraficoMeses } from "@/components/grafico-meses";
import { listaClientes, metricasNegocio, serieMensual } from "@/lib/clientes";
import { PLANES, formatoClp, formatoMiles } from "@/lib/planes";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Clientes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FILTROS = [
  { id: "todos", etiqueta: "Todos" },
  { id: "pagos", etiqueta: "Con plan pagado" },
  { id: "profesional", etiqueta: "Profesional" },
  { id: "director_tecnico", etiqueta: "Director Técnico" },
  { id: "gratis", etiqueta: "Gratis" },
  { id: "pagaron", etiqueta: "Alguna vez pagaron" },
];

function pct(x: number | null): string {
  return x === null ? "—" : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)} %`;
}

function Tarjeta({ valor, etiqueta, detalle }: { valor: string; etiqueta: string; detalle?: string }) {
  return (
    <div className="border border-line px-4 py-3">
      <div className="font-display text-2xl">{valor}</div>
      <div className="label-micro mt-1 text-muted">{etiqueta}</div>
      {detalle && <div className="mt-1 text-xs text-muted">{detalle}</div>}
    </div>
  );
}

const ETIQUETA_PLAN = {
  gratis: "text-muted",
  profesional: "text-sky-300",
  director_tecnico: "text-amber-200",
} as const;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?next=/admin/clientes");
  if (!esAdmin(usuario.email)) redirect("/");

  const params = await searchParams;
  const filtro = FILTROS.find((f) => f.id === params.filtro)?.id ?? "todos";
  const [m, serie, clientes] = await Promise.all([
    metricasNegocio(),
    serieMensual(12),
    listaClientes({ q: params.q, filtro }),
  ]);
  const csv = new URLSearchParams({ tipo: "clientes", ...(params.q ? { q: params.q } : {}), filtro });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="label-micro text-muted underline">
          ← Panel
        </Link>
        <h1 className="font-display text-3xl tracking-tight">Clientes</h1>
        <p className="text-xs text-muted">
          Neto = sin IVA ni comisión de pago. Margen = neto − costo de IA (no incluye Railway). Montos en pesos.
        </p>
      </header>

      {/* ── Métricas ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Tarjeta valor={formatoMiles(m.usuarios)} etiqueta="usuarios" />
        <Tarjeta
          valor={formatoMiles(m.clientesActivos)}
          etiqueta="clientes pagos"
          detalle={`${m.porPlan.profesional} Prof. · ${m.porPlan.director_tecnico} DT`}
        />
        <Tarjeta valor={formatoClp(m.mrrClp)} etiqueta="MRR bruto" />
        <Tarjeta valor={m.arpuNetoClp === null ? "—" : formatoClp(m.arpuNetoClp)} etiqueta="ARPU neto / mes" />
        <Tarjeta
          valor={pct(m.churn30)}
          etiqueta="churn 30 días"
          detalle={m.activosHace30 ? `${m.bajas30} de ${m.activosHace30}` : "sin base aún"}
        />
        <Tarjeta
          valor={m.ltvEstimadoClp === null ? "—" : formatoClp(m.ltvEstimadoClp)}
          etiqueta="LTV estimado"
          detalle={m.ltvEstimadoClp === null ? "necesita al menos una baja" : "ARPU × margen ÷ churn"}
        />
        <Tarjeta
          valor={m.ltvHistoricoClp === null ? "—" : formatoClp(m.ltvHistoricoClp)}
          etiqueta="LTV histórico"
          detalle={`margen medio de ${m.clientesQuePagaron} que pagaron`}
        />
        <Tarjeta
          valor={pct(m.margen30)}
          etiqueta="margen 30 días"
          detalle={`${formatoClp(m.neto30Clp)} neto − ${formatoClp(m.costoIa30Clp)} IA`}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <GraficoMeses
          titulo="Últimos 12 meses"
          etiquetaA="Ingreso neto"
          etiquetaB="Costo IA"
          puntos={serie.map((s) => ({ mes: s.mes, a: s.netoClp, b: s.costoIaClp }))}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="label-micro text-muted">
              <tr>
                <th className="py-1 pr-3">Mes</th>
                <th className="py-1 pr-3">Preg.</th>
                <th className="py-1 pr-3">IA</th>
                <th className="py-1 pr-3">Créd.</th>
                <th className="py-1 pr-3">Nuevos</th>
                <th className="py-1">Clientes</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((s) => (
                <tr key={s.mes} className="border-t border-line">
                  <td className="py-1 pr-3">{s.mes}</td>
                  <td className="py-1 pr-3">{formatoMiles(s.preguntas)}</td>
                  <td className="py-1 pr-3">{formatoMiles(s.redacciones)}</td>
                  <td className="py-1 pr-3">{formatoMiles(s.creditos)}</td>
                  <td className="py-1 pr-3">{formatoMiles(s.usuariosNuevos)}</td>
                  <td className="py-1">{formatoMiles(s.clientesNuevos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.costoPorRedaccionClp !== null && (
            <p className="mt-2 text-xs text-muted">
              Costo medio por redacción (30 d): ${m.costoPorRedaccionClp.toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>
      </section>

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <form className="flex flex-wrap items-center gap-2" action="/admin/clientes">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="buscar por correo, nombre o empresa"
            className="min-w-64 flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <input type="hidden" name="filtro" value={filtro} />
          <button className="border border-line px-4 py-2 text-xs hover:border-foreground">Buscar</button>
          <a href={`/api/admin/export?${csv}`} className="text-xs text-muted underline hover:text-foreground">
            CSV
          </a>
        </form>
        <nav className="flex flex-wrap gap-2 text-xs">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={`/admin/clientes?${new URLSearchParams({ filtro: f.id, ...(params.q ? { q: params.q } : {}) })}`}
              className={`border px-3 py-1.5 ${
                filtro === f.id ? "border-foreground text-foreground" : "border-line text-muted hover:border-foreground"
              }`}
            >
              {f.etiqueta}
            </Link>
          ))}
        </nav>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="label-micro text-muted">
              <tr>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Registro</th>
                <th className="py-2 pr-4">1ª suscr.</th>
                <th className="py-2 pr-4 text-right">Preguntas</th>
                <th className="py-2 pr-4 text-right">IA</th>
                <th className="py-2 pr-4 text-right">Créd. mes</th>
                <th className="py-2 pr-4 text-right">Pack</th>
                <th className="py-2 pr-4 text-right">Pagado</th>
                <th className="py-2 pr-4 text-right">Costo IA</th>
                <th className="py-2 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-white/[0.03]">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/clientes/${c.id}`} className="hover:underline">
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-xs text-muted">
                        {c.email}
                        {c.empresa ? ` · ${c.empresa}` : ""}
                      </div>
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={ETIQUETA_PLAN[c.plan]}>{PLANES[c.plan].nombre}</span>
                    {c.venceEn && <div className="text-xs text-muted">vence {c.venceEn}</div>}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted">{c.registrado}</td>
                  <td className="py-2 pr-4 text-xs text-muted">{c.primeraSuscripcion ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">
                    {formatoMiles(c.preguntas)}
                    <div className="text-xs text-muted">{formatoMiles(c.preguntas30d)} en 30 d</div>
                  </td>
                  <td className="py-2 pr-4 text-right">{formatoMiles(c.redaccionesIa)}</td>
                  <td className="py-2 pr-4 text-right">{formatoMiles(c.creditosMes)}</td>
                  <td className="py-2 pr-4 text-right">{c.saldoPack ? formatoMiles(c.saldoPack) : "—"}</td>
                  <td className="py-2 pr-4 text-right">{c.pagadoBrutoClp ? formatoClp(c.pagadoBrutoClp) : "—"}</td>
                  <td className="py-2 pr-4 text-right">{formatoClp(c.costoIaClp)}</td>
                  <td className={`py-2 text-right ${c.margenClp < 0 ? "text-red-300" : ""}`}>
                    {formatoClp(c.margenClp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientes.length === 0 && <p className="py-6 text-sm text-muted">Nadie coincide con ese filtro.</p>}
        </div>
      </section>
    </main>
  );
}
