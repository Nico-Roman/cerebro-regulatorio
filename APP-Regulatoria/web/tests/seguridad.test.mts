// Pruebas de los helpers de los que depende que algo NO pase: el destino de
// redirección, el escape de lo que va a un correo o a un <script>, la IP que
// alimenta los límites de uso y el CSV que se abre en Excel.
//
// Corren con el runner de Node (`npm test`), sin framework ni dependencias: son
// funciones puras y no necesitan base de datos. Se eligieron estas cuatro
// porque cada una nació de un agujero real ya tapado, y una prueba es lo que
// impide que vuelva a abrirse sin que nadie se dé cuenta.

import assert from "node:assert/strict";
import { test } from "node:test";

import { aCsv, celdaCsv } from "../lib/csv.ts";
import { destinoSeguro } from "../lib/destino.ts";
import { escaparHtml, jsonParaScript, urlSegura } from "../lib/html.ts";
import { ipCliente } from "../lib/ip.ts";

test("destinoSeguro solo acepta rutas internas", () => {
  assert.equal(destinoSeguro("/normativa?q=ley"), "/normativa?q=ley");
  assert.equal(destinoSeguro("/perfil"), "/perfil");

  // Open redirect: todas estas terminan en un dominio ajeno.
  assert.equal(destinoSeguro("//evil.com"), "/normativa");
  assert.equal(destinoSeguro("/\\evil.com"), "/normativa");
  assert.equal(destinoSeguro("https://evil.com"), "/normativa");
  assert.equal(destinoSeguro("/ruta\r\nLocation: https://evil.com"), "/normativa");
  assert.equal(destinoSeguro(null), "/normativa");
  assert.equal(destinoSeguro(""), "/normativa");
});

test("escaparHtml neutraliza el HTML que escribe una persona", () => {
  assert.equal(
    escaparHtml('<a href="x">hola</a>'),
    "&lt;a href=&quot;x&quot;&gt;hola&lt;/a&gt;"
  );
  assert.equal(escaparHtml("Tomás & Cía"), "Tomás &amp; Cía");
  assert.equal(escaparHtml(null), "");
});

test("urlSegura deja pasar solo http y https", () => {
  assert.equal(urlSegura("https://meet.google.com/abc"), "https://meet.google.com/abc");
  assert.equal(urlSegura("javascript:alert(1)"), null);
  assert.equal(urlSegura("data:text/html,<script>"), null);
  assert.equal(urlSegura(""), null);
});

test("jsonParaScript no deja cerrar la etiqueta script", () => {
  const salida = jsonParaScript({ nombre: "</script><img onerror=alert(1)>" });
  assert.ok(!salida.includes("</script>"));
  assert.ok(!salida.includes("<"));
  // Sigue siendo el mismo dato: escapar no puede cambiar lo que Google lee.
  assert.deepEqual(JSON.parse(salida), { nombre: "</script><img onerror=alert(1)>" });
});

test("ipCliente ignora la IP que declara el cliente", () => {
  // Railway pone la IP real en X-Real-IP y la agrega al final de la cadena.
  const conReal = new Headers({
    "x-real-ip": "200.1.2.3",
    "x-forwarded-for": "1.1.1.1, 200.1.2.3",
  });
  assert.equal(ipCliente(conReal), "200.1.2.3");

  // Sin X-Real-IP, vale el último de la cadena: los anteriores los escribe quien
  // llama, y tomar el primero permitía saltarse el tope con una cabecera falsa.
  const soloCadena = new Headers({ "x-forwarded-for": "9.9.9.9, 200.1.2.3" });
  assert.equal(ipCliente(soloCadena), "200.1.2.3");

  assert.equal(ipCliente(new Headers()), "sin-ip");
});

test("celdaCsv desactiva las fórmulas de Excel", () => {
  // Una pregunta que empieza con = llegaba viva a la planilla del panel.
  assert.equal(celdaCsv('=HYPERLINK("https://evil.cl","ver")'), '"\'=HYPERLINK(""https://evil.cl"",""ver"")"');
  for (const inicio of ["=", "+", "-", "@"]) {
    assert.ok(celdaCsv(`${inicio}cmd`).startsWith(`"'${inicio}`), `falta la comilla con ${inicio}`);
  }
  // El texto normal no se toca.
  assert.equal(celdaCsv("Resolución 1.777"), '"Resolución 1.777"');
  assert.equal(celdaCsv(null), '""');
});

test("aCsv arma encabezado y filas con separador de punto y coma", () => {
  const csv = aCsv([
    { email: "a@b.cl", pregunta: 'dice "hola"' },
    { email: "c@d.cl", pregunta: "=1+1" },
  ]);
  assert.equal(
    csv,
    'email;pregunta\r\n"a@b.cl";"dice ""hola"""\r\n"c@d.cl";"\'=1+1"'
  );
  assert.equal(aCsv([]), "");
});

test("redirigir usa Location relativo y solo rutas internas", async () => {
  const { redirigir } = await import("../lib/redirigir.ts");
  const r = redirigir("/admin/agenda?guardado=1");
  assert.equal(r.status, 303);
  // Relativo: nunca la dirección interna del contenedor (0.0.0.0:8080).
  assert.equal(r.headers.get("location"), "/admin/agenda?guardado=1");
  assert.equal(redirigir("//evil.com").headers.get("location"), "/");
  assert.equal(redirigir("https://evil.com").headers.get("location"), "/");
});
