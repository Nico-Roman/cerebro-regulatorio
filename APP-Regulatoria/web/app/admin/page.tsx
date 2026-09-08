// Panel interno. Tres vistas sobre la misma base: quién entró, qué preguntó y
// qué no encontró. La tercera es la que vale más: es el backlog del corpus
// dicho por los usuarios, no por nosotros.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consultasRecientes,
  huecosDelCorpus,
  resumen,
  usuarios,
} from "@/lib/admin";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Vista = "usuarios" | "consultas" | "huecos";

const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: "usuarios", etiqueta: "Usuarios" },
  { id: "consultas", etiqueta: "Consultas" },
  { id: "huecos", etiqueta: "Fuera del corpus" },
];

function Tarjeta({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="border border-line px-4 py-3">
      <div className="font-display text-2xl">{valor}</div>
      <div className="label-micro mt-1 text-muted">{etiqueta}</div>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; filtro?: string }>;
}) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?next=/admin");
  // Un usuario cualquiera con la URL no debe ver nada de esto: 404 en vez de
  // 403 para no confirmar siquiera que el panel existe.
  if (!esAdmin(usuario.email)) redirect("/");

  const params = await searchParams;
  const vista = (VISTAS.find((v) => v.id === params.vista)?.id ?? "usuarios") as Vista;
  const soloSinCobertura = params.filtro === "sin-cobertura";

  const metricas = await resumen();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <span className="label-micro text-muted">Interno</span>
        <h1 className="font-display text-3xl tracking-tight">Panel</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tarjeta valor={metricas.usuarios} etiqueta="usuarios" />
        <Tarjeta valor={metricas.usuariosNuevos7d} etiqueta="nuevos 7 días" />
        <Tarjeta valor={metricas.consultas7d} etiqueta="consultas 7 días" />
        <Tarjeta valor={metricas.consultasTotales} etiqueta="consultas totales" />
        <Tarjeta valor={metricas.sinCobertura7d} etiqueta="sin cobertura 7 d" />
        <Tarjeta valor={metricas.votosNegativos7d} etiqueta="votos negativos 7 d" />
      </section>

      <nav className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-xs">
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={`/admin?vista=${v.id}`}
            className={`border px-3 py-1.5 transition-colors ${
              vista === v.id
                ? "border-foreground text-foreground"
                : "border-line text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            {v.etiqueta}
          </Link>
        ))}
        <span className="ml-auto flex gap-3">
          <a href="/api/admin/export?tipo=usuarios" className="text-muted underline hover:text-foreground">
            CSV usuarios
          </a>
          <a href="/api/admin/export?tipo=consultas" className="text-muted underline hover:text-foreground">
            CSV consultas
          </a>
          <a href="/api/admin/export?tipo=huecos" className="text-muted underline hover:text-foreground">
            CSV huecos
          </a>
        </span>
      </nav>

      {vista === "usuarios" && <TablaUsuarios />}
      {vista === "consultas" && <TablaConsultas soloSinCobertura={soloSinCobertura} />}
      {vista === "huecos" && <TablaHuecos />}
    </main>
  );
}

async function TablaUsuarios() {
  const filas = await usuarios();
  if (!filas.length) {
    return <p className="text-sm text-muted">Todavía no hay usuarios registrados.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead className="text-left text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-normal">Persona</th>
            <th className="py-2 pr-3 font-normal">Empresa / cargo</th>
            <th className="py-2 pr-3 font-normal">Perfil</th>
            <th className="py-2 pr-3 font-normal">Consultas</th>
            <th className="py-2 pr-3 font-normal">Última actividad</th>
            <th className="py-2 pr-3 font-normal">Novedades</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((u) => (
            <tr key={u.id} className="border-b border-line/60 align-top">
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  {u.caliente && <span title="lead caliente" className="text-amber-400">●</span>}
                  <span className="font-medium">{u.nombre}</span>
                </div>
                <div className="text-muted">{u.email}</div>
                <div className="text-muted">alta: {u.registradoEn}</div>
              </td>
              <td className="py-2 pr-3 text-muted">
                {u.empresa || "—"}
                {u.cargo ? <div>{u.cargo}</div> : null}
              </td>
              <td className="py-2 pr-3 text-muted">{u.tipoPerfil || "—"}</td>
              <td className="py-2 pr-3">{u.consultas}</td>
              <td className="py-2 pr-3 text-muted">{u.ultimaActividad || "—"}</td>
              <td className="py-2 pr-3 text-muted">{u.aceptaNovedades ? "sí" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TablaConsultas({ soloSinCobertura }: { soloSinCobertura: boolean }) {
  const filas = await consultasRecientes(300, soloSinCobertura);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 text-xs">
        <Link
          href="/admin?vista=consultas"
          className={!soloSinCobertura ? "text-foreground underline" : "text-muted underline"}
        >
          todas
        </Link>
        <Link
          href="/admin?vista=consultas&filtro=sin-cobertura"
          className={soloSinCobertura ? "text-foreground underline" : "text-muted underline"}
        >
          sin cobertura o mal valoradas
        </Link>
      </div>
      {!filas.length ? (
        <p className="text-sm text-muted">Sin consultas para este filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-normal">Fecha</th>
                <th className="py-2 pr-3 font-normal">Pregunta</th>
                <th className="py-2 pr-3 font-normal">Quién</th>
                <th className="py-2 pr-3 font-normal">Confianza</th>
                <th className="py-2 pr-3 font-normal">Top cita</th>
                <th className="py-2 pr-3 font-normal">Voto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{c.createdAt}</td>
                  <td className="py-2 pr-3">{c.pregunta}</td>
                  <td className="py-2 pr-3 text-muted">
                    {c.email}
                    {c.empresa ? <div>{c.empresa}</div> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        c.recomendacion === "declarar_ausencia"
                          ? "text-red-400"
                          : c.confianza === "media"
                            ? "text-amber-300"
                            : "text-emerald-400"
                      }
                    >
                      {c.confianza || "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">{c.topCita || "—"}</td>
                  <td className="py-2 pr-3">
                    {c.votoUtil === null ? (
                      <span className="text-muted">—</span>
                    ) : c.votoUtil ? (
                      <span className="text-emerald-400">sirvió</span>
                    ) : (
                      <span className="text-amber-300">
                        no sirvió
                        {c.comentario ? <div className="text-muted">“{c.comentario}”</div> : null}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function TablaHuecos() {
  const filas = await huecosDelCorpus();
  if (!filas.length) {
    return (
      <p className="text-sm text-muted">
        Sin conceptos fuera del corpus en los últimos 30 días.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-xs leading-relaxed text-muted">
        Cada línea es un término que alguien buscó y el motor no encontró en el corpus. Ordenado
        por frecuencia: lo de arriba es lo que más falta incorporar.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-xs">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-normal">Concepto</th>
              <th className="py-2 pr-3 font-normal">Veces</th>
              <th className="py-2 pr-3 font-normal">Ejemplo de pregunta</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((h) => (
              <tr key={h.concepto} className="border-b border-line/60">
                <td className="py-2 pr-3 font-medium">{h.concepto}</td>
                <td className="py-2 pr-3">{h.veces}</td>
                <td className="py-2 pr-3 text-muted">{h.ejemplo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
