// Créditos de IA contra la base: cuánto le queda a cada persona, cobrar una
// redacción y lo que usa el panel para asignar planes y cargar packs.
//
// Las reglas (cupos, topes, conversión tokens → créditos) están en
// lib/planes.ts; acá solo se lee y se escribe el libro `movimientos_creditos`.
//
// Por qué un libro append-only y no un contador: un contador dice cuánto queda,
// pero no por qué. Con el libro, el saldo de un pack o el uso del mes de un
// equipo se reconstruyen sumando, y un reclamo ("me cobraron dos veces") se
// contesta mirando filas, no adivinando. Nada se edita: un reembolso es otra
// fila positiva.
//
// Carreras: dos pestañas pidiendo a la vez podrían leer el mismo saldo y gastar
// el último crédito dos veces. La reserva toma un candado de Postgres por
// persona (y por equipo) durante la transacción, así que la lectura del saldo y
// el cobro son atómicos. No hace falta Redis.

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  PACKS,
  PLANES,
  RANGO_PLAN,
  ECONOMIA,
  creditosPorCosto,
  decidirFuente,
  esIdPlan,
  restantes,
  type EstadoUso,
  type Fuente,
  type IdPack,
  type IdPlan,
  type Plan,
  type Restantes,
} from "@/lib/planes";

const ZONA = "America/Santiago";

// El tipo de `tx` dentro de db.transaction; así las funciones sirven con o sin
// transacción.
type Ejecutor = Pick<typeof db, "execute">;

interface SuscripcionVigente {
  id: string;
  plan: IdPlan;
  inicioCiclo: Date;
  finCiclo: Date;
  venceEn: Date;
}

/** La mejor suscripción activa de la que la persona es miembro, o null (gratis). */
async function suscripcionVigente(ex: Ejecutor, userId: string): Promise<SuscripcionVigente | null> {
  // El ciclo mensual se cuenta desde vigente_desde: si pagó el 28, su mes va
  // del 28 al 28. age() da meses completos transcurridos.
  const { rows } = await ex.execute<{
    id: string;
    plan: string;
    inicio_ciclo: string;
    vence_en: string;
  }>(sql`
    SELECT
      s.id,
      s.plan,
      s.vence_en,
      s.vigente_desde + (
        (EXTRACT(YEAR FROM age(now(), s.vigente_desde)) * 12
          + EXTRACT(MONTH FROM age(now(), s.vigente_desde)))::int
      ) * interval '1 month' AS inicio_ciclo
    FROM suscripciones s
    JOIN suscripcion_miembros m ON m.suscripcion_id = s.id
    WHERE m.user_id = ${userId}
      AND s.estado = 'activa'
      AND s.vigente_desde <= now()
      AND s.vence_en > now()
  `);
  const validas = rows.filter((r) => esIdPlan(r.plan) && r.plan !== "gratis");
  if (!validas.length) return null;
  validas.sort(
    (a, b) =>
      RANGO_PLAN[b.plan as IdPlan] - RANGO_PLAN[a.plan as IdPlan] ||
      new Date(b.vence_en).getTime() - new Date(a.vence_en).getTime()
  );
  const s = validas[0];
  const inicio = new Date(s.inicio_ciclo);
  const fin = new Date(inicio);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const vence = new Date(s.vence_en);
  return {
    id: s.id,
    plan: s.plan as IdPlan,
    inicioCiclo: inicio,
    finCiclo: fin < vence ? fin : vence,
    venceEn: vence,
  };
}

interface Lectura {
  estado: EstadoUso;
  suscripcion: SuscripcionVigente | null;
}

/** Uso del ciclo, del día y saldo de pack, en una sola consulta. */
async function leerUso(ex: Ejecutor, userId: string, sus: SuscripcionVigente | null): Promise<Lectura> {
  const plan: Plan = PLANES[sus?.plan ?? "gratis"];

  // Plan de equipo: el cupo es de la suscripción. Gratis: de la persona, y
  // solo lo gastado fuera de cualquier suscripción.
  const filtroPlan = sus
    ? sql`suscripcion_id = ${sus.id}`
    : sql`user_id = ${userId} AND suscripcion_id IS NULL`;
  const inicioCiclo = sus
    ? sql`${sus.inicioCiclo.toISOString()}::timestamptz`
    : sql`(date_trunc('month', now() AT TIME ZONE ${ZONA}) AT TIME ZONE ${ZONA})`;
  const inicioDia = sql`(date_trunc('day', now() AT TIME ZONE ${ZONA}) AT TIME ZONE ${ZONA})`;

  const { rows } = await ex.execute<{
    usados_ciclo: number;
    usados_hoy_plan: number;
    usados_hoy_pack: number;
    saldo_pack: number;
  }>(sql`
    SELECT
      COALESCE((SELECT -SUM(creditos) FROM movimientos_creditos
        WHERE fuente = 'plan' AND ${filtroPlan} AND created_at >= ${inicioCiclo}), 0)::int AS usados_ciclo,
      COALESCE((SELECT -SUM(creditos) FROM movimientos_creditos
        WHERE fuente = 'plan' AND ${filtroPlan} AND created_at >= ${inicioDia}), 0)::int AS usados_hoy_plan,
      COALESCE((SELECT -SUM(creditos) FROM movimientos_creditos
        WHERE fuente = 'pack' AND user_id = ${userId}
          AND tipo IN ('consumo', 'ajuste_consumo', 'reembolso')
          AND created_at >= ${inicioDia}), 0)::int AS usados_hoy_pack,
      COALESCE((SELECT SUM(creditos) FROM movimientos_creditos
        WHERE fuente = 'pack' AND user_id = ${userId}), 0)::int AS saldo_pack
  `);
  const r = rows[0];
  return {
    suscripcion: sus,
    estado: {
      plan,
      usadosCiclo: Number(r?.usados_ciclo ?? 0),
      usadosHoyPlan: Number(r?.usados_hoy_plan ?? 0),
      usadosHoyPack: Number(r?.usados_hoy_pack ?? 0),
      saldoPack: Number(r?.saldo_pack ?? 0),
    },
  };
}

// ─── Lo que ve la persona ───────────────────────────────────────────────────

export interface EstadoCreditos {
  plan: { id: IdPlan; nombre: string; creditosMes: number; limiteDiario: number };
  restantes: Restantes;
  /** Cuándo se renuevan los créditos del plan (ISO). */
  renuevaEn: string | null;
  /** Solo planes pagados: cuándo termina lo pagado (ISO). */
  venceEn: string | null;
}

export async function estadoCreditos(userId: string): Promise<EstadoCreditos> {
  const sus = await suscripcionVigente(db, userId);
  const { estado } = await leerUso(db, userId, sus);
  let renueva: Date | null = sus?.finCiclo ?? null;
  if (!sus) {
    // Primer día del mes siguiente en Chile.
    const { rows } = await db.execute<{ r: string }>(sql`
      SELECT ((date_trunc('month', now() AT TIME ZONE ${ZONA}) + interval '1 month') AT TIME ZONE ${ZONA}) AS r
    `);
    renueva = rows[0] ? new Date(rows[0].r) : null;
  }
  return {
    plan: {
      id: estado.plan.id,
      nombre: estado.plan.nombre,
      creditosMes: estado.plan.creditosMes,
      limiteDiario: estado.plan.limiteDiario,
    },
    restantes: restantes(estado),
    renuevaEn: renueva?.toISOString() ?? null,
    venceEn: sus?.venceEn.toISOString() ?? null,
  };
}

// ─── Cobro de una redacción ─────────────────────────────────────────────────

export interface Reserva {
  userId: string;
  consultaId: string;
  fuente: Fuente;
  suscripcionId: string | null;
  plan: IdPlan;
}

export type ResultadoReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; motivo: "limite_diario" | "sin_creditos"; mensaje: string; plan: IdPlan };

/**
 * Descuenta 1 crédito ANTES de llamar al modelo. Si la redacción sale más
 * larga, liquidarCredito cobra la diferencia; si falla, reembolsarCredito lo
 * devuelve. Cobrar antes es lo que impide que diez pestañas a la vez gasten
 * diez veces el último crédito.
 */
export async function reservarCredito(userId: string, consultaId: string): Promise<ResultadoReserva> {
  return db.transaction(async (tx) => {
    const sus = await suscripcionVigente(tx, userId);
    // Siempre en el mismo orden (equipo, persona) para no cruzar candados.
    if (sus) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"creditos:s:" + sus.id}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"creditos:u:" + userId}))`);

    const { estado } = await leerUso(tx, userId, sus);
    const decision = decidirFuente(estado);
    if (!decision.permitido) {
      return { ok: false as const, motivo: decision.motivo, mensaje: decision.mensaje, plan: estado.plan.id };
    }

    const suscripcionId = decision.fuente === "plan" ? (sus?.id ?? null) : null;
    await tx.execute(sql`
      INSERT INTO movimientos_creditos (id, user_id, suscripcion_id, fuente, tipo, creditos, consulta_id)
      VALUES (${randomUUID()}, ${userId}, ${suscripcionId}, ${decision.fuente}, 'consumo', -1, ${consultaId})
    `);
    return {
      ok: true as const,
      reserva: { userId, consultaId, fuente: decision.fuente, suscripcionId, plan: estado.plan.id },
    };
  });
}

/**
 * Cierra el cobro con lo que costó de verdad. Un crédito cubre hasta
 * USD_POR_CREDITO: si la redacción costó más (modelo caro, consulta larga), se
 * agrega la diferencia. Puede dejar el saldo de pack en −1 o pasar el cupo: se
 * acepta, porque la próxima reserva ya ve el saldo real y no deja seguir.
 */
export async function liquidarCredito(
  r: Reserva,
  s: { costoUsd: number; tokensEntrada: number; tokensSalida: number }
): Promise<number> {
  const total = creditosPorCosto(s.costoUsd);
  if (total > 1) {
    await db.execute(sql`
      INSERT INTO movimientos_creditos
        (id, user_id, suscripcion_id, fuente, tipo, creditos, consulta_id, tokens_entrada, tokens_salida, nota)
      VALUES (${randomUUID()}, ${r.userId}, ${r.suscripcionId}, ${r.fuente}, 'ajuste_consumo',
        ${-(total - 1)}, ${r.consultaId}, ${s.tokensEntrada}, ${s.tokensSalida}, ${`costo US$${s.costoUsd.toFixed(5)}`})
    `);
  }
  return total;
}

/** Devuelve el crédito reservado cuando la redacción no llegó a entregarse. */
export async function reembolsarCredito(r: Reserva, motivo: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO movimientos_creditos (id, user_id, suscripcion_id, fuente, tipo, creditos, consulta_id, nota)
      VALUES (${randomUUID()}, ${r.userId}, ${r.suscripcionId}, ${r.fuente}, 'reembolso', 1, ${r.consultaId}, ${motivo})
    `);
  } catch (e) {
    // No tapar el error original de la redacción por un reembolso fallido;
    // queda en el log para devolverlo a mano.
    console.error("[creditos] no se pudo reembolsar", r, e);
  }
}

// ─── Panel ──────────────────────────────────────────────────────────────────
//
// Cada plan o pack que se activa desde el panel registra también su PAGO
// (tabla `pagos`), en la misma transacción. Así el LTV y los márgenes salen de
// lo que se cobró de verdad —con descuentos y cortesías— y no del precio de
// lista.

async function userIdPorEmail(email: string): Promise<string | null> {
  const { rows } = await db.execute<{ id: string }>(sql`
    SELECT id FROM "user" WHERE lower(email) = lower(${email.trim()}) LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

export class ErrorPanel extends Error {}

export interface DatosPago {
  /** Bruto con IVA. Si no viene, el precio de lista. 0 = cortesía. */
  montoClp?: number | null;
  medio?: string;
  referencia?: string;
  /** Fecha real del pago (ISO). Por defecto, ahora. */
  fechaPago?: string | null;
}

function montoValido(m: number | null | undefined, porDefecto: number): number {
  if (m === null || m === undefined || Number.isNaN(m)) return porDefecto;
  if (!Number.isInteger(m) || Math.abs(m) > 50_000_000) throw new ErrorPanel("Monto en pesos, entero.");
  return m;
}

function fechaValida(f: string | null | undefined): string | null {
  if (!f) return null;
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) throw new ErrorPanel("Fecha de pago no válida.");
  if (d.getTime() > Date.now() + 86_400_000) throw new ErrorPanel("La fecha de pago no puede ser futura.");
  return d.toISOString();
}

/**
 * Asigna o renueva un plan pagado. Mismo plan y vigente: se extiende la fecha
 * de término. Plan distinto: la suscripción anterior termina como
 * "reemplazada" (no cuenta como baja) y los miembros pasan a la nueva.
 */
export async function asignarPlan(
  p: {
    email: string;
    plan: IdPlan;
    meses: number;
    admin: string;
    nota?: string;
  } & DatosPago
): Promise<string> {
  if (p.plan === "gratis") throw new ErrorPanel("El plan gratis no se asigna: es el de quien no tiene suscripción.");
  if (!Number.isInteger(p.meses) || p.meses < 1 || p.meses > 24) throw new ErrorPanel("Meses entre 1 y 24.");
  const monto = montoValido(p.montoClp, PLANES[p.plan].precioMensualClp * p.meses);
  const fecha = fechaValida(p.fechaPago);
  const userId = await userIdPorEmail(p.email);
  if (!userId) throw new ErrorPanel(`No hay ninguna cuenta con el correo ${p.email}. Tiene que entrar una vez primero.`);

  return db.transaction(async (tx) => {
    const { rows: actuales } = await tx.execute<{ id: string; plan: string }>(sql`
      SELECT id, plan FROM suscripciones
      WHERE titular_user_id = ${userId} AND estado = 'activa' AND vence_en > now()
      ORDER BY vence_en DESC
    `);
    const mismo = actuales.find((s) => s.plan === p.plan);
    let id: string;

    if (mismo) {
      id = mismo.id;
      await tx.execute(sql`
        UPDATE suscripciones
        SET vence_en = vence_en + (${p.meses} * interval '1 month'),
            nota = concat_ws(' · ', nota, ${`renovado ${p.meses}m por ${p.admin}`}::text)
        WHERE id = ${id}
      `);
    } else {
      id = randomUUID();
      await tx.execute(sql`
        INSERT INTO suscripciones (id, plan, titular_user_id, vigente_desde, vence_en, estado, origen, nota)
        VALUES (${id}, ${p.plan}, ${userId}, now(), now() + (${p.meses} * interval '1 month'), 'activa',
          ${"manual:" + p.admin}, ${p.nota || null})
      `);
      await tx.execute(sql`
        INSERT INTO suscripcion_miembros (suscripcion_id, user_id) VALUES (${id}, ${userId})
      `);

      // Cambio de plan: los miembros del plan anterior siguen en el nuevo,
      // hasta donde quepan.
      const max = PLANES[p.plan].maxMiembros;
      for (const vieja of actuales) {
        if (max > 1) {
          await tx.execute(sql`
            INSERT INTO suscripcion_miembros (suscripcion_id, user_id)
            SELECT ${id}, user_id FROM suscripcion_miembros
            WHERE suscripcion_id = ${vieja.id} AND user_id <> ${userId}
            ORDER BY created_at
            LIMIT ${max - 1}
            ON CONFLICT DO NOTHING
          `);
        }
        await tx.execute(sql`
          UPDATE suscripciones
          SET estado = 'cancelada', cancelada_en = now(), motivo_fin = 'reemplazada',
              nota = concat_ws(' · ', nota, ${`reemplazada por ${p.plan}`}::text)
          WHERE id = ${vieja.id}
        `);
      }
    }

    await tx.execute(sql`
      INSERT INTO pagos (id, user_id, suscripcion_id, concepto, detalle, monto_clp, meses, medio, referencia,
        fecha_pago, registrado_por)
      VALUES (${randomUUID()}, ${userId}, ${id}, 'plan', ${p.plan}, ${monto}, ${p.meses},
        ${p.medio || (monto === 0 ? "cortesia" : null)}, ${p.referencia || p.nota || null},
        COALESCE(${fecha}::timestamptz, now()), ${p.admin})
    `);
    return id;
  });
}

/** Baja: la suscripción deja de dar créditos ya, y cuenta para el churn. */
export async function cancelarSuscripcion(id: string, admin: string): Promise<void> {
  await db.execute(sql`
    UPDATE suscripciones
    SET estado = 'cancelada', cancelada_en = now(), motivo_fin = 'cancelada',
        nota = concat_ws(' · ', nota, ${`cancelada por ${admin}`}::text)
    WHERE id = ${id} AND estado = 'activa'
  `);
}

/** Corrige la fecha de término (p. ej. un mes de regalo o un error de carga). */
export async function cambiarVencimiento(id: string, venceEn: string, admin: string): Promise<void> {
  const d = new Date(venceEn);
  if (Number.isNaN(d.getTime())) throw new ErrorPanel("Fecha no válida.");
  await db.execute(sql`
    UPDATE suscripciones
    SET vence_en = ${d.toISOString()}::timestamptz,
        nota = concat_ws(' · ', nota, ${`vencimiento ${d.toISOString().slice(0, 10)} por ${admin}`}::text)
    WHERE id = ${id}
  `);
}

export async function agregarMiembro(suscripcionId: string, email: string): Promise<void> {
  const userId = await userIdPorEmail(email);
  if (!userId) throw new ErrorPanel(`No hay ninguna cuenta con el correo ${email}. Tiene que entrar una vez primero.`);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"miembros:" + suscripcionId}))`);
    const { rows } = await tx.execute<{ plan: string; miembros: number }>(sql`
      SELECT s.plan, (SELECT COUNT(*) FROM suscripcion_miembros m WHERE m.suscripcion_id = s.id)::int AS miembros
      FROM suscripciones s WHERE s.id = ${suscripcionId} AND s.estado = 'activa'
    `);
    const s = rows[0];
    if (!s || !esIdPlan(s.plan)) throw new ErrorPanel("La suscripción no existe o no está activa.");
    if (s.miembros >= PLANES[s.plan].maxMiembros) {
      throw new ErrorPanel(`El plan ${PLANES[s.plan].nombre} admite hasta ${PLANES[s.plan].maxMiembros} personas.`);
    }
    await tx.execute(sql`
      INSERT INTO suscripcion_miembros (suscripcion_id, user_id) VALUES (${suscripcionId}, ${userId})
      ON CONFLICT DO NOTHING
    `);
  });
}

export async function quitarMiembro(suscripcionId: string, email: string): Promise<void> {
  // El titular no se quita: sin él, la suscripción queda sin dueño.
  await db.execute(sql`
    DELETE FROM suscripcion_miembros m
    USING suscripciones s, "user" u
    WHERE m.suscripcion_id = s.id AND s.id = ${suscripcionId}
      AND u.id = m.user_id AND lower(u.email) = lower(${email.trim()})
      AND m.user_id <> s.titular_user_id
  `);
}

/** Carga un pack sin vencimiento y registra su pago. */
export async function cargarPack(p: { email: string; pack: IdPack; admin: string } & DatosPago): Promise<void> {
  const pack = PACKS[p.pack];
  const monto = montoValido(p.montoClp, pack.precioClp);
  const fecha = fechaValida(p.fechaPago);
  const userId = await userIdPorEmail(p.email);
  if (!userId) throw new ErrorPanel(`No hay ninguna cuenta con el correo ${p.email}. Tiene que entrar una vez primero.`);
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO movimientos_creditos (id, user_id, fuente, tipo, creditos, referencia, nota)
      VALUES (${randomUUID()}, ${userId}, 'pack', 'compra', ${pack.creditos}, ${pack.id},
        ${[p.referencia, `cargado por ${p.admin}`].filter(Boolean).join(" · ")})
    `);
    await tx.execute(sql`
      INSERT INTO pagos (id, user_id, concepto, detalle, monto_clp, medio, referencia, fecha_pago, registrado_por)
      VALUES (${randomUUID()}, ${userId}, 'pack', ${pack.id}, ${monto},
        ${p.medio || (monto === 0 ? "cortesia" : null)}, ${p.referencia || null},
        COALESCE(${fecha}::timestamptz, now()), ${p.admin})
    `);
  });
}

/** Pago suelto (un pago que faltó registrar, una devolución con monto negativo). */
export async function registrarPago(
  p: { email: string; concepto: "plan" | "pack" | "otro"; detalle?: string; admin: string } & DatosPago
): Promise<void> {
  const monto = montoValido(p.montoClp, NaN);
  if (Number.isNaN(monto)) throw new ErrorPanel("Falta el monto.");
  const fecha = fechaValida(p.fechaPago);
  const userId = await userIdPorEmail(p.email);
  if (!userId) throw new ErrorPanel(`No hay ninguna cuenta con el correo ${p.email}.`);
  await db.execute(sql`
    INSERT INTO pagos (id, user_id, concepto, detalle, monto_clp, medio, referencia, fecha_pago, registrado_por)
    VALUES (${randomUUID()}, ${userId}, ${p.concepto}, ${p.detalle || null}, ${monto}, ${p.medio || null},
      ${p.referencia || null}, COALESCE(${fecha}::timestamptz, now()), ${p.admin})
  `);
}

/** Regalo o corrección de créditos de pack (positivo o negativo). No es un pago. */
export async function ajustarCreditos(p: { email: string; creditos: number; nota: string; admin: string }) {
  if (!Number.isInteger(p.creditos) || p.creditos === 0 || Math.abs(p.creditos) > 100_000) {
    throw new ErrorPanel("Créditos: un entero distinto de cero.");
  }
  const userId = await userIdPorEmail(p.email);
  if (!userId) throw new ErrorPanel(`No hay ninguna cuenta con el correo ${p.email}.`);
  await db.execute(sql`
    INSERT INTO movimientos_creditos (id, user_id, fuente, tipo, creditos, referencia, nota)
    VALUES (${randomUUID()}, ${userId}, 'pack', 'ajuste', ${p.creditos}, ${"ajuste:" + p.admin}, ${p.nota || null})
  `);
}

export interface FilaSuscripcion {
  [campo: string]: unknown;
  id: string;
  plan: IdPlan;
  titular: string;
  titularId: string;
  miembros: string[];
  vigenteDesde: string;
  venceEn: string;
  usadosCiclo: number;
}

export async function suscripcionesActivas(): Promise<FilaSuscripcion[]> {
  const { rows } = await db.execute<{
    id: string;
    plan: string;
    titular: string;
    titular_id: string;
    miembros: string[] | null;
    vigente_desde: string;
    vence_en: string;
    usados: number;
  }>(sql`
    SELECT
      s.id, s.plan, u.email AS titular, u.id AS titular_id,
      ARRAY(SELECT mu.email FROM suscripcion_miembros m JOIN "user" mu ON mu.id = m.user_id
            WHERE m.suscripcion_id = s.id ORDER BY m.created_at) AS miembros,
      to_char(s.vigente_desde AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS vigente_desde,
      to_char(s.vence_en AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS vence_en,
      (SELECT COALESCE(-SUM(mc.creditos), 0)::int FROM movimientos_creditos mc
        WHERE mc.fuente = 'plan' AND mc.suscripcion_id = s.id
          AND mc.created_at >= s.vigente_desde + (
            (EXTRACT(YEAR FROM age(now(), s.vigente_desde)) * 12
              + EXTRACT(MONTH FROM age(now(), s.vigente_desde)))::int
          ) * interval '1 month') AS usados
    FROM suscripciones s JOIN "user" u ON u.id = s.titular_user_id
    WHERE s.estado = 'activa' AND s.vence_en > now()
    ORDER BY s.vence_en
  `);
  return rows
    .filter((r) => esIdPlan(r.plan))
    .map((r) => ({
      id: r.id,
      plan: r.plan as IdPlan,
      titular: r.titular,
      titularId: r.titular_id,
      miembros: r.miembros ?? [],
      vigenteDesde: r.vigente_desde,
      venceEn: r.vence_en,
      usadosCiclo: Number(r.usados ?? 0),
    }));
}

/** Costo en pesos de las consultas, con fallback para filas anteriores a 0009. */
export const COSTO_CONSULTA_CLP = sql.raw(`(COALESCE(costo_usd,
  (COALESCE(tokens_in, 0) * ${ECONOMIA.usdMillonEntradaHistorico}
   + COALESCE(tokens_out, 0) * ${ECONOMIA.usdMillonSalidaHistorico}) / 1000000.0) * ${ECONOMIA.dolarClp})`);
