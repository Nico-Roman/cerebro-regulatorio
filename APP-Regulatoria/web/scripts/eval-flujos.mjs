// Evaluación de los flujos del asistente (encargo D) sobre cerebro/casos-flujos/casos.json.
//
//   node --experimental-strip-types --no-warnings scripts/eval-flujos.mjs
//   node ... scripts/eval-flujos.mjs --salida ../cerebro/informes/eval-flujos.md
//   node ... scripts/eval-flujos.mjs --sin-modelo     # solo lo determinista
//
// Qué hace:
//   tramite        comprueba que la tabla dé la ruta esperada (determinista) y,
//                  con modelo, escribe la explicación con citas.
//   observaciones  corre el flujo completo (filtro de pacientes, búsquedas,
//                  redacción, verificación) y escribe las salidas para que Nico
//                  marque cada una como usable, con edición o peligrosa.
// Además lista las rutas que faltan por validar en lib/flujos/rutas.json.
//
// Lee LLM_API_KEY, LLM_BASE_URL y LLM_MODEL del entorno o de .env.local, y nunca
// los imprime. En CI lo corre .github/workflows/eval-flujos.yml.

import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASOS = path.join(WEB, "..", "cerebro", "casos-flujos", "casos.json");

registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) {
      const base = path.join(WEB, esp.slice(2));
      return next(pathToFileURL(fs.existsSync(`${base}.ts`) ? `${base}.ts` : base).href, ctx);
    }
    return next(esp, ctx);
  },
});

const ruta = path.join(WEB, ".env.local");
if (fs.existsSync(ruta)) {
  for (const linea of fs.readFileSync(ruta, "utf-8").split(/\r?\n/)) {
    const m = linea.match(/^\s*(LLM_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const argumento = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const conModelo = !process.argv.includes("--sin-modelo") && Boolean(process.env.LLM_API_KEY);

const { crearIndice, loadCorpus, responder } = await import("../lib/search.ts");
const T = await import("../lib/flujos/tramite.ts");
const O = await import("../lib/flujos/observacion.ts");
const { detectarDatosPacientes } = await import("../lib/flujos/pacientes.ts");
const { MAX_PASAJES, planificarBusquedas, unirPasajes } = await import("../lib/ia/planificar.ts");
const { completar, configDesdeEntorno } = await import("../lib/ia/proveedor.ts");
const { pasajesDesdeResultados, resolverCitas } = await import("../lib/ia/redactar.ts");

const config = configDesdeEntorno();
const idx = crearIndice(loadCorpus());
const casos = JSON.parse(fs.readFileSync(CASOS, "utf-8"));
const L = [`# Evaluación de los flujos — ${new Date().toISOString().slice(0, 10)}`, ""];
L.push(conModelo ? `Modelo: \`${config.modelo}\`.` : "Sin modelo (falta LLM_API_KEY o --sin-modelo): solo la parte determinista.", "");

// ── ¿Qué trámite necesito? ──────────────────────────────────────────────────
let rutasOk = 0;
const filasTramite = [];
for (const c of casos.tramite) {
  const r = T.resolverRuta(c.respuestas);
  const ok = r?.id === c.ruta_esperada;
  if (ok) rutasOk++;
  let explicacion = "";
  if (conModelo && r?.en_la_base && r.normas.length) {
    const filas = unirPasajes(r.normas.map((n) => responder(n.busqueda, { k: 3 }, idx)), MAX_PASAJES);
    const pasajes = pasajesDesdeResultados(filas);
    if (pasajes.length) {
      try {
        const s = await completar({ sistema: T.SISTEMA_TRAMITE, usuario: T.armarMensajeTramite(c.respuestas, r, pasajes), maxTokens: 1500, config });
        const rc = resolverCitas(s.texto, pasajes);
        explicacion = rc.texto + (rc.afirmacionesSinCita.length ? `\n\n> Afirmaciones sin cita: ${rc.afirmacionesSinCita.length}` : "");
      } catch (e) {
        explicacion = `(error del proveedor: ${String(e?.message || e).slice(0, 120)})`;
      }
    }
  }
  filasTramite.push({ c, r, ok, explicacion });
}
L.push(`## ¿Qué trámite necesito? — rutas ${rutasOk}/${casos.tramite.length} como se esperaba`, "");
for (const { c, r, ok, explicacion } of filasTramite) {
  L.push(`### ${c.id} ${ok ? "✅" : "❌"} ${T.describirRespuestas(c.respuestas)}`);
  L.push(`Ruta: \`${r?.id ?? "—"}\` (esperada \`${c.ruta_esperada}\`) · ${r?.autoridad ?? ""}`);
  if (explicacion) L.push("", explicacion);
  L.push("", "Nico: ☐ correcta ☐ a corregir ☐ fuera", "");
}

const sinValidar = T.rutasSinValidar();
L.push(`## Rutas por validar (${sinValidar.length}/${T.RUTAS.length})`, "", ...sinValidar.map((id) => `- \`${id}\``), "");

// ── Observaciones del ISP ───────────────────────────────────────────────────
const obs = casos.observaciones.filter((o) => o.observacion?.trim());
L.push(`## Observaciones del ISP — ${obs.length} con texto de ${casos.observaciones.length}`, "");
for (const o of obs) {
  L.push(`### ${o.id} · ${o.producto}`, "", `> ${o.observacion.replace(/\n/g, "\n> ")}`, "");
  const pac = detectarDatosPacientes(o.observacion);
  if (pac.bloquear) {
    L.push(`**Bloqueada por datos de pacientes** (${pac.motivos.join(", ")}). Revisa el caso: no debería traerlos.`, "");
    continue;
  }
  if (!conModelo) {
    L.push("(sin modelo)", "");
    continue;
  }
  try {
    const plan = await planificarBusquedas(`Observación del ISP sobre un ${o.producto.toLowerCase()}: ${o.observacion.slice(0, 1500)}`, { config });
    const resp = [o.observacion.slice(0, 500), ...plan.busquedas.slice(1)].map((b) => responder(b, { k: 6 }, idx));
    const pasajes = pasajesDesdeResultados(unirPasajes(resp, MAX_PASAJES));
    const s = await completar({ sistema: O.SISTEMA_OBSERVACION, usuario: O.armarMensajeObservacion(o.observacion, o.producto, pasajes), maxTokens: 2500, config });
    const v = O.verificarObservacion(s.texto, o.observacion, pasajes);
    L.push(`**${O.ETIQUETA_BORRADOR}**`, "", resolverCitas(s.texto, pasajes).texto, "");
    L.push(
      `Verificación: cifras sin respaldo ${v.cifrasSinRespaldo.length ? v.cifrasSinRespaldo.join(", ") : "ninguna"} · ` +
        `normas sin respaldo ${v.normasSinRespaldo.length ? v.normasSinRespaldo.join(", ") : "ninguna"} · ` +
        `afirmaciones sin cita ${v.afirmacionesSinCita.length}`,
      ""
    );
    if (o.respuesta_nico) L.push(`Lo que respondería Nico: ${o.respuesta_nico} (${o.norma})`, "");
  } catch (e) {
    L.push(`(error: ${String(e?.message || e).slice(0, 160)})`, "");
  }
  L.push("Nico: ☐ usable ☐ usable con edición menor ☐ peligrosa", "");
}

const informe = L.join("\n");
const salida = argumento("--salida");
if (salida) {
  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  fs.writeFileSync(salida, informe);
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, informe + "\n");
process.stdout.write(informe + "\n");
// Exit 1 si la tabla no da las rutas esperadas: eso sí es determinista.
process.exit(rutasOk === casos.tramite.length ? 0 : 1);
