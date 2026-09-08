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
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
  empresa: text("empresa"),
  cargo: text("cargo"),
  // QF regulatorio, QA, consultor, importador, estudiante, otro. Texto libre
  // acotado en la interfaz: agregar una categoría no debe requerir migración.
  tipoPerfil: text("tipo_perfil"),
  telefono: text("telefono"),
  // Consentimientos separados: usar el servicio es obligatorio, recibir
  // novedades no. Se guarda la fecha, que es lo que sirve como evidencia.
  aceptaPrivacidadAt: timestamp("acepta_privacidad_at", { withTimezone: true }),
  aceptaNovedades: boolean("acepta_novedades").notNull().default(false),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consultas_user_created_idx").on(t.userId, t.createdAt),
    index("consultas_created_idx").on(t.createdAt),
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
