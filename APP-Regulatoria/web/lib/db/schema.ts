// Esquema Postgres de RegulaMED.
//
// Las cuatro primeras tablas (user, session, account, verification) son las que
// exige Better Auth: sus nombres de columna vienen del propio paquete y no se
// pueden renombrar sin configurar un mapeo. El resto son nuestras.
//
// Regla de negocio detrás del modelo: una consulta siempre pertenece a una
// persona identificada. Por eso `consultas.userId` es NOT NULL — si algún día
// hay búsquedas anónimas, serán otra tabla, no una fila con el autor en blanco.

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Better Auth ────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RegulaMED ──────────────────────────────────────────────────────────────

/** Lo que el usuario declara al entrar por primera vez. Sin esto no busca. */
export const perfil = pgTable("perfil", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Nombre y apellido declarados. Existen aparte de `user.name` porque ese
  // campo lo escribe Better Auth con lo que venga del proveedor —un nombre
  // completo sin partir, o el trozo antes de la arroba si entró por enlace
  // mágico— y acá hace falta el apellido por separado para escribirle a alguien
  // por su nombre. `user.name` se mantiene sincronizado como "nombre apellido".
  nombre: text("nombre"),
  apellido: text("apellido"),
  empresa: text("empresa"),
  // `cargo` y `tipo_perfil` ya no se piden: el registro se acortó a nombre,
  // apellido, correo y teléfono (2026-09-15). Las columnas quedan porque
  // guardan lo que declararon los registrados anteriores y el panel las lee.
  cargo: text("cargo"),
  tipoPerfil: text("tipo_perfil"),
  telefono: text("telefono"),
  // Consentimientos separados: usar el servicio es obligatorio, recibir
  // novedades no. Se guarda la fecha, que es lo que sirve como evidencia.
  aceptaPrivacidadAt: timestamp("acepta_privacidad_at", { withTimezone: true }),
  aceptaNovedades: boolean("acepta_novedades").notNull().default(false),
  // (0010) Cuándo se le mostraron los planes por única vez, al terminar el
  // registro. Después de eso no se le vuelve a ofrecer nada salvo que llegue al
  // límite de su plan. Nulo = todavía no se le ofrecieron.
  planesOfrecidosAt: timestamp("planes_ofrecidos_at", { withTimezone: true }),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Una fila por búsqueda. Es a la vez registro de uso y backlog del corpus. */
export const consultas = pgTable(
  "consultas",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pregunta: text("pregunta").notNull(),
    filtros: jsonb("filtros"),
    k: integer("k"),
    // Señal de confianza del motor: permite separar "no encontró" de "no existe
    // en el corpus", que es la métrica que dice qué normas faltan.
    recomendacion: text("recomendacion"),
    confianza: text("confianza"),
    coberturaTop: real("cobertura_top"),
    margen: real("margen"),
    conceptosFuera: jsonb("conceptos_fuera"),
    topCita: text("top_cita"),
    topScore: real("top_score"),
    // Capa de IA (fase 5). Nulos mientras la respuesta no se pidió: la mayoría
    // de las búsquedas se resuelven mirando los pasajes y no gastan modelo.
    respuestaLlm: text("respuesta_llm"),
    modelo: text("modelo"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latenciaMs: integer("latencia_ms"),
    // (0009) Quién respondió y cuánto costó, con los precios de ESE modelo en
    // ese momento. Sin esto, cambiar de proveedor reescribiría el pasado: los
    // márgenes de meses anteriores se recalcularían con el precio nuevo.
    proveedor: text("proveedor"),
    costoUsd: real("costo_usd"),
    // Caché compartida (0005): misma pregunta normalizada + mismos pasajes +
    // mismo modelo y prompt = misma clave. Las filas servidas desde caché
    // guardan tokens 0, así que sumar tokens_in/out sigue dando el gasto real.
    claveIa: text("clave_ia"),
    fuentesLlm: jsonb("fuentes_llm"),
    // Señales de calidad del borrador. Sin esto, una degradación de la IA en
    // producción es invisible hasta que alguien reclama.
    abstuvo: boolean("abstuvo"),
    sinCitas: boolean("sin_citas"),
    citasInvalidas: boolean("citas_invalidas"),
    datosNoVerificados: text("datos_no_verificados"),
    // Conceptos de la pregunta que los pasajes citados no tratan y el borrador
    // no advirtió: presenta la regla de otro caso como la respuesta.
    casoNoCubierto: text("caso_no_cubierto"),
    // Motivo por el que la compuerta de propósito no dejó llegar la consulta
    // al modelo: tarea | rol | formato | clinico.
    bloqueado: text("bloqueado"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consultas_user_created_idx").on(t.userId, t.createdAt),
    index("consultas_created_idx").on(t.createdAt),
    index("consultas_clave_ia_idx")
      .on(t.claveIa)
      .where(sql`${t.respuestaLlm} IS NOT NULL`),
    index("consultas_bloqueado_idx")
      .on(t.bloqueado)
      .where(sql`${t.bloqueado} IS NOT NULL`),
  ]
);

/**
 * Voto de utilidad sobre una búsqueda concreta. Es la retroalimentación que el
 * motor no puede darse solo: un "no me sirvió" con cobertura alta significa que
 * el corpus tiene la norma pero el pasaje recuperado no era el que hacía falta,
 * y eso no se distingue mirando solo los puntajes.
 *
 * Un voto por consulta: votar de nuevo corrige el anterior en vez de sumar.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    consultaId: text("consulta_id")
      .notNull()
      .references(() => consultas.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    util: boolean("util").notNull(),
    comentario: text("comentario"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feedback_consulta_idx").on(t.consultaId),
    index("feedback_created_idx").on(t.createdAt),
  ]
);

/**
 * Configuración de la agenda. Una sola fila (id = 'default'): es configuración,
 * no historial. Vive en la base y no en variables de entorno porque cambiar el
 * horario de atención no debería requerir un despliegue.
 */
export const agendaConfig = pgTable("agenda_config", {
  id: text("id").primaryKey().default("default"),
  duracionMin: integer("duracion_min").notNull().default(30),
  bufferMin: integer("buffer_min").notNull().default(15),
  // 1 = lunes … 7 = domingo (ISO). Por defecto, de lunes a viernes.
  diaInicio: integer("dia_inicio").notNull().default(1),
  diaFin: integer("dia_fin").notNull().default(5),
  horaInicio: text("hora_inicio").notNull().default("19:00"),
  horaFin: text("hora_fin").notNull().default("22:00"),
  zona: text("zona").notNull().default("America/Santiago"),
  // Nadie puede reservar para dentro de dos horas: la antelación mínima es lo
  // que evita que la agenda interrumpa algo que ya estaba en curso.
  antelacionHoras: integer("antelacion_horas").notNull().default(24),
  horizonteDias: integer("horizonte_dias").notNull().default(21),
  // Calendarios de Google que se consultan para saber si estás ocupado. El
  // evento siempre se crea en el primero.
  calendarios: jsonb("calendarios").notNull().default(["primary"]),
  activa: boolean("activa").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Una reserva confirmada. `googleEventId` es lo que permite cancelar de verdad
 * en el calendario y no solo en nuestra base; `tokenGestion` es el secreto que
 * viaja en el enlace del correo para cancelar sin cuenta.
 */
export const reservas = pgTable(
  "reservas",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    empresa: text("empresa"),
    motivo: text("motivo"),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fin: timestamp("fin", { withTimezone: true }).notNull(),
    googleEventId: text("google_event_id"),
    meetUrl: text("meet_url"),
    // confirmada | cancelada
    estado: text("estado").notNull().default("confirmada"),
    tokenGestion: text("token_gestion").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reservas_inicio_idx").on(t.inicio),
    index("reservas_estado_idx").on(t.estado),
    // Dos reservas confirmadas no pueden compartir horario. La revalidación
    // contra Google y la base no alcanza si dos personas aprietan a la vez; el
    // índice sí (migración 0004).
    uniqueIndex("reservas_inicio_confirmada_idx")
      .on(t.inicio)
      .where(sql`${t.estado} = 'confirmada'`),
  ]
);

/** Ventana deslizante en base de datos: evita depender de un Redis extra. */
export const rateLimit = pgTable(
  "rate_limit",
  {
    clave: text("clave").primaryKey(),
    ventanaInicio: timestamp("ventana_inicio", { withTimezone: true }).notNull(),
    contador: integer("contador").notNull().default(0),
  },
  (t) => [uniqueIndex("rate_limit_clave_idx").on(t.clave)]
);

// ─── Planes y créditos de IA (0008) ─────────────────────────────────────────
//
// Las reglas (cupos, precios, conversión tokens → créditos) viven en
// lib/planes.ts; acá solo se guarda quién tiene qué y qué gastó.

/**
 * Un plan pagado vigente. El plan gratis no tiene fila: es lo que tiene quien
 * no pertenece a ninguna suscripción activa. El ciclo mensual se cuenta desde
 * `vigente_desde` (si pagó el 28, su mes va del 28 al 28).
 */
export const suscripciones = pgTable(
  "suscripciones",
  {
    id: text("id").primaryKey(),
    // profesional | director_tecnico
    plan: text("plan").notNull(),
    titularUserId: text("titular_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vigenteDesde: timestamp("vigente_desde", { withTimezone: true }).notNull().defaultNow(),
    venceEn: timestamp("vence_en", { withTimezone: true }).notNull(),
    // activa | cancelada
    estado: text("estado").notNull().default("activa"),
    // (0009) Cuándo y por qué terminó antes de vencer. "reemplazada" (cambio de
    // plan) no es una baja: el churn solo cuenta "cancelada" y los vencimientos.
    canceladaEn: timestamp("cancelada_en", { withTimezone: true }),
    // cancelada | reemplazada
    motivoFin: text("motivo_fin"),
    // De dónde salió: "manual:<admin>", o el id del pago cuando haya pasarela.
    origen: text("origen"),
    nota: text("nota"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("suscripciones_titular_idx").on(t.titularUserId),
    index("suscripciones_vence_idx").on(t.venceEn),
  ]
);

/** Quiénes comparten el cupo de una suscripción. El titular también es miembro. */
export const suscripcionMiembros = pgTable(
  "suscripcion_miembros",
  {
    suscripcionId: text("suscripcion_id")
      .notNull()
      .references(() => suscripciones.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.suscripcionId, t.userId] }),
    index("suscripcion_miembros_user_idx").on(t.userId),
  ]
);

/**
 * Libro de créditos, append-only: nunca se edita ni se borra una fila, se
 * agrega otra que corrige (reembolso, ajuste). El saldo de pack y el uso del
 * plan son sumas sobre esta tabla, así que siempre se puede reconstruir qué
 * pasó y cuándo.
 *
 * `creditos` lleva signo: una compra suma, un consumo resta.
 */
export const movimientosCreditos = pgTable(
  "movimientos_creditos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Solo para consumos del plan de una suscripción: el cupo es del equipo.
    suscripcionId: text("suscripcion_id").references(() => suscripciones.id, { onDelete: "set null" }),
    // plan | pack
    fuente: text("fuente").notNull(),
    // consumo | ajuste_consumo | reembolso | compra | ajuste
    tipo: text("tipo").notNull(),
    creditos: integer("creditos").notNull(),
    consultaId: text("consulta_id").references(() => consultas.id, { onDelete: "set null" }),
    tokensEntrada: integer("tokens_entrada"),
    tokensSalida: integer("tokens_salida"),
    // Pack comprado, id del pago o quién hizo el ajuste.
    referencia: text("referencia"),
    nota: text("nota"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movimientos_user_fuente_idx").on(t.userId, t.fuente, t.createdAt),
    index("movimientos_suscripcion_idx").on(t.suscripcionId, t.createdAt),
    index("movimientos_created_idx").on(t.createdAt),
  ]
);

// ─── Proveedores de IA y pagos (0009) ───────────────────────────────────────

/**
 * Catálogo de modelos de IA. Cambiar de proveedor es activar otra fila desde
 * el panel: sin deploy. La clave de API NO se guarda acá: `env_clave` es el
 * NOMBRE de la variable de entorno que la tiene (p. ej. OPENAI_API_KEY). Los
 * secretos siguen viviendo solo en Railway.
 *
 * Como mucho una fila activa (índice único parcial). Sin fila activa, se usan
 * las variables LLM_* de siempre.
 */
export const modelosIa = pgTable(
  "modelos_ia",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),
    proveedor: text("proveedor").notNull(),
    baseUrl: text("base_url").notNull(),
    modelo: text("modelo").notNull(),
    envClave: text("env_clave").notNull(),
    usdMillonEntrada: real("usd_millon_entrada").notNull(),
    usdMillonSalida: real("usd_millon_salida").notNull(),
    activo: boolean("activo").notNull().default(false),
    notas: text("notas"),
    // Resultado de la última prueba desde el panel: latencia, tokens, costo,
    // créditos y un extracto (o el error). Se prueba antes de activar.
    ultimaPrueba: jsonb("ultima_prueba"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("modelos_ia_un_activo_idx").on(t.activo).where(sql`${t.activo} = true`)]
);

/**
 * Plata que entró, una fila por pago. Es la base del LTV, el ARPU y los
 * márgenes: lo que se cobró de verdad (con descuentos o cortesías), no el
 * precio de lista. Append-only igual que el libro de créditos.
 */
export const pagos = pgTable(
  "pagos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    suscripcionId: text("suscripcion_id").references(() => suscripciones.id, { onDelete: "set null" }),
    // plan | pack | otro
    concepto: text("concepto").notNull(),
    // profesional | director_tecnico | pack_250 | …
    detalle: text("detalle"),
    // Bruto, IVA incluido, en pesos. Puede ser negativo (devolución).
    montoClp: integer("monto_clp").notNull(),
    meses: integer("meses"),
    // transferencia | flow | mercadopago | cortesia | …
    medio: text("medio"),
    referencia: text("referencia"),
    fechaPago: timestamp("fecha_pago", { withTimezone: true }).notNull().defaultNow(),
    registradoPor: text("registrado_por"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pagos_user_fecha_idx").on(t.userId, t.fechaPago), index("pagos_fecha_idx").on(t.fechaPago)]
);
