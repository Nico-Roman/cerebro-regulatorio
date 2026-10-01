// Lo que no puede salir hacia Sentry: el texto de las preguntas ni el cuerpo de
// las solicitudes (encargo E).

import assert from "node:assert/strict";
import { test } from "node:test";

import { limpiarEvento, limpiarMiga } from "../lib/sentry-limpiar.ts";

test("limpiarEvento borra cuerpo, query, cookies y extras de la solicitud", () => {
  const e = limpiarEvento({
    request: {
      url: "https://regulamed.cl/api/search?q=paciente%20Juan%20P%C3%A9rez",
      data: { texto: "observación pegada" },
      query_string: "q=paciente",
      cookies: { s: "1" },
      headers: { Cookie: "s=1", Authorization: "x", "User-Agent": "UA" },
    },
    extra: { pregunta: "algo" },
    message: "TypeError",
  });
  assert.deepEqual(e, {
    request: { url: "https://regulamed.cl/api/search", headers: { "User-Agent": "UA" } },
    message: "TypeError",
  });
});

test("limpiarMiga quita cuerpos y consultas de fetch, y descarta la consola", () => {
  assert.deepEqual(
    limpiarMiga({ category: "fetch", data: { url: "/api/search?q=hola", method: "GET", body: "x" } }),
    { category: "fetch", data: { url: "/api/search", method: "GET" } }
  );
  assert.equal(limpiarMiga({ category: "console", message: "pregunta: hola" }), null);
  assert.deepEqual(limpiarMiga({ category: "navigation", data: { from: "/normativa?q=a", to: "/historial" } }), {
    category: "navigation",
    data: { from: "/normativa", to: "/historial" },
  });
});
