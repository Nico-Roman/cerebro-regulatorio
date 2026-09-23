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
import { ModalPlanes } from "@/components/modal-planes";

type Estado = "inicial" | "cargando" | "listo" | "ausencia" | "error";

interface Fuente {
  n: number;
  cita: string;
  norma: string;
  fuenteUrl: string;
}

interface Saldo {
  plan: { nombre: string };
  restantes: { mes: number; hoy: number; pack: number };
}

const miles = (n: number) => n.toLocaleString("es-CL");

type MotivoLimite = "sin_creditos" | "limite_diario";

// El aviso de límite se abre solo la primera vez que se choca con cada límite
// en el día; después queda el mensaje con un botón para volver a verlo. Con el
// modo IA encendido cada búsqueda pide una respuesta, y un modal en cada
// búsqueda sería exactamente la venta insistente que no queremos.
const avisosMostrados = new Set<string>();

function claveAviso(motivo: MotivoLimite): string {
  const d = new Date();
  return `regulamed:aviso-limite:${motivo}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yaSeAviso(motivo: MotivoLimite): boolean {
  const clave = claveAviso(motivo);
  if (avisosMostrados.has(clave)) return true;
  try {
    return sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

function marcarAviso(motivo: MotivoLimite) {
  const clave = claveAviso(motivo);
  avisosMostrados.add(clave);
  try {
    sessionStorage.setItem(clave, "1");
  } catch {
    // Sin almacenamiento (modo privado): queda el Set en memoria.
  }
}

/** "Te quedan 1.850 este mes (148 hoy) · 250 de pack". */
function textoSaldo(s: Saldo): string {
  const r = s.restantes;
  const partes = [`Plan ${s.plan.nombre}: te quedan ${miles(r.mes)} este mes (${miles(r.hoy)} hoy)`];
  if (r.pack > 0) partes.push(`${miles(r.pack)} créditos de pack`);
  return partes.join(" · ");
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
  // Límite de la persona alcanzado: se ofrece mejorar el plan o comprar
  // créditos, en un modal. `limite` guarda el motivo para el botón que lo reabre.
  const [limite, setLimite] = useState<{ motivo: MotivoLimite; plan: string } | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [saldo, setSaldo] = useState<Saldo | null>(null);

  const cerrarModal = useCallback(() => setModalAbierto(false), []);

  const pedir = useCallback(async () => {
    setEstado("cargando");
    setAviso(null);
    setReintentable(false);
    setLimite(null);
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
        if (datos.error === "sin_creditos" || datos.error === "limite_diario") {
          const motivo = datos.error as MotivoLimite;
          setLimite({ motivo, plan: typeof datos.plan === "string" ? datos.plan : "gratis" });
          if (!yaSeAviso(motivo)) {
            marcarAviso(motivo);
            setModalAbierto(true);
          }
        }
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
      if (datos.creditos) setSaldo(datos.creditos as Saldo);
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
          {borrador?.cacheada ? " Reutilizado de una consulta idéntica, sin costo de créditos." : ""}
        </p>
      )}

      {estado === "listo" && saldo && <p className="text-xs text-muted">{textoSaldo(saldo)}</p>}

      {(estado === "ausencia" || estado === "error") && aviso && (
        <p className={estado === "ausencia" ? "text-sm text-amber-200" : "text-sm text-muted"}>{aviso}</p>
      )}
      {estado === "error" && limite && (
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="self-start border border-sky-700 px-4 py-2 text-xs text-sky-200 transition-colors hover:border-sky-400 hover:text-foreground"
        >
          Ver opciones para seguir
        </button>
      )}
      {modalAbierto && limite && (
        <ModalPlanes motivo={limite.motivo} planActual={limite.plan} onCerrar={cerrarModal} />
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
