// Consultas del panel interno. Viven acá y no en la página para que la página
// sea solo presentación, y para poder reutilizarlas desde el export CSV y desde
// el resumen semanal por correo sin duplicar SQL.
//
// Todo lo que se lee acá ya está en la base: no hay analítica externa, ni
// píxel, ni cookie de terceros. Lo que la persona hizo en el buscador es lo
// único que se mide.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export interface FilaUsuario {
  [campo: string]: unknown;
  id: string;
  nombre: string;
  email: string;
  empresa: string | null;
  cargo: string | null;
  tipoPerfil: string | null;
  telefono: string | null;
  aceptaNovedades: boolean;
  registradoEn: string;
  consultas: number;
  ultimaActividad: string | null;
  caliente: boolean;
}

export interface FilaConsulta {
  [campo: string]: unknown;
  id: string;
  pregunta: string;
  confianza: string | null;
  recomendacion: string | null;
  topCita: string | null;
  createdAt: string;
  email: string;
  nombre: string;
  empresa: string | null;
  votoUtil: boolean | null;
  comentario: string | null;
}

export interface HuecoCorpus {
  [campo: string]: unknown;
  concepto: string;
  veces: number;
  ejemplo: string;
}

export interface Resumen {
  [campo: string]: unknown;
  usuarios: number;
  usuariosNuevos7d: number;
  consultas7d: number;
  consultasTotales: number;
  sinCobertura7d: number;
  votosNegativos7d: number;
}

/**
 * "Lead caliente" = 3 o más consultas en los últimos 7 días, o un perfil que
 * declara empresa. No es una puntuación sofisticada: es el corte que separa a
 * quien probó el buscador una vez de quien lo está usando para trabajar, que es
 * exactamente a quién vale la pena escribirle.
 *
 * Antes la segunda mitad del corte miraba `tipo_perfil` ('importador',
 * 'empresa', 'consultor'). Ese campo dejó de pedirse al acortar el registro
 * (2026-09-15), así que quedaría en null para todo registrado nuevo y el corte
 * se apagaría solo sin que nadie lo note. Ahora mira la empresa declarada, que
 * es el dato equivalente que sí se sigue pidiendo.
 */
export async function usuarios(limite = 500): Promise<FilaUsuario[]> {
  const { rows } = await db.execute<FilaUsuario>(sql`
    SELECT
      u.id,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido)), ''),
        u.name
      ) AS "nombre",
      u.email,
      p.empresa,
      p.cargo,
      p.tipo_perfil AS "tipoPerfil",
      p.telefono,
      COALESCE(p.acepta_novedades, false) AS "aceptaNovedades",
      to_char(u.created_at, 'YYYY-MM-DD') AS "registradoEn",
      COALESCE(c.total, 0)::int AS "consultas",
      to_char(c.ultima, 'YYYY-MM-DD HH24:MI') AS "ultimaActividad",
      (COALESCE(c.recientes, 0) >= 3 OR p.empresa IS NOT NULL) AS "caliente"
    FROM "user" u
    LEFT JOIN perfil p ON p.user_id = u.id
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) AS total,
        MAX(created_at) AS ultima,
        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS recientes
      FROM consultas
      GROUP BY user_id
    ) c ON c.user_id = u.id
    ORDER BY c.ultima DESC NULLS LAST, u.created_at DESC
    LIMIT ${limite}
  `);
  return rows;
}

export async function consultasRecientes(
  limite = 300,
  soloSinCobertura = false
): Promise<FilaConsulta[]> {
  const filtro = soloSinCobertura
    ? sql`WHERE c.recomendacion = 'declarar_ausencia' OR f.util = false`
    : sql``;
  const { rows } = await db.execute<FilaConsulta>(sql`
    SELECT
      c.id,
      c.pregunta,
      c.confianza,
      c.recomendacion,
      c.top_cita AS "topCita",
      to_char(c.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt",
      u.email,
      u.name AS "nombre",
      p.empresa,
      f.util AS "votoUtil",
      f.comentario
    FROM consultas c
    JOIN "user" u ON u.id = c.user_id
    LEFT JOIN perfil p ON p.user_id = c.user_id
    LEFT JOIN feedback f ON f.consulta_id = c.id
    ${filtro}
    ORDER BY c.created_at DESC
    LIMIT ${limite}
  `);
  return rows;
}

/**
 * Ranking de conceptos que el motor no encontró en el corpus. Es el backlog
 * regulatorio: cada línea es una norma que alguien buscó y no está.
 */
export async function huecosDelCorpus(dias = 30, limite = 40): Promise<HuecoCorpus[]> {
  const { rows } = await db.execute<HuecoCorpus>(sql`
    SELECT
      concepto,
      COUNT(*)::int AS veces,
      (array_agg(pregunta ORDER BY created_at DESC))[1] AS ejemplo
    FROM (
      SELECT
        jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(conceptos_fuera) = 'array'
               THEN conceptos_fuera ELSE '[]'::jsonb END
        ) AS concepto,
        pregunta,
        created_at
      FROM consultas
      WHERE created_at > now() - (${dias} || ' days')::interval
    ) x
    GROUP BY concepto
    ORDER BY veces DESC, concepto
    LIMIT ${limite}
  `);
  return rows;
}

export async function resumen(): Promise<Resumen> {
  const { rows } = await db.execute<Resumen>(sql`
    SELECT
      (SELECT COUNT(*) FROM "user")::int AS "usuarios",
      (SELECT COUNT(*) FROM "user" WHERE created_at > now() - interval '7 days')::int
        AS "usuariosNuevos7d",
      (SELECT COUNT(*) FROM consultas WHERE created_at > now() - interval '7 days')::int
        AS "consultas7d",
      (SELECT COUNT(*) FROM consultas)::int AS "consultasTotales",
      (SELECT COUNT(*) FROM consultas
        WHERE created_at > now() - interval '7 days'
          AND recomendacion = 'declarar_ausencia')::int AS "sinCobertura7d",
      (SELECT COUNT(*) FROM feedback
        WHERE created_at > now() - interval '7 days' AND util = false)::int
        AS "votosNegativos7d"
  `);
  return rows[0];
}
