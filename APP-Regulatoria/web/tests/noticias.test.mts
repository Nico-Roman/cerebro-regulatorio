// El archivo de noticias lo escribe un flujo de n8n con un commit directo a
// main. n8n lo valida antes de publicar, pero un testigo que le cree al
// vigilado no es un testigo: CI lo vuelve a validar con las reglas del sitio.

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { problemasArchivo, problemasNoticia } from "../lib/noticias-validar.ts";

const archivo = new URL("../data/noticias.json", import.meta.url);

test("data/noticias.json cumple las reglas del sitio", () => {
  const datos = JSON.parse(fs.readFileSync(archivo, "utf-8"));
  assert.deepEqual(problemasArchivo(datos), []);
});

test("hay al menos una noticia", () => {
  const { noticias } = JSON.parse(fs.readFileSync(archivo, "utf-8"));
  assert.ok(noticias.length > 0);
});

test("las reglas detectan los errores típicos de una nota generada", () => {
  const base = {
    titulo: "ISP alerta retiro de lotes de un medicamento",
    categoria: "farmaceuticos",
    ambito: "Chile",
    fecha: "2026-10-08",
    fuente: "ISP",
    url: "https://www.ispch.gob.cl/noticia/x/",
  };
  assert.deepEqual(problemasNoticia(base), []);
  assert.ok(problemasNoticia({ ...base, categoria: "alimentos" }).length);
  assert.ok(problemasNoticia({ ...base, fecha: "2026-02-30" }).length);
  assert.ok(problemasNoticia({ ...base, url: "http://www.fda.gov/x" }).length);
  assert.ok(problemasNoticia({ ...base, destacada: true }).length, "destacada sin resumen");
  assert.ok(
    problemasArchivo({ actualizadas: "2026-10-08", noticias: [base, base] }).some((p) =>
      p.includes("repetida"),
    ),
  );
});
