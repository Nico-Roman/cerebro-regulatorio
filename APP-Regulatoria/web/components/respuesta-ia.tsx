"use client";

// Respuesta del asistente, redactada solo con los pasajes del corpus.
//
// Se pide sola al terminar cada búsqueda: desde el encargo C2 no hay
// interruptor «Modo IA». Va arriba y los pasajes debajo, como evidencia; la
// cita y el texto oficial mandan por sobre el resumen.
//
// Cuando el asistente se abstiene, ofrece «Te respondo yo en 24 horas
// hábiles»: la pregunta y el correo de la persona van a contacto@regulamed.cl.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** «Te respondo yo en 24 horas hábiles»: manda la pregunta a contacto@ por correo. */
function RespuestaHumana({ consultaId }: { consultaId: string }) {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "ok" | "error">("inicial");
  const [mensaje, setMensaje] = useState<string | null>(null);
  async function pedir() {
    setEstado("enviando");
    try {
      const res = await fetch("/api/conversaciones/respuesta-humana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultaId }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje(datos.mensaje || "No pudimos enviarla. Escríbenos por correo.");
        setEstado("error");
        return;
      }
      setEstado("ok");
    } catch {
      setMensaje("No pudimos enviarla. Revisa tu conexión.");
      setEstado("error");
    }
  }
  if (estado === "ok") {
    return <p className="text-sm text-emerald-300">Listo: un químico farmacéutico te responde a tu correo en 24 horas hábiles.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={pedir}
        disabled={estado === "enviando"}
        className="self-start border border-sky-700 px-4 py-2 text-xs text-sky-200 transition-colors hover:border-sky-400 hover:text-foreground disabled:opacity-50"
      >
        {estado === "enviando" ? "Enviando…" : "Te respondo yo en 24 horas hábiles"}
      </button>
      {estado === "error" && mensaje && <p className="text-xs text-muted">{mensaje}</p>}
    </div>
  );
}

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
  afirmacionesSinCita: string[];
  cacheada: boolean;
}

/** Negritas del modelo (**dato**) como <strong>, sin interpretar HTML. */
function TextoConNegritas({ texto }: { texto: string }) {
  const partes: ReactNode[] = texto.split(/\*\*(.+?)\*\*/g).map((trozo, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-neutral-50">
        {trozo}
      </strong>
    ) : (
      trozo
    )
  );
  return <>{partes}</>;
}

/**
 * El borrador con las oraciones que imponen algo sin cita subrayadas. Las
 * oraciones vienen del servidor tal como aparecen en el texto (subcadenas
 * exactas), así que basta con ubicarlas.
 */
function TextoBorrador({ texto, sinCita }: { texto: string; sinCita: string[] }) {
  if (!sinCita.length) return <TextoConNegritas texto={texto} />;
  const trozos: ReactNode[] = [];
  let resto = texto;
  let i = 0;
  while (resto) {
    let primera: { pos: number; oracion: string } | null = null;
    for (const o of sinCita) {
      const pos = resto.indexOf(o);
      if (pos >= 0 && (!primera || pos < primera.pos)) primera = { pos, oracion: o };
    }
    if (!primera) {
      trozos.push(<TextoConNegritas key={i++} texto={resto} />);
      break;
    }
    if (primera.pos > 0) trozos.push(<TextoConNegritas key={i++} texto={resto.slice(0, primera.pos)} />);
    trozos.push(
      <span
        key={i++}
        title="Afirmación sin cita"
        className="underline decoration-red-400 decoration-wavy underline-offset-4"
      >
        <TextoConNegritas texto={primera.oracion} />
      </span>
    );
    resto = resto.slice(primera.pos + primera.oracion.length);
  }
  return <>{trozos}</>;
}

export function RespuestaIa({ consultaId, automatico = true }: { consultaId: string; automatico?: boolean }) {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reintentable, setReintentable] = useState(false);

  const pedir = useCallback(async () => {
    setEstado("cargando");
    setAviso(null);
    setReintentable(false);
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
        // Ráfaga: el cupo diario ya se descontó al enviar la pregunta.
        setAviso(datos.mensaje || "Vas muy rápido para el redactor. Espera unos segundos.");
        setReintentable(true);
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
        afirmacionesSinCita: datos.afirmacionesSinCita ?? [],
        cacheada: Boolean(datos.cacheada),
      });
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
        className="self-start border border-line px-4 py-2 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
      >
        Redactar la respuesta a partir de estos pasajes
      </button>
    );
  }

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 border border-dashed border-sky-800/70 bg-sky-950/10 px-4 py-4"
    >
      <span className="label-micro text-sky-300">Respuesta del asistente · verifica contra la cita</span>

      {estado === "cargando" && <p className="text-sm text-muted">Leyendo los pasajes y redactando…</p>}

      {estado === "listo" && borrador && borrador.abstuvo && (
        <p className="text-sm leading-relaxed text-amber-200">
          <TextoConNegritas texto={borrador.texto} />
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
          {borrador.afirmacionesSinCita.length > 0 && (
            <p className="border-l-2 border-red-500/70 pl-3 text-xs leading-relaxed text-red-200">
              Afirmación sin cita:{" "}
              {borrador.afirmacionesSinCita.length === 1
                ? "la oración subrayada impone una obligación o un plazo sin un pasaje que la respalde."
                : `${borrador.afirmacionesSinCita.length} oraciones subrayadas imponen obligaciones o plazos sin un pasaje que las respalde.`}{" "}
              No las uses sin verificarlas en la fuente.
            </p>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            <TextoBorrador texto={borrador.texto} sinCita={borrador.afirmacionesSinCita} />
          </div>
          {borrador.fuentes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label-micro text-muted">Pasajes que citó</span>
              <ul className="flex flex-col gap-1">
                {borrador.fuentes.map((f) => (
                  <li key={f.n} className="text-xs text-muted">
                    {f.fuenteUrl ? (
                      <a
                        href={f.fuenteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        {f.cita} ↗
                      </a>
                    ) : (
                      f.cita
                    )}{" "}
                    <span className="text-neutral-500">— {f.norma}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {estado === "listo" && (
        <p className="text-xs leading-relaxed text-muted">
          Redactado por un modelo de lenguaje solo con los pasajes de abajo. Puede equivocarse al interpretar o
          resumir: antes de decidir, lee la frase de la norma y la fuente oficial. No reemplaza la revisión de un
          químico farmacéutico.
          {borrador?.cacheada ? " Reutilizado de una consulta idéntica." : ""}
        </p>
      )}

      {(estado === "ausencia" || estado === "error") && aviso && (
        <p className={estado === "ausencia" ? "text-sm text-amber-200" : "text-sm text-muted"}>{aviso}</p>
      )}
      {(estado === "ausencia" || (estado === "listo" && borrador?.abstuvo)) && (
        <RespuestaHumana consultaId={consultaId} />
      )}
      {estado === "error" && reintentable && (
        <button
          type="button"
          onClick={pedir}
          className="self-start text-xs text-muted underline underline-offset-4 hover:text-foreground"
        >
          Reintentar
        </button>
      )}
    </section>
  );
}
