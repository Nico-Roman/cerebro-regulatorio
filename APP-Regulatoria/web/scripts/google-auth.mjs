// Obtiene el refresh token de Google Calendar para la agenda. Se corre UNA vez,
// en el PC de Nico, con las credenciales del cliente OAuth "agenda interna".
//
//   node scripts/google-auth.mjs
//
// Necesita GOOGLE_CAL_CLIENT_ID y GOOGLE_CAL_CLIENT_SECRET en el entorno (o en
// un .env.local que cargues antes). Abre el consentimiento en el navegador,
// recibe el código en http://localhost:5858/callback y muestra el refresh token
// para pegarlo en Railway.
//
// Importante: la app OAuth debe estar PUBLICADA ("en producción") en Google
// Cloud. En modo de prueba el refresh token caduca a los 7 días y la agenda se
// rompe sola cada semana.

import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GOOGLE_CAL_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CAL_CLIENT_SECRET;
const REDIRECT = "http://localhost:5858/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Falta GOOGLE_CAL_CLIENT_ID o GOOGLE_CAL_CLIENT_SECRET.\n" +
      "Créalos en Google Cloud → APIs y servicios → Credenciales → ID de cliente OAuth (aplicación web),\n" +
      `con este URI de redirección autorizado: ${REDIRECT}`
  );
  process.exit(1);
}

const autorizacion =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    // Sin estas dos, Google no entrega refresh token en el segundo intento.
    access_type: "offline",
    prompt: "consent",
  });

const servidor = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) {
    res.writeHead(404).end();
    return;
  }

  const codigo = new URL(req.url, "http://localhost:5858").searchParams.get("code");
  if (!codigo) {
    res.writeHead(400).end("Sin código en la respuesta de Google.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  const datos = await tokenRes.json();
  res
    .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    .end("<p>Listo. Vuelve a la terminal.</p>");

  if (!datos.refresh_token) {
    console.error("\nGoogle no devolvió refresh_token. Respuesta:", datos);
    console.error(
      "Suele pasar si ya habías autorizado antes: revoca el acceso en " +
        "https://myaccount.google.com/permissions y repite."
    );
    process.exit(1);
  }

  console.log("\n─────────────────────────────────────────────");
  console.log("GOOGLE_REFRESH_TOKEN=" + datos.refresh_token);
  console.log("─────────────────────────────────────────────");
  console.log("Pégalo como variable en Railway (servicio cerebro-regulatorio).");
  console.log("No lo subas al repo ni lo pegues en un chat.");
  servidor.close();
  process.exit(0);
});

servidor.listen(5858, () => {
  console.log("Abriendo el consentimiento de Google en el navegador…");
  console.log("Si no se abre solo, entra a esta URL:\n" + autorizacion + "\n");
  const abrir =
    process.platform === "win32"
      ? `start "" "${autorizacion}"`
      : process.platform === "darwin"
        ? `open "${autorizacion}"`
        : `xdg-open "${autorizacion}"`;
  exec(abrir);
});
