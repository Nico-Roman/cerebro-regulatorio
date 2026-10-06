import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { conversacionesDe } from "@/lib/conversaciones";
import { usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Tu historial",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }).format(d);

// Las conversaciones de la persona (encargo C2). La pertenencia se verifica en
// el servidor: conversacionesDe() filtra por user_id en SQL y otra vez al
// agrupar (lib/conversaciones-agrupar.ts).
export default async function HistorialPage() {
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent("/historial")}`);
  if (!usuario.perfilCompleto) redirect(`/perfil?next=${encodeURIComponent("/historial")}`);

  const conversaciones = await conversacionesDe(usuario.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="label-micro text-muted">Asistente</span>
        <h1 className="font-display text-3xl font-medium tracking-tight">Tu historial</h1>
        <p className="text-sm text-muted">
          Tus últimas conversaciones con sus respuestas y citas. Solo las ves tú.{" "}
          <Link href="/normativa" className="underline underline-offset-4 hover:text-foreground">
            Volver al asistente
          </Link>
        </p>
      </header>

      {!conversaciones.length && <p className="text-sm text-muted">Todavía no tienes conversaciones.</p>}

      <ol className="flex flex-col gap-4">
        {conversaciones.map((c) => (
          <li key={c.id}>
            <details className="group border border-line">
              <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3">
                <span className="text-sm font-medium">{c.turnos[0].pregunta}</span>
                <span className="text-xs text-muted">
                  {fecha(c.creada)} · {c.turnos.length} {c.turnos.length === 1 ? "pregunta" : "preguntas"}
                </span>
              </summary>
              <div className="flex flex-col gap-5 border-t border-line px-4 py-4">
                {c.turnos.map((t) => (
                  <div key={t.consultaId} className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{t.pregunta}</p>
                    {t.respuesta ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-300">{t.respuesta}</p>
                    ) : (
                      <p className="text-xs text-muted">Sin respuesta redactada.</p>
                    )}
                    {t.citas.length > 0 && (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1">
                        {t.citas.map((f, i) =>
                          f.fuenteUrl ? (
                            <li key={i} className="text-xs text-muted">
                              <a href={f.fuenteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                                {f.cita} ↗
                              </a>
                            </li>
                          ) : (
                            <li key={i} className="text-xs text-muted">
                              {f.cita}
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </main>
  );
}
