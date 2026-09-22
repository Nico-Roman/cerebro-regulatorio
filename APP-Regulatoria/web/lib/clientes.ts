// Clientes y métricas de negocio para el panel: quién tiene qué plan, cuánto
// preguntó, cuántos créditos gastó, cuánto pagó y cuánto costó atenderlo.
//
// Todo sale de cuatro tablas que ya existen: `consultas` (preguntas y costo de
// cada redacción, 0009), `movimientos_creditos` (créditos), `suscripciones`
// (fechas de alta, vencimiento y baja) y `pagos` (lo que entró). Nada se
// estima con precios de lista: el ingreso es lo pagado y el costo es lo que
// cobró el modelo que respondió.
//
// Definiciones (las mismas en pantalla y en el CSV):
//   neto        = bruto sin IVA y sin comisión de pago (netoClp).
//   margen      = neto − costo de IA. No incluye Railway ni tu tiempo.
//   LTV cliente = margen acumulado de ese cliente desde su primer pago.
//   MRR         = suma del precio mensual de las suscripciones vigentes.
//   churn 30 d  = clientes pagos hace 30 días que hoy ya no tienen plan
//                 (un cambio de plan no es baja).
//   LTV estimado = ARPU neto mensual × margen % ÷ churn mensual.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { COSTO_CONSULTA_CLP } from "@/lib/creditos";
import { ECONOMIA, PLANES, esIdPlan, netoClp, type IdPlan } from "@/lib/planes";

const ZONA = "America/Santiago";

/** Factor bruto → neto. netoClp es lineal, así que sirve sobre sumas. */
const FACTOR_NETO = netoClp(1);

const RANGO_SQL = sql.raw(
  `CASE s.plan WHEN 'director_tecnico' THEN 2 WHEN 'profesional' THEN 1 ELSE 0 END`
);

export interface FilaCliente {
  [campo: string]: unknown;
  id: string;
  nombre: string;
  email: string;
  empresa: string | null;
  registrado: string;
  plan: IdPlan;
  venceEn: string | null;
  primeraSuscripcion: string | null;
  preguntas: number;
  preguntas30d: number;
  redaccionesIa: number;
  creditosUsados: number;
  creditosMes: number;
  saldoPack: number;
  pagos: number;
  pagadoBrutoClp: number;
  pagadoNetoClp: number;
  costoIaClp: number;
  margenClp: number;
  ultimaActividad: string | null;
}

export async function listaClientes(opts: { q?: string; filtro?: string; limite?: number } = {}): Promise<FilaCliente[]> {
  const q = opts.q?.trim();
  const busqueda = q
    ? sql`AND (u.email ILIKE ${"%" + q + "%"} OR u.name ILIKE ${"%" + q + "%"} OR p.empresa ILIKE ${"%" + q + "%"})`
    : sql``;
  const filtro =
    opts.filtro === "pagos"
      ? sql`AND pa.plan IS NOT NULL`
      : opts.filtro === "gratis"
        ? sql`AND pa.plan IS NULL`
        : opts.filtro === "pagaron"
          ? sql`AND COALESCE(pg.bruto, 0) > 0`
          : opts.filtro && esIdPlan(opts.filtro) && opts.filtro !== "gratis"
            ? sql`AND pa.plan = ${opts.filtro}`
            : sql``;

  const { rows } = await db.execute<{
    id: string;
    nombre: string;
    email: string;
    empresa: string | null;
    registrado: string;
    plan: string | null;
    vence_en: string | null;
    primera: string | null;
    preguntas: number;
    preguntas30: number;
    ia: number;
    costo: number;
    ultima: string | null;
    usados: number;
    usados_mes: number;
    saldo_pack: number;
    n_pagos: number;
    bruto: number;
  }>(sql`
    WITH plan_actual AS (
      SELECT DISTINCT ON (m.user_id) m.user_id, s.plan, s.vence_en
      FROM suscripcion_miembros m JOIN suscripciones s ON s.id = m.suscripcion_id
      WHERE s.estado = 'activa' AND s.vence_en > now() AND s.vigente_desde <= now()
      ORDER BY m.user_id, ${RANGO_SQL} DESC, s.vence_en DESC
    ),
    uso AS (
      SELECT user_id, COUNT(*)::int AS preguntas,
        COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS preguntas30,
        COUNT(*) FILTER (WHERE respuesta_llm IS NOT NULL)::int AS ia,
        COALESCE(SUM(${COSTO_CONSULTA_CLP}) FILTER (WHERE respuesta_llm IS NOT NULL), 0)::float AS costo,
        MAX(created_at) AS ultima
      FROM consultas GROUP BY user_id
    ),
    cred AS (
      SELECT user_id,
        COALESCE(-SUM(creditos) FILTER (WHERE tipo IN ('consumo', 'ajuste_consumo', 'reembolso')), 0)::int AS usados,
        COALESCE(-SUM(creditos) FILTER (WHERE tipo IN ('consumo', 'ajuste_consumo', 'reembolso')
          AND created_at >= (date_trunc('month', now() AT TIME ZONE ${ZONA}) AT TIME ZONE ${ZONA})), 0)::int AS usados_mes,
        COALESCE(SUM(creditos) FILTER (WHERE fuente = 'pack'), 0)::int AS saldo_pack
      FROM movimientos_creditos GROUP BY user_id
    ),
    pg AS (
      SELECT user_id, COUNT(*)::int AS n, COALESCE(SUM(monto_clp), 0)::bigint AS bruto FROM pagos GROUP BY user_id
    ),
    primera AS (
      SELECT m.user_id, MIN(s.vigente_desde) AS primera
      FROM suscripcion_miembros m JOIN suscripciones s ON s.id = m.suscripcion_id GROUP BY m.user_id
    )
    SELECT
      u.id, u.name AS nombre, u.email, p.empresa,
      to_char(u.created_at AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS registrado,
      pa.plan, to_char(pa.vence_en AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS vence_en,
      to_char(pr.primera AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS primera,
      COALESCE(us.preguntas, 0) AS preguntas, COALESCE(us.preguntas30, 0) AS preguntas30,
      COALESCE(us.ia, 0) AS ia, COALESCE(us.costo, 0) AS costo,
      to_char(us.ultima AT TIME ZONE ${ZONA}, 'YYYY-MM-DD HH24:MI') AS ultima,
      COALESCE(cr.usados, 0) AS usados, COALESCE(cr.usados_mes, 0) AS usados_mes,
      COALESCE(cr.saldo_pack, 0) AS saldo_pack,
      COALESCE(pg.n, 0) AS n_pagos, COALESCE(pg.bruto, 0) AS bruto
    FROM "user" u
    LEFT JOIN perfil p ON p.user_id = u.id
    LEFT JOIN plan_actual pa ON pa.user_id = u.id
    LEFT JOIN uso us ON us.user_id = u.id
    LEFT JOIN cred cr ON cr.user_id = u.id
    LEFT JOIN pg ON pg.user_id = u.id
    LEFT JOIN primera pr ON pr.user_id = u.id
    WHERE true ${busqueda} ${filtro}
    ORDER BY COALESCE(pg.bruto, 0) DESC, (pa.plan IS NULL), us.ultima DESC NULLS LAST
    LIMIT ${opts.limite ?? 500}
  `);

  return rows.map((r) => {
    const bruto = Number(r.bruto);
    const neto = bruto * FACTOR_NETO;
    const costo = Number(r.costo);
    return {
      id: r.id,
      nombre: r.nombre,
      email: r.email,
      empresa: r.empresa,
      registrado: r.registrado,
      plan: esIdPlan(r.plan) ? r.plan : "gratis",
      venceEn: r.vence_en,
      primeraSuscripcion: r.primera,
      preguntas: Number(r.preguntas),
      preguntas30d: Number(r.preguntas30),
      redaccionesIa: Number(r.ia),
      creditosUsados: Number(r.usados),
      creditosMes: Number(r.usados_mes),
      saldoPack: Math.max(0, Number(r.saldo_pack)),
      pagos: Number(r.n_pagos),
      pagadoBrutoClp: bruto,
      pagadoNetoClp: Math.round(neto),
      costoIaClp: Math.round(costo),
      margenClp: Math.round(neto - costo),
      ultimaActividad: r.ultima,
    };
  });
}

// ─── Ficha de un cliente ────────────────────────────────────────────────────

export interface SuscripcionFicha {
  id: string;
  plan: IdPlan;
  rol: "titular" | "miembro";
  estado: string;
  motivoFin: string | null;
  vigenteDesde: string;
  venceEn: string;
  canceladaEn: string | null;
  miembros: string[];
  nota: string | null;
}

export interface PagoFicha {
  fecha: string;
  concepto: string;
  detalle: string | null;
  montoClp: number;
  medio: string | null;
  referencia: string | null;
  registradoPor: string | null;
}

export interface MovimientoFicha {
  fecha: string;
  fuente: string;
  tipo: string;
  creditos: number;
  nota: string | null;
  referencia: string | null;
}

export interface MesUso {
  mes: string;
  preguntas: number;
  redacciones: number;
  creditos: number;
  costoClp: number;
  pagadoClp: number;
}

export interface FichaCliente {
  cliente: FilaCliente;
  telefono: string | null;
  suscripciones: SuscripcionFicha[];
  pagos: PagoFicha[];
  movimientos: MovimientoFicha[];
  meses: MesUso[];
}

export async function fichaCliente(id: string): Promise<FichaCliente | null> {
  const { rows: u } = await db.execute<{ email: string; telefono: string | null }>(sql`
    SELECT u.email, p.telefono FROM "user" u LEFT JOIN perfil p ON p.user_id = u.id WHERE u.id = ${id}
  `);
  if (!u[0]) return null;
  const [cliente] = (await listaClientes({ q: u[0].email, limite: 20 })).filter((c) => c.id === id);
  if (!cliente) return null;

  const [subs, pagosR, movs, meses] = await Promise.all([
    db.execute<{
      id: string;
      plan: string;
      titular: boolean;
      estado: string;
      motivo_fin: string | null;
      desde: string;
      vence: string;
      cancelada: string | null;
      miembros: string[] | null;
      nota: string | null;
    }>(sql`
      SELECT s.id, s.plan, (s.titular_user_id = ${id}) AS titular, s.estado, s.motivo_fin,
        to_char(s.vigente_desde AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS desde,
        to_char(s.vence_en AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS vence,
        to_char(s.cancelada_en AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS cancelada,
        ARRAY(SELECT mu.email FROM suscripcion_miembros mm JOIN "user" mu ON mu.id = mm.user_id
              WHERE mm.suscripcion_id = s.id ORDER BY mm.created_at) AS miembros,
        s.nota
      FROM suscripciones s
      WHERE s.titular_user_id = ${id}
         OR EXISTS (SELECT 1 FROM suscripcion_miembros m WHERE m.suscripcion_id = s.id AND m.user_id = ${id})
      ORDER BY s.vigente_desde DESC
    `),
    db.execute<{
      fecha: string;
      concepto: string;
      detalle: string | null;
      monto: number;
      medio: string | null;
      referencia: string | null;
      por: string | null;
    }>(sql`
      SELECT to_char(fecha_pago AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS fecha, concepto, detalle,
        monto_clp AS monto, medio, referencia, registrado_por AS por
      FROM pagos WHERE user_id = ${id} ORDER BY fecha_pago DESC
    `),
    db.execute<{
      fecha: string;
      fuente: string;
      tipo: string;
      creditos: number;
      nota: string | null;
      referencia: string | null;
    }>(sql`
      SELECT to_char(created_at AT TIME ZONE ${ZONA}, 'YYYY-MM-DD HH24:MI') AS fecha, fuente, tipo, creditos,
        nota, referencia
      FROM movimientos_creditos WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 100
    `),
    serieMensual(12, id),
  ]);

  return {
    cliente,
    telefono: u[0].telefono,
    suscripciones: subs.rows
      .filter((s) => esIdPlan(s.plan))
      .map((s) => ({
        id: s.id,
        plan: s.plan as IdPlan,
        rol: s.titular ? "titular" : "miembro",
        estado: s.estado,
        motivoFin: s.motivo_fin,
        vigenteDesde: s.desde,
        venceEn: s.vence,
        canceladaEn: s.cancelada,
        miembros: s.miembros ?? [],
        nota: s.nota,
      })),
    pagos: pagosR.rows.map((p) => ({
      fecha: p.fecha,
      concepto: p.concepto,
      detalle: p.detalle,
      montoClp: Number(p.monto),
      medio: p.medio,
      referencia: p.referencia,
      registradoPor: p.por,
    })),
    movimientos: movs.rows.map((m) => ({ ...m, creditos: Number(m.creditos) })),
    meses: meses.map((m) => ({
      mes: m.mes,
      preguntas: m.preguntas,
      redacciones: m.redacciones,
      creditos: m.creditos,
      costoClp: m.costoIaClp,
      pagadoClp: m.brutoClp,
    })),
  };
}

// ─── Métricas del negocio ───────────────────────────────────────────────────

export interface Mes {
  mes: string;
  brutoClp: number;
  netoClp: number;
  costoIaClp: number;
  margenClp: number;
  preguntas: number;
  redacciones: number;
  creditos: number;
  usuariosNuevos: number;
  clientesNuevos: number;
}

/** Últimos `n` meses (hora de Chile), del más antiguo al actual. Con `userId`, solo esa persona. */
export async function serieMensual(n = 12, userId?: string): Promise<Mes[]> {
  const deUsuario = (col: string) => (userId ? sql`AND ${sql.raw(col)} = ${userId}` : sql``);
  const { rows } = await db.execute<{
    mes: string;
    bruto: number;
    costo: number;
    preguntas: number;
    redacciones: number;
    creditos: number;
    usuarios: number;
    clientes: number;
  }>(sql`
    WITH meses AS (
      SELECT generate_series(
        date_trunc('month', now() AT TIME ZONE ${ZONA}) - (${n - 1} * interval '1 month'),
        date_trunc('month', now() AT TIME ZONE ${ZONA}),
        interval '1 month'
      ) AS mes
    ),
    r AS (
      SELECT mes, (mes AT TIME ZONE ${ZONA}) AS ini, ((mes + interval '1 month') AT TIME ZONE ${ZONA}) AS fin FROM meses
    )
    SELECT
      to_char(r.mes, 'YYYY-MM') AS mes,
      (SELECT COALESCE(SUM(monto_clp), 0) FROM pagos
        WHERE fecha_pago >= r.ini AND fecha_pago < r.fin ${deUsuario("user_id")})::bigint AS bruto,
      (SELECT COALESCE(SUM(${COSTO_CONSULTA_CLP}), 0) FROM consultas
        WHERE respuesta_llm IS NOT NULL AND created_at >= r.ini AND created_at < r.fin ${deUsuario("user_id")})::float AS costo,
      (SELECT COUNT(*) FROM consultas
        WHERE created_at >= r.ini AND created_at < r.fin ${deUsuario("user_id")})::int AS preguntas,
      (SELECT COUNT(*) FROM consultas
        WHERE respuesta_llm IS NOT NULL AND created_at >= r.ini AND created_at < r.fin ${deUsuario("user_id")})::int AS redacciones,
      (SELECT COALESCE(-SUM(creditos), 0) FROM movimientos_creditos
        WHERE tipo IN ('consumo', 'ajuste_consumo', 'reembolso')
          AND created_at >= r.ini AND created_at < r.fin ${deUsuario("user_id")})::int AS creditos,
      (SELECT COUNT(*) FROM "user"
        WHERE created_at >= r.ini AND created_at < r.fin ${deUsuario("id")})::int AS usuarios,
      (SELECT COUNT(*) FROM (SELECT user_id, MIN(fecha_pago) AS primero FROM pagos
          WHERE monto_clp > 0 ${deUsuario("user_id")} GROUP BY user_id) x
        WHERE x.primero >= r.ini AND x.primero < r.fin)::int AS clientes
    FROM r ORDER BY r.mes
  `);
  return rows.map((r) => {
    const bruto = Number(r.bruto);
    const neto = bruto * FACTOR_NETO;
    const costo = Number(r.costo);
    return {
      mes: r.mes,
      brutoClp: bruto,
      netoClp: Math.round(neto),
      costoIaClp: Math.round(costo),
      margenClp: Math.round(neto - costo),
      preguntas: Number(r.preguntas),
      redacciones: Number(r.redacciones),
      creditos: Number(r.creditos),
      usuariosNuevos: Number(r.usuarios),
      clientesNuevos: Number(r.clientes),
    };
  });
}

export interface Metricas {
  usuarios: number;
  clientesActivos: number;
  porPlan: Record<IdPlan, number>;
  mrrClp: number;
  bruto30Clp: number;
  neto30Clp: number;
  costoIa30Clp: number;
  margen30: number | null;
  arpuNetoClp: number | null;
  churn30: number | null;
  bajas30: number;
  activosHace30: number;
  ltvHistoricoClp: number | null;
  clientesQuePagaron: number;
  ltvEstimadoClp: number | null;
  costoPorRedaccionClp: number | null;
}

export async function metricasNegocio(): Promise<Metricas> {
  const activoEn = (t: ReturnType<typeof sql>) =>
    sql`vigente_desde <= ${t} AND vence_en > ${t} AND (cancelada_en IS NULL OR cancelada_en > ${t})`;
  const ahora = sql`now()`;
  const hace30 = sql`(now() - interval '30 days')`;

  const { rows } = await db.execute<{
    usuarios: number;
    bruto30: number;
    costo30: number;
    redacciones30: number;
    activos_ahora: number;
    activos_antes: number;
    bajas: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM "user")::int AS usuarios,
      (SELECT COALESCE(SUM(monto_clp), 0) FROM pagos WHERE fecha_pago > ${hace30})::bigint AS bruto30,
      (SELECT COALESCE(SUM(${COSTO_CONSULTA_CLP}), 0) FROM consultas
        WHERE respuesta_llm IS NOT NULL AND created_at > ${hace30})::float AS costo30,
      (SELECT COUNT(*) FROM consultas
        WHERE respuesta_llm IS NOT NULL AND COALESCE(costo_usd, 1) > 0 AND created_at > ${hace30})::int AS redacciones30,
      (SELECT COUNT(DISTINCT titular_user_id) FROM suscripciones WHERE ${activoEn(ahora)})::int AS activos_ahora,
      (SELECT COUNT(DISTINCT titular_user_id) FROM suscripciones WHERE ${activoEn(hace30)})::int AS activos_antes,
      (SELECT COUNT(*) FROM (
        SELECT DISTINCT titular_user_id FROM suscripciones WHERE ${activoEn(hace30)}
        EXCEPT
        SELECT DISTINCT titular_user_id FROM suscripciones WHERE ${activoEn(ahora)}
      ) x)::int AS bajas
  `);
  const r = rows[0];

  const { rows: planes } = await db.execute<{ plan: string; n: number }>(sql`
    SELECT plan, COUNT(*)::int AS n FROM suscripciones WHERE ${activoEn(ahora)} GROUP BY plan
  `);
  const porPlan: Record<IdPlan, number> = { gratis: 0, profesional: 0, director_tecnico: 0 };
  let mrr = 0;
  for (const p of planes) {
    if (!esIdPlan(p.plan)) continue;
    porPlan[p.plan] = Number(p.n);
    mrr += PLANES[p.plan].precioMensualClp * Number(p.n);
  }

  // LTV histórico: margen acumulado promedio de quienes alguna vez pagaron.
  const { rows: ltv } = await db.execute<{ n: number; bruto: number; costo: number }>(sql`
    WITH pagaron AS (SELECT user_id, SUM(monto_clp) AS bruto FROM pagos GROUP BY user_id HAVING SUM(monto_clp) > 0)
    SELECT COUNT(*)::int AS n, COALESCE(SUM(bruto), 0)::bigint AS bruto,
      COALESCE((SELECT SUM(${COSTO_CONSULTA_CLP}) FROM consultas c
        WHERE c.respuesta_llm IS NOT NULL AND c.user_id IN (SELECT user_id FROM pagaron)), 0)::float AS costo
    FROM pagaron
  `);

  const activos = Number(r.activos_ahora);
  porPlan.gratis = Math.max(0, Number(r.usuarios) - activos);
  const bruto30 = Number(r.bruto30);
  const neto30 = bruto30 * FACTOR_NETO;
  const costo30 = Number(r.costo30);
  const margen30 = neto30 > 0 ? (neto30 - costo30) / neto30 : null;
  // ARPU con el MRR, no con lo cobrado en 30 días: un pago anual adelantado
  // inflaría el mes en que entró y dejaría en cero los once siguientes.
  const arpu = activos > 0 ? (mrr * FACTOR_NETO) / activos : null;
  const antes = Number(r.activos_antes);
  const churn = antes > 0 ? Number(r.bajas) / antes : null;
  const margenParaLtv = arpu && arpu > 0 ? Math.max(0, (arpu - costo30 / Math.max(1, activos)) / arpu) : null;
  const l = ltv[0];
  const nPagaron = Number(l?.n ?? 0);

  return {
    usuarios: Number(r.usuarios),
    clientesActivos: activos,
    porPlan,
    mrrClp: mrr,
    bruto30Clp: bruto30,
    neto30Clp: Math.round(neto30),
    costoIa30Clp: Math.round(costo30),
    margen30,
    arpuNetoClp: arpu === null ? null : Math.round(arpu),
    churn30: churn,
    bajas30: Number(r.bajas),
    activosHace30: antes,
    ltvHistoricoClp: nPagaron
      ? Math.round((Number(l.bruto) * FACTOR_NETO - Number(l.costo)) / nPagaron)
      : null,
    clientesQuePagaron: nPagaron,
    ltvEstimadoClp: arpu && margenParaLtv !== null && churn && churn > 0 ? Math.round((arpu * margenParaLtv) / churn) : null,
    costoPorRedaccionClp: Number(r.redacciones30) ? costo30 / Number(r.redacciones30) : null,
  };
}

/** Para mostrar el dólar usado en los cálculos junto a las cifras. */
export const DOLAR_CLP = ECONOMIA.dolarClp;
