// Configuración de la agenda sin tocar SQL ni desplegar. Un formulario HTML
// normal que postea a /api/admin/agenda: sin estado en el cliente, porque no
// hace falta nada más que guardar y recargar.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { leerConfig } from "@/lib/agenda/config";
import { agendaConfigurada } from "@/lib/agenda/google";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Agenda · configuración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Campo({
  etiqueta,
  nombre,
  valor,
  tipo = "text",
  ayuda,
}: {
  etiqueta: string;
  nombre: string;
  valor: string | number;
  tipo?: string;
  ayuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-micro text-muted">{etiqueta}</span>
      <input
        type={tipo}
        name={nombre}
        defaultValue={valor}
        className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
      />
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </label>
  );
}

export default async function AgendaConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string; error?: string }>;
}) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?next=/admin/agenda");
  if (!esAdmin(usuario.email)) redirect("/");

  const [config, params] = await Promise.all([leerConfig(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="label-micro text-muted underline">
          ← Panel
        </Link>
        <h1 className="font-display text-3xl tracking-tight">Configuración de la agenda</h1>
        <p className="text-sm text-muted">
          Cambia el horario de atención sin desplegar. Los huecos publicados se recalculan al
          guardar.
        </p>
      </header>

      {!agendaConfigurada() && (
        <p className="border-l-2 border-amber-500 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          Falta conectar Google Calendar (<code>GOOGLE_CAL_CLIENT_ID</code>,{" "}
          <code>GOOGLE_CAL_CLIENT_SECRET</code>, <code>GOOGLE_REFRESH_TOKEN</code>). Hasta
          entonces <code>/agenda</code> muestra el mensaje de &quot;sin horas publicadas&quot;.
        </p>
      )}

      {params.guardado && (
        <p className="border-l-2 border-emerald-500 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
          Configuración guardada.
        </p>
      )}
      {params.error && (
        <p className="border-l-2 border-red-500 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {params.error}
        </p>
      )}

      <form action="/api/admin/agenda" method="post" className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Hora de apertura" nombre="horaInicio" valor={config.horaInicio} ayuda="HH:MM, hora de Chile" />
          <Campo etiqueta="Hora de cierre" nombre="horaFin" valor={config.horaFin} />
          <Campo etiqueta="Duración (min)" nombre="duracionMin" valor={config.duracionMin} tipo="number" />
          <Campo etiqueta="Buffer entre reuniones (min)" nombre="bufferMin" valor={config.bufferMin} tipo="number" ayuda="Se aplica antes y después de cada bloque ocupado" />
          <Campo etiqueta="Primer día" nombre="diaInicio" valor={config.diaInicio} tipo="number" ayuda="1 = lunes … 7 = domingo" />
          <Campo etiqueta="Último día" nombre="diaFin" valor={config.diaFin} tipo="number" />
          <Campo etiqueta="Antelación mínima (horas)" nombre="antelacionHoras" valor={config.antelacionHoras} tipo="number" />
          <Campo etiqueta="Horizonte (días)" nombre="horizonteDias" valor={config.horizonteDias} tipo="number" />
          <Campo etiqueta="Zona horaria" nombre="zona" valor={config.zona} />
          <Campo
            etiqueta="Calendarios"
            nombre="calendarios"
            valor={config.calendarios.join(", ")}
            ayuda="Separados por coma. El evento se crea en el primero; todos se consultan para ver si estás ocupado."
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={config.activa}
            className="h-4 w-4 accent-neutral-200"
          />
          Agenda publicada (si la desmarcas, /agenda deja de ofrecer horas)
        </label>

        <button
          type="submit"
          className="self-start bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          Guardar
        </button>
      </form>
    </main>
  );
}
