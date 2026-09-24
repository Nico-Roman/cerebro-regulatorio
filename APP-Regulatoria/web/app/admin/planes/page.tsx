// Modelos de IA: qué modelo responde, cambiarlo sin deploy y cuánto cuesta
// cada consulta. Sin cobro por uso (23-09-2026) ya no hay planes, packs ni
// suscripciones que administrar; las tablas siguen en la base.
//
// Formularios HTML normales que postean a /api/admin/planes, como la agenda.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BOTON, INPUT } from "@/components/admin-formularios";
import { PRESETS, configIaActiva, consultaMedia, listarModelos, type ModeloIa } from "@/lib/ia/config";
import { costoUsd, formatoMiles } from "@/lib/planes";
import { esAdmin, usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Modelos de IA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VOLVER = "/admin/planes";

function usd(n: number): string {
  return `US$${n < 0.01 ? n.toFixed(5) : n.toFixed(2)}`;
}

function AccionModelo({ id, accion, texto, peligro }: { id: string; accion: string; texto: string; peligro?: boolean }) {
  return (
    <form action="/api/admin/planes" method="post">
      <input type="hidden" name="accion" value={accion} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={VOLVER} />
      <button className={peligro ? "text-xs text-muted underline hover:text-red-300" : BOTON}>{texto}</button>
    </form>
  );
}

function FormModelo({ m }: { m?: ModeloIa }) {
  return (
    <form action="/api/admin/planes" method="post" className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="accion" value="modelo_guardar" />
      <input type="hidden" name="volver" value={VOLVER} />
      {m && <input type="hidden" name="id" value={m.id} />}
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">Nombre para mostrar</span>
        <input name="nombre" required defaultValue={m?.nombre} placeholder="GPT-4.1 mini (OpenAI)" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">Modelo (como lo llama la API)</span>
        <input name="modelo" required defaultValue={m?.modelo} placeholder="gpt-4.1-mini" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">URL base (compatible con OpenAI)</span>
        <input name="baseUrl" required list="presets-url" defaultValue={m?.baseUrl} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">Variable con la clave en Railway</span>
        <input name="envClave" required list="presets-env" defaultValue={m?.envClave} placeholder="OPENAI_API_KEY" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">US$ por millón · entrada</span>
        <input name="usdEntrada" required inputMode="decimal" defaultValue={m?.usdMillonEntrada} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-micro text-muted">US$ por millón · salida</span>
        <input name="usdSalida" required inputMode="decimal" defaultValue={m?.usdMillonSalida} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="label-micro text-muted">Notas</span>
        <input name="notas" defaultValue={m?.notas ?? ""} placeholder="de dónde saqué el precio, fecha…" className={INPUT} />
      </label>
      <button className={`${BOTON} self-start`}>{m ? "Guardar cambios" : "Agregar al catálogo"}</button>
    </form>
  );
}

export default async function PlanesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?next=/admin/planes");
  if (!esAdmin(usuario.email)) redirect("/");

  const [params, modelos, activa, media] = await Promise.all([
    searchParams,
    listarModelos(),
    configIaActiva(),
    consultaMedia(),
  ]);
  const costoConsulta = (m: { usdMillonEntrada: number; usdMillonSalida: number }) =>
    costoUsd(media.entrada, media.salida, m);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-10 sm:px-8">
      <datalist id="presets-url">
        {PRESETS.map((p) => (
          <option key={p.baseUrl} value={p.baseUrl}>
            {p.nombre}
          </option>
        ))}
      </datalist>
      <datalist id="presets-env">
        {PRESETS.map((p) => (
          <option key={p.envClave} value={p.envClave} />
        ))}
        <option value="LLM_API_KEY" />
      </datalist>

      <header className="flex flex-col gap-2">
        <Link href="/admin" className="label-micro text-muted underline">
          ← Panel
        </Link>
        <h1 className="font-display text-3xl tracking-tight">Modelos de IA</h1>
        {params.ok && <p className="text-sm text-emerald-300">{params.ok}</p>}
        {params.error && <p className="text-sm text-red-300">{params.error}</p>}
      </header>

      {/* ── Modelo de IA ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-tight">Modelo de IA</h2>
        <div className="border border-line p-4 text-sm">
          {activa ? (
            <>
              <p>
                Responde <strong className="font-medium">{activa.modelo}</strong> ({activa.proveedor}) ·{" "}
                {activa.origen === "panel" ? "elegido en este panel" : "por variables LLM_* de Railway"} ·{" "}
                {usd(activa.usdMillonEntrada)} / {usd(activa.usdMillonSalida)} por millón.
              </p>
              <p className="mt-1 text-xs text-muted">
                Consulta media (30 días, {media.n ? `${formatoMiles(media.n)} redacciones` : "sin datos: referencia"}):{" "}
                {formatoMiles(media.entrada)} tokens de entrada + {formatoMiles(media.salida)} de salida ={" "}
                {usd(costoConsulta(activa))} por consulta.
              </p>
            </>
          ) : (
            <p className="text-amber-200">No hay IA disponible: ni modelo activo con clave, ni LLM_API_KEY.</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="label-micro text-muted">
              <tr>
                <th className="py-2 pr-4">Modelo</th>
                <th className="py-2 pr-4">Precio / millón</th>
                <th className="py-2 pr-4">Costo / consulta</th>
                <th className="py-2 pr-4">Clave</th>
                <th className="py-2 pr-4">Última prueba</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m.id} className="border-t border-line align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium">
                      {m.nombre} {m.activo && (
                        <span className={`ml-1 text-xs ${m.claveCargada ? "text-emerald-300" : "text-amber-200"}`}>
                          {m.claveCargada ? "● activo" : "● activo sin clave: responde LLM_*"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {m.proveedor} · {m.modelo}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {usd(m.usdMillonEntrada)} entrada
                    <br />
                    {usd(m.usdMillonSalida)} salida
                  </td>
                  <td className="py-3 pr-4">
                    {usd(costoConsulta(m))}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <span className={m.claveCargada ? "text-emerald-300" : "text-amber-200"}>
                      {m.claveCargada ? "✓ cargada" : "✗ falta"}
                    </span>
                    <div className="text-muted">{m.envClave}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {m.ultimaPrueba ? (
                      <>
                        <span className={m.ultimaPrueba.ok ? "text-emerald-300" : "text-red-300"}>
                          {m.ultimaPrueba.ok ? "✓ OK" : "✗ falló"}
                        </span>{" "}
                        <span className="text-muted">{m.ultimaPrueba.fecha.slice(0, 16).replace("T", " ")}</span>
                        {m.ultimaPrueba.ok ? (
                          <div className="text-muted">
                            {formatoMiles(m.ultimaPrueba.latenciaMs ?? 0)} ms
                          </div>
                        ) : (
                          <div className="max-w-xs text-red-200">{m.ultimaPrueba.error}</div>
                        )}
                        {m.ultimaPrueba.extracto && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted">ver respuesta</summary>
                            <p className="mt-1 max-w-xs whitespace-pre-wrap text-muted">{m.ultimaPrueba.extracto}</p>
                          </details>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">sin probar</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <AccionModelo id={m.id} accion="modelo_probar" texto="Probar" />
                      {!m.activo && m.ultimaPrueba?.ok && m.claveCargada && (
                        <AccionModelo id={m.id} accion="modelo_activar" texto="Activar" />
                      )}
                      {m.activo && <AccionModelo id={m.id} accion="modelo_desactivar" texto="Volver a LLM_*" peligro />}
                      {!m.activo && <AccionModelo id={m.id} accion="modelo_eliminar" texto="Eliminar" peligro />}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted">editar</summary>
                      <div className="mt-3 w-[36rem] max-w-[80vw]">
                        <FormModelo m={m} />
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="border border-line p-4">
          <summary className="cursor-pointer text-sm">Agregar un modelo</summary>
          <ol className="my-4 list-decimal pl-5 text-xs leading-relaxed text-muted">
            <li>Carga la clave del proveedor en Railway con un nombre terminado en _API_KEY y despliega.</li>
            <li>Agrega el modelo acá con los precios de la página del proveedor (US$ por millón de tokens).</li>
            <li>
              Apreta <em>Probar</em>: corre una consulta real con la misma búsqueda, prompt y verificación de citas.
            </li>
            <li>Si la prueba sale bien, <em>Activar</em>. El costo de cada consulta queda registrado con su precio.</li>
          </ol>
          <FormModelo />
        </details>
      </section>

    </main>
  );
}
