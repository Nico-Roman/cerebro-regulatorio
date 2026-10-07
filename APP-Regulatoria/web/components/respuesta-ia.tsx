"use client";

// Borrador redactado con IA a partir de los pasajes de la búsqueda.
//
// Se pide solo al terminar cada búsqueda: desde el 07-10-2026 no hay
// interruptor «Modo IA». Cada borrador nuevo cuenta en las preguntas del día;
// uno reutilizado de una consulta idéntica, no.
//
// Se presenta siempre como borrador, junto a la frase de la norma y nunca en su
// lugar: la cita y el texto oficial mandan por sobre el resumen. Va arriba del
// pasaje porque en las pruebas en vivo acertó donde el pasaje no.
//
// Presentación (07-10-2026): el borrador vive en una tarjeta con filo de neón.
// Las citas, que el servidor entrega como «[cita; cita]» dentro del texto, se
// muestran como números que llevan a la fuente oficial, y la cita completa
// queda en la lista «Pasajes que citó». El verde encendido se reserva para
// borradores sin ninguna señal de alerta: una abstención, un error o un
// borrador con avisos usan la tarjeta neutra.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Estado = "inicial" | "cargando" | "listo" | "ausencia" | "error";

interface Fuente {
  n: number;
  cita: string;
  norma: string;
  fuenteUrl: string;
}

interface Borrador {
  texto: string;
  fuentes: Fuente[];
  abstuvo: boolean;
  citasInvalidas: boolean;
  sinCitas: boolean;
  datosNoVerificados: string[];
  casoNoCubierto: string[];
  cacheada: boolean;
}

// El servidor escribe esto en el lugar de una cita cuyo número no existe
// (lib/ia/redactar.ts, resolverCitas).
const CITA_INVALIDA = "cita no verificable";

/**
 * Separa el contenido de unos corchetes («cita; cita») en las fuentes que
 * nombra. Devuelve null si algo de adentro no es una cita conocida: entonces
 * los corchetes son texto de la norma y se muestran tal cual. Una posición en
 * null es una cita que el servidor no pudo verificar.
 */
function partirCitas(contenido: string, fuentes: Fuente[]): Array<Fuente | null> | null {
  // De la más larga a la más corta: «art. 50» no puede leerse como «art. 5».
  const porLargo = [...fuentes].sort((x, y) => y.cita.length - x.cita.length);
  const salida: Array<Fuente | null> = [];
  let resto = contenido.trim();
  while (resto) {
    if (resto.startsWith(CITA_INVALIDA)) {
      salida.push(null);
      resto = resto.slice(CITA_INVALIDA.length);
    } else {
      const actual = resto;
      const f = porLargo.find((x) => actual === x.cita || actual.startsWith(`${x.cita}; `));
      if (!f) return null;
      salida.push(f);
      resto = resto.slice(f.cita.length);
    }
    if (!resto) break;
    if (!resto.startsWith("; ")) return null;
    resto = resto.slice(2);
  }
  return salida.length ? salida : null;
}

interface OpcionesTexto {
  /** Fuentes citadas, en el orden de la lista: su posición es el número que se muestra. */
  fuentes: Fuente[];
  /** Avisa qué fuente está bajo el cursor, para destacarla en la lista. */
  alResaltar?: (n: number | null) => void;
  /** El dato en negrita va en verde solo en una respuesta sin alertas. */
  datoEnVerde: boolean;
}

/** Número de cita: lleva a la fuente oficial y destaca su fila en la lista. */
function MarcaCita({ fuente, numero, alResaltar }: { fuente: Fuente; numero: number; alResaltar?: (n: number | null) => void }) {
  const clase =
    "mr-0.5 ml-1 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded-full border border-accent/45 bg-accent/10 px-1 align-middle font-mono text-[10px] leading-none font-medium text-accent no-underline transition-colors";
  const eventos = {
    onMouseEnter: () => alResaltar?.(fuente.n),
    onMouseLeave: () => alResaltar?.(null),
    onFocus: () => alResaltar?.(fuente.n),
    onBlur: () => alResaltar?.(null),
  };
  if (!fuente.fuenteUrl) {
    return (
      <span title={fuente.cita} aria-label={`Cita ${numero}: ${fuente.cita}`} className={clase} {...eventos}>
        {numero}
      </span>
    );
  }
  return (
    <a
      href={fuente.fuenteUrl}
      target="_blank"
      rel="noreferrer"
      title={`${fuente.cita} · abre la fuente oficial`}
      aria-label={`Cita ${numero}: ${fuente.cita}. Abre la fuente oficial`}
      className={`${clase} hover:border-accent hover:bg-accent hover:text-accent-ink`}
      {...eventos}
    >
      {numero}
    </a>
  );
}

/**
 * Texto del modelo sin interpretar HTML: las negritas (**dato**) pasan a
 * <strong> y los corchetes de cita, a números de cita.
 */
function TextoRico({ texto, opciones, enNegrita = false }: { texto: string; opciones: OpcionesTexto; enNegrita?: boolean }) {
  const partes: ReactNode[] = [];
  const patron = enNegrita ? /\[([^[\]]+)\]/g : /\*\*(.+?)\*\*|\[([^[\]]+)\]/g;
  let desde = 0;
  let i = 0;
  for (const m of texto.matchAll(patron)) {
    const pos = m.index;
    const negrita = enNegrita ? undefined : m[1];
    const corchetes = enNegrita ? m[1] : m[2];

    if (negrita !== undefined) {
      if (pos > desde) partes.push(texto.slice(desde, pos));
      partes.push(
        <strong key={i++} className={opciones.datoEnVerde ? "dato-neon" : "font-medium text-neutral-50"}>
          <TextoRico texto={negrita} opciones={opciones} enNegrita />
        </strong>
      );
      desde = pos + m[0].length;
      continue;
    }

    const citas = corchetes ? partirCitas(corchetes, opciones.fuentes) : null;
    // Corchetes que no son una cita: son parte del texto.
    if (!citas) continue;
    const marcas = citas.map((f) =>
      f ? (
        <MarcaCita key={i++} fuente={f} numero={opciones.fuentes.indexOf(f) + 1} alResaltar={opciones.alResaltar} />
      ) : (
        <span key={i++} className="mx-0.5 border border-red-500/60 px-1 text-xs text-red-200">
          {CITA_INVALIDA}
        </span>
      )
    );
    // El número va pegado a la palabra que respalda: sin el espacio que lo
    // separaba y en un tramo que no se corta, para que no caiga solo al
    // renglón siguiente.
    const previo = texto.slice(desde, pos).replace(/[ \t]+$/, "");
    const ultima = previo.match(/\S+$/);
    if (ultima) {
      if (ultima.index) partes.push(previo.slice(0, ultima.index));
      partes.push(
        <span key={i++} className="whitespace-nowrap">
          {ultima[0]}
          {marcas}
        </span>
      );
    } else {
      if (previo) partes.push(previo);
      partes.push(...marcas);
    }
    desde = pos + m[0].length;
  }
  if (desde < texto.length) partes.push(texto.slice(desde));
  return <>{partes}</>;
}

export function RespuestaIa({ consultaId, automatico = true }: { consultaId: string; automatico?: boolean }) {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reintentable, setReintentable] = useState(false);
  // Fuente bajo el cursor (su número de pasaje), para destacarla en la lista.
  const [resaltada, setResaltada] = useState<number | null>(null);
  // Llegó a sus preguntas del día: no se vende nada, se ofrece la asesoría.
  const [limite, setLimite] = useState(false);
  // Preguntas con IA que le quedan hoy; null para el administrador (sin tope).
  const [restantesHoy, setRestantesHoy] = useState<number | null>(null);

  const pedir = useCallback(async () => {
    setEstado("cargando");
    setAviso(null);
    setReintentable(false);
    setLimite(false);
    try {
      const res = await fetch("/api/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultaId }),
      });
      const datos = await res.json().catch(() => ({}));

      if (res.status === 503 && datos.error === "proveedor_ocupado") {
        setAviso(datos.mensaje || "El redactor está ocupado. Reintenta en unos segundos.");
        setReintentable(true);
        setEstado("error");
        return;
      }
      if (res.status === 503 && (datos.error === "proveedor_agotado" || datos.error === "techo_sitio")) {
        setAviso(datos.mensaje);
        setEstado("error");
        return;
      }
      if (res.status === 503) {
        setAviso("La redacción con IA todavía no está habilitada.");
        setEstado("error");
        return;
      }
      if (res.status === 422 && datos.error === "fuera_de_proposito") {
        setAviso(datos.mensaje);
        setEstado("ausencia");
        return;
      }
      if (res.status === 429) {
        setAviso(datos.mensaje || "Llegaste a la cuota diaria de respuestas redactadas.");
        setLimite(datos.error === "limite_diario");
        setEstado("error");
        return;
      }
      if (!res.ok) {
        setAviso("No pudimos redactar la respuesta. Los pasajes de arriba siguen sirviendo.");
        setReintentable(true);
        setEstado("error");
        return;
      }
      if (datos.ausencia) {
        setAviso(datos.motivo);
        setEstado("ausencia");
        return;
      }
      setBorrador({
        texto: datos.respuesta,
        fuentes: datos.fuentes ?? [],
        abstuvo: Boolean(datos.abstuvo),
        citasInvalidas: Boolean(datos.citasInvalidas),
        sinCitas: Boolean(datos.sinCitas),
        datosNoVerificados: datos.datosNoVerificados ?? [],
        casoNoCubierto: datos.casoNoCubierto ?? [],
        cacheada: Boolean(datos.cacheada),
      });
      if (typeof datos.restantesHoy === "number") setRestantesHoy(datos.restantesHoy);
      setEstado("listo");
    } catch {
      setAviso("No pudimos redactar la respuesta. Los pasajes de arriba siguen sirviendo.");
      setReintentable(true);
      setEstado("error");
    }
  }, [consultaId]);

  // El componente nace con cada búsqueda (key={consultaId}); el ref evita la
  // doble llamada del modo estricto de React en desarrollo.
  const yaPidio = useRef(false);
  useEffect(() => {
    if (!automatico || yaPidio.current) return;
    yaPidio.current = true;
    void pedir();
  }, [automatico, pedir]);

  if (estado === "inicial") {
    return (
      <button
        type="button"
        onClick={pedir}
        className="self-start border border-line px-4 py-2 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
      >
        Redactar borrador con IA a partir de estos pasajes
      </button>
    );
  }

  const respondio = estado === "listo" && borrador !== null && !borrador.abstuvo;
  // Sin ninguna señal de alerta: solo entonces la tarjeta se enciende.
  const sinAlertas =
    respondio &&
    !borrador.citasInvalidas &&
    !borrador.sinCitas &&
    !borrador.datosNoVerificados.length &&
    !borrador.casoNoCubierto.length;
  const encendida = estado === "cargando" || sinAlertas;
  const opciones: OpcionesTexto = {
    fuentes: borrador?.fuentes ?? [],
    alResaltar: setResaltada,
    datoEnVerde: sinAlertas,
  };

  return (
    <section
      aria-live="polite"
      data-estado={estado}
      className={`flex flex-col gap-4 px-5 py-5 sm:px-6 ${encendida ? "tarjeta-neon" : "border border-line bg-surface"}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className={`label-micro flex items-center gap-2 ${encendida ? "text-accent" : "text-muted"}`}>
          <span
            aria-hidden
            className={
              encendida
                ? `punto-neon ${estado === "cargando" ? "animate-latido" : ""}`
                : "h-[0.4375rem] w-[0.4375rem] shrink-0 rounded-full bg-neutral-500"
            }
          />
          Borrador IA
        </span>
        {respondio && <span className="label-micro text-muted">Verifica contra la cita</span>}
      </header>

      {estado === "cargando" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Leyendo los pasajes y redactando…</p>
          <div aria-hidden className="flex flex-col gap-2.5">
            <span className="barra-espera w-11/12" />
            <span className="barra-espera w-full [animation-delay:120ms]" />
            <span className="barra-espera w-3/5 [animation-delay:240ms]" />
          </div>
        </div>
      )}

      {estado === "listo" && borrador && borrador.abstuvo && (
        <p className="text-sm leading-relaxed text-amber-200">
          <TextoRico texto={borrador.texto} opciones={{ fuentes: [], datoEnVerde: false }} />
        </p>
      )}

      {estado === "listo" && borrador && !borrador.abstuvo && (
        <>
          {(borrador.citasInvalidas || borrador.sinCitas || borrador.datosNoVerificados.length > 0) && (
            <p className="border-l-2 border-red-500/70 pl-3 text-xs leading-relaxed text-red-200">
              {borrador.citasInvalidas
                ? "Este borrador cita un pasaje que no existe. No lo uses sin revisar cada afirmación contra los pasajes de arriba."
                : borrador.sinCitas
                  ? "Este borrador no citó ningún pasaje. Trátalo como no verificado."
                  : `Este borrador menciona cifras o normas que no aparecen en los pasajes (${borrador.datosNoVerificados.join(", ")}). Verifícalas en la fuente antes de usarlas.`}
            </p>
          )}
          {borrador.casoNoCubierto.length > 0 && (
            <p className="border-l-2 border-amber-500/70 pl-3 text-xs leading-relaxed text-amber-200">
              {`Los pasajes que citó no mencionan ${borrador.casoNoCubierto.map((c) => `«${c}»`).join(", ")}: puede estar respondiendo con la regla de otro caso. Revisa si aplica a tu situación.`}
            </p>
          )}
          <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-neutral-100">
            <TextoRico texto={borrador.texto} opciones={opciones} />
          </div>
          {borrador.fuentes.length > 0 && (
            <div className={`flex flex-col gap-2 border-t pt-4 ${sinAlertas ? "border-accent/20" : "border-line"}`}>
              <span className="label-micro text-muted">Pasajes que citó</span>
              <ol className="flex flex-col">
                {borrador.fuentes.map((f, i) => (
                  <li
                    key={f.n}
                    className={`flex items-baseline gap-3 border-l-2 py-1.5 pl-3 text-xs transition-colors ${
                      resaltada === f.n ? "border-accent bg-accent/5" : "border-transparent"
                    }`}
                  >
                    <span aria-hidden className="w-4 shrink-0 font-mono text-[11px] text-accent tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      {f.fuenteUrl ? (
                        <a
                          href={f.fuenteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-foreground underline decoration-accent/50 underline-offset-4 transition-colors hover:decoration-accent"
                        >
                          {f.cita} ↗
                        </a>
                      ) : (
                        <span className="font-medium text-foreground">{f.cita}</span>
                      )}
                      <span className="mt-0.5 block leading-snug text-muted">{f.norma}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {estado === "listo" && (
        <p className="max-w-[68ch] text-xs leading-relaxed text-muted">
          Redactado por un modelo de lenguaje solo con los pasajes de esta búsqueda, con temperatura cero. Puede
          equivocarse al interpretar o resumir: antes de decidir, lee la frase de la norma y la fuente oficial. Es
          apoyo a la consulta, no asesoría regulatoria ni legal.
          {borrador?.cacheada ? " Reutilizado de una consulta idéntica: no cuenta en tus preguntas del día." : ""}
        </p>
      )}

      {estado === "listo" && restantesHoy !== null && (
        <p className="text-xs text-muted">
          Te {restantesHoy === 1 ? "queda" : "quedan"} {restantesHoy}{" "}
          {restantesHoy === 1 ? "pregunta" : "preguntas"} con IA hoy.
        </p>
      )}

      {(estado === "ausencia" || estado === "error") && aviso && (
        <p className={estado === "ausencia" ? "text-sm text-amber-200" : "text-sm text-muted"}>{aviso}</p>
      )}
      {estado === "error" && limite && (
        <Link
          href="/agenda"
          className="self-start border border-accent/50 px-4 py-2 text-xs text-accent transition-[color,border-color,box-shadow] hover:border-accent hover:shadow-neon"
        >
          ¿Es urgente? Agenda una evaluación
        </Link>
      )}
      {estado === "error" && reintentable && (
        <button
          type="button"
          onClick={pedir}
          className="self-start text-xs text-muted underline decoration-accent/60 underline-offset-4 hover:text-foreground"
        >
          Reintentar
        </button>
      )}
    </section>
  );
}
