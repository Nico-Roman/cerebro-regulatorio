"use client";

// Borrador redactado con IA a partir de los pasajes de la búsqueda.
//
// Con el modo IA apagado es un botón: la mayoría de las consultas se resuelven
// leyendo los pasajes y cada llamada cuesta. Con el modo IA encendido se pide
// solo al terminar la búsqueda.
//
// Se presenta siempre como borrador y debajo de la frase de la norma, nunca en
// su lugar: la cita y el texto oficial mandan por sobre el resumen.

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

export function RespuestaIa({ consultaId, automatico = false }: { consultaId: string; automatico?: boolean }) {
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
      if (res.status === 503 && datos.error === "proveedor_agotado") {
        setAviso(datos.mensaje);
        setEstado("error");
        return;
      }
      if (res.status === 503) {
        setAviso("La redacción con IA todavía no está habilitada.");
        setEstado("error");
        return;
      }
      if (res.status === 429) {
        setAviso(datos.mensaje || "Llegaste a la cuota diaria de respuestas redactadas.");
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
        Redactar borrador con IA a partir de estos pasajes
      </button>
    );
  }

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 border border-dashed border-sky-800/70 bg-sky-950/10 px-4 py-4"
    >
      <span className="label-micro text-sky-300">Borrador IA · verifica contra la cita</span>

      {estado === "cargando" && <p className="text-sm text-muted">Leyendo los pasajes y redactando…</p>}

      {estado === "listo" && borrador && borrador.abstuvo && (
        <p className="text-sm leading-relaxed text-amber-200">
          <TextoConNegritas texto={borrador.texto} />
        </p>
      )}

      {estado === "listo" && borrador && !borrador.abstuvo && (
        <>
          {(borrador.citasInvalidas || borrador.sinCitas) && (
            <p className="border-l-2 border-red-500/70 pl-3 text-xs leading-relaxed text-red-200">
              {borrador.citasInvalidas
                ? "Este borrador cita un pasaje que no existe. No lo uses sin revisar cada afirmación contra los pasajes de arriba."
                : "Este borrador no citó ningún pasaje. Trátalo como no verificado."}
            </p>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            <TextoConNegritas texto={borrador.texto} />
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
          Redactado por un modelo de lenguaje solo con los pasajes de esta búsqueda, con temperatura cero. Puede
          equivocarse al interpretar o resumir: antes de decidir, lee la frase de la norma y la fuente oficial. Es
          apoyo a la consulta, no asesoría regulatoria ni legal.
          {borrador?.cacheada ? " Reutilizado de una consulta idéntica." : ""}
        </p>
      )}

      {(estado === "ausencia" || estado === "error") && aviso && (
        <p className={estado === "ausencia" ? "text-sm text-amber-200" : "text-sm text-muted"}>{aviso}</p>
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
