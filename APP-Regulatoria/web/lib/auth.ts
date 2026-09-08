// Configuración de Better Auth. Vive del lado servidor solamente: este módulo
// nunca debe importarse desde un componente cliente.
//
// Decisiones:
// - Google como método principal (el público objetivo entra con cuenta
//   corporativa o personal de Google y así el nombre y correo llegan
//   verificados, que es lo que convierte un registro en un lead útil).
// - El enlace mágico está implementado pero apagado por defecto: enviar correos
//   de acceso desde onboarding@resend.dev termina en spam. Se enciende con
//   AUTH_MAGIC_LINK=1 una vez que regulamed.cl esté verificado en Resend.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { db, schema } from "@/lib/db";
import { SITE } from "@/lib/site";
import { enviarCorreo } from "@/lib/correo";

export const MAGIC_LINK_ACTIVO = process.env.AUTH_MAGIC_LINK === "1";

const plugins = [
  ...(MAGIC_LINK_ACTIVO
    ? [
        magicLink({
          expiresIn: 60 * 15,
          sendMagicLink: async ({ email, url }) => {
            await enviarCorreo({
              to: email,
              subject: `Tu acceso a ${SITE.nombre}`,
              html: `
                <p>Hola,</p>
                <p>Entra al buscador normativo de ${SITE.nombre} con este enlace:</p>
                <p><a href="${url}">Entrar a ${SITE.nombre}</a></p>
                <p style="color:#666">El enlace vence en 15 minutos y solo sirve una vez.
                Si no lo pediste, ignora este correo.</p>
              `,
            });
          },
        }),
      ]
    : []),
  // nextCookies va último a propósito: escribe las cookies de sesión en la
  // respuesta y necesita correr después de cualquier otro plugin.
  nextCookies(),
];

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    // Sin esto, un despliegue detrás del proxy de Railway puede emitir cookies
    // sin el atributo Secure y el navegador las descarta en https.
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins,
});

export const GOOGLE_CONFIGURADO = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
