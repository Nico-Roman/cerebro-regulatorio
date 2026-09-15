// Evalúa la capa de IA sin servidor ni base de datos: motor TypeScript real,
// prompt real (lib/ia/redactar.ts) y modelo real, sobre cerebro/preguntas-reales.json.
//
//   node --experimental-strip-types --no-warnings scripts/eval-ia-local.mjs
//   node ... scripts/eval-ia-local.mjs --solo d01-ram-grave,h16-contrato
//   node ... scripts/eval-ia-local.mjs --salida ruta/resultado.json
//
// Lee LLM_API_KEY, LLM_BASE_URL y LLM_MODEL del entorno o, si faltan, de
// .env.local. Nunca los imprime.
//
// Qué mide, por tipo de pregunta:
//   respondible  ¿cita un pasaje que de verdad contiene la evidencia? Solo se
//                cuenta sobre las preguntas donde la evidencia llegó a los
//                pasajes: el modelo no puede citar lo que el motor no le dio.
//   fuera        ¿se abstiene? (la compuerta del motor ya corta las "ausente")
//   sin_texto    ¿se abstiene, o al menos dice que los pasajes no tratan el caso
//                etiquetado («uso personal»)? Si presenta la regla de otra
//                materia como la respuesta, «responde otra cosa» (d15, d26).
//   todas        citas a pasajes inexistentes, redacciones sin ninguna cita,
//                cifras o normas que no están en los pasajes, y borradores cuyo
//                caso los pasajes citados no tratan sin advertirlo.
//
// Exit 1 si no aprueba: cita con evidencia >= 90 %, abstención fuera 100 %,
// cero que responden otra cosa, cero citas inválidas, cero redacciones sin
// cita y cero datos sin respaldo. Los casos no cubiertos se informan.

import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREGUNTAS = path.join(WEB, "..", "cerebro", "preguntas-reales.json");

// Los módulos de lib/ importan con el alias "@/" de Next. Node no lo conoce:
// se resuelve acá al archivo .ts correspondiente.
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith("@/")) {
      const base = path.join(WEB, especificador.slice(2));
      const archivo = fs.existsSync(`${base}.ts`) ? `${base}.ts` : base;
      return siguiente(pathToFileURL(archivo).href, contexto);
    }
    return siguiente(especificador, contexto);
  },
});

function cargarEnvLocal() {
  const ruta = path.join(WEB, ".env.local");
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, "utf-8").split(/\r?\n/)) {
    const m = linea.match(/^\s*(LLM_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

cargarEnvLocal();
if (!process.env.LLM_API_KEY) {
  console.error("Falta LLM_API_KEY (en el entorno o en .env.local).");
  process.exit(1);
}

const { crearIndice, loadCorpus, responder } = await import("../lib/search.ts");
const { pasajesDesdeRespuesta, redactarRespuesta } = await import("../lib/ia/redactar.ts");
const { ErrorProveedor, modeloActual } = await import("../lib/ia/proveedor.ts");
const { casoSinSalvedad } = await import("../lib/ia/verificar.ts");

// Mismos valores que app/api/responder/route.ts.
const PASAJES_AL_MODELO = 6;
// Precios Groq openai/gpt-oss-120b al 14-09-2026, US$ por millón de tokens.
const PRECIO = { entrada: 0.15, salida: 0.6 };

const solo = argumento("--solo")?.split(",");
let { preguntas } = JSON.parse(fs.readFileSync(PREGUNTAS, "utf-8"));
if (solo) preguntas = preguntas.filter((p) => solo.includes(p.id));

const idx = crearIndice(loadCorpus(path.join(WEB, "data", "corpus.jsonl")));

function evidenciaEn(fila, evidencia) {
  return evidencia.some(
    (ev) =>
      (!ev.numero || new RegExp(`^(?:${ev.numero})$`).test(fila._numero || "")) &&
      new RegExp(ev.contiene, "i").test(fila.texto)
  );
}

async function redactarConReintentos(pregunta, pasajes) {
  for (let intento = 1; ; intento++) {
    try {
      return await redactarRespuesta(pregunta, pasajes);
    } catch (e) {
      if (e instanceof ErrorProveedor && e.status === 429 && intento <= 8) {
        const espera = (e.reintentarEnSeg ?? 20) + 1;
        // Una espera larga es el tope diario del tier gratuito, no el por
        // minuto: mejor fallar con el mensaje que quedarse colgado en silencio.
        if (espera > 120) {
          throw new Error(`tope del proveedor, pide esperar ${espera} s: ${e.message.slice(0, 200)}`);
        }
        process.stderr.write(`  429 del proveedor, espero ${espera} s…\n`);
        await new Promise((r) => setTimeout(r, espera * 1000));
        continue;
      }
      throw e;
    }
  }
}

const filas = [];
console.log(`Modelo: ${modeloActual()} · ${preguntas.length} preguntas\n`);

for (const p of preguntas) {
  const respuesta = responder(p.pregunta, { k: PASAJES_AL_MODELO }, idx);
  const crudas = (respuesta.principal ? [respuesta.principal] : []).concat(respuesta.relacionadas);
  const pasajes = pasajesDesdeRespuesta(respuesta);
  const fila = { id: p.id, set: p.set, tipo: p.tipo, estadoMotor: respuesta.estado };

  if (respuesta.estado === "ausente" || !pasajes.length) {
    Object.assign(fila, { llamada: false, abstuvo: true });
    filas.push(fila);
    console.log(`${p.id.padEnd(30)} motor ausente → no se llama al modelo`);
    continue;
  }

  const alcanzable = p.tipo === "respondible" && crudas.some((f) => evidenciaEn(f, p.evidencia));

  try {
    const s = await redactarConReintentos(p.pregunta, pasajes);
    const r = s.redaccion;
    const citaConEvidencia = r.fuentes.some((f) => evidenciaEn(crudas[f.n - 1], p.evidencia));
    const datoEnTexto = p.evidencia.some((ev) => new RegExp(ev.contiene, "i").test(r.texto));
    // Contra la etiqueta humana del caso, no contra la señal automática: esto es
    // lo que dice si la señal de producción (casoNoCubierto) sirve.
    const respondeOtraCosa =
      p.tipo === "sin_texto" && !r.abstuvo && Boolean(p.caso) && casoSinSalvedad(r.texto, [p.caso]).length > 0;
    Object.assign(fila, {
      respondeOtraCosa,
      casoNoCubierto: r.casoNoCubierto,
      llamada: true,
      alcanzable,
      abstuvo: r.abstuvo,
      citaConEvidencia,
      datoEnTexto,
      citasInvalidas: r.citasInvalidas,
      sinCitas: r.sinCitas,
      datosNoVerificados: r.datosNoVerificados,
      tokensEntrada: s.tokensEntrada,
      tokensSalida: s.tokensSalida,
      tokensRazonamiento: s.tokensRazonamiento,
      latenciaMs: s.latenciaMs,
      texto: r.texto,
    });
    const marca =
      p.tipo === "respondible"
        ? r.abstuvo
          ? alcanzable ? "⚠ se abstuvo con evidencia" : "se abstuvo (sin evidencia)"
          : citaConEvidencia ? "✓ cita con evidencia" : alcanzable ? "✗ cita sin evidencia" : "· evidencia no llegó"
        : r.abstuvo
          ? "✓ se abstuvo"
          : p.tipo === "sin_texto"
            ? respondeOtraCosa ? "✗ responde otra cosa" : "✓ advierte el caso"
            : "✗ NO se abstuvo";
    const alertas = [
      r.citasInvalidas.length ? "CITA INVÁLIDA" : "",
      r.sinCitas ? "SIN CITAS" : "",
      r.datosNoVerificados.length ? `DATOS SIN RESPALDO (${r.datosNoVerificados.join(",")})` : "",
      r.casoNoCubierto.length ? `CASO NO CUBIERTO (${r.casoNoCubierto.join(",")})` : "",
    ].filter(Boolean);
    console.log(
      `${p.id.padEnd(30)} ${p.tipo.padEnd(12)} ${marca.padEnd(28)} ${String(s.tokensEntrada).padStart(5)}→${String(s.tokensSalida).padStart(4)} tok  ${alertas.join(" ")}`
    );
  } catch (e) {
    Object.assign(fila, { llamada: true, error: String(e.message || e).slice(0, 200) });
    console.log(`${p.id.padEnd(30)} ERROR ${fila.error}`);
  }
  filas.push(fila);
}

// ── Resumen ───────────────────────────────────────────────────────────────────
const llamadas = filas.filter((f) => f.llamada && !f.error);
const alcanzables = llamadas.filter((f) => f.tipo === "respondible" && f.alcanzable);
const citaOk = alcanzables.filter((f) => f.citaConEvidencia).length;
const abstuvoConEvidencia = alcanzables.filter((f) => f.abstuvo).length;
const fuera = filas.filter((f) => f.tipo === "fuera");
const fueraOk = fuera.filter((f) => f.abstuvo).length;
const sinTexto = filas.filter((f) => f.tipo === "sin_texto");
const sinTextoAbst = sinTexto.filter((f) => f.abstuvo).length;
const invalidas = llamadas.filter((f) => f.citasInvalidas.length).length;
const sinCitas = llamadas.filter((f) => f.sinCitas).length;
const cifrasSinRespaldo = llamadas.filter((f) => f.datosNoVerificados?.length).length;
const casoNoCubierto = llamadas.filter((f) => f.casoNoCubierto?.length).length;
const respondenOtraCosa = sinTexto.filter((f) => f.respondeOtraCosa).length;
const errores = filas.filter((f) => f.error).length;

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b);
  return o.length ? o[Math.floor(o.length / 2)] : 0;
};
const tin = llamadas.map((f) => f.tokensEntrada);
const tout = llamadas.map((f) => f.tokensSalida);
const trazo = llamadas.map((f) => f.tokensRazonamiento);
const lat = llamadas.map((f) => f.latenciaMs);
const costoLlamada = (media(tin) * PRECIO.entrada + media(tout) * PRECIO.salida) / 1e6;
const fraccionLlamadas = filas.length ? llamadas.length / filas.length : 0;

const resumen = {
  fecha: new Date().toISOString(),
  modelo: modeloActual(),
  preguntas: filas.length,
  llamadasAlModelo: llamadas.length,
  errores,
  citaConEvidencia: `${citaOk}/${alcanzables.length}`,
  abstuvoConEvidencia,
  abstencionFuera: `${fueraOk}/${fuera.length}`,
  abstencionSinTexto: `${sinTextoAbst}/${sinTexto.length}`,
  sinTextoQueRespondenOtraCosa: respondenOtraCosa,
  redaccionesConCitaInvalida: invalidas,
  redaccionesSinCitas: sinCitas,
  redaccionesConDatosSinRespaldo: cifrasSinRespaldo,
  redaccionesConCasoNoCubierto: casoNoCubierto,
  tokens: {
    entradaMedia: Math.round(media(tin)),
    salidaMedia: Math.round(media(tout)),
    salidaMediana: mediana(tout),
    salidaMax: Math.max(0, ...tout),
    razonamientoMedio: Math.round(media(trazo)),
  },
  latenciaMedianaMs: mediana(lat),
  costoUsdPorLlamada: Number(costoLlamada.toFixed(6)),
  costoUsdPorConsultaConCompuerta: Number((costoLlamada * fraccionLlamadas).toFixed(6)),
};

const tasaCita = alcanzables.length ? citaOk / alcanzables.length : 0;
const aprueba =
  errores === 0 &&
  tasaCita >= 0.9 &&
  fueraOk === fuera.length &&
  invalidas === 0 &&
  sinCitas === 0 &&
  cifrasSinRespaldo === 0 &&
  respondenOtraCosa === 0;
// casoNoCubierto se informa pero no reprueba: es una heurística conservadora
// (en producción advierte y no cachea). Lo que reprueba es la etiqueta humana,
// respondenOtraCosa. En la corrida del 14-09-2026 su único caso, d05, fue un
// acierto: el borrador extendió a las «recetas cheque» una regla cuyo pasaje no
// las nombra.

console.log("\n─── Capa de IA ───");
console.log(JSON.stringify(resumen, null, 2));
console.log(aprueba ? "\n✅ IA APROBADA" : "\n⛔ IA NO APROBADA");

const salida = argumento("--salida");
if (salida) fs.writeFileSync(salida, JSON.stringify({ resumen, filas }, null, 2));

process.exit(aprueba ? 0 : 1);
