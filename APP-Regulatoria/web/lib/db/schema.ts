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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consultas_user_created_idx").on(t.userId, t.createdAt),
    index("consultas_created_idx").on(t.createdAt),
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
