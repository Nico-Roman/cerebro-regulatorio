import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BuscadorNormativa } from "@/components/buscador-normativa";
import { usuarioActual } from "@/lib/sesion";
import { DIAS_VENCIDO, estadoCorpus, fechaLegible } from "@/lib/estado-corpus";

export const metadata: Metadata = {
  title: "Buscador de normativa farmacéutica y sanitaria chilena",
  description:
    "Busca gratis en la normativa del ISP/ANAMED: decretos, resoluciones y normas técnicas farmacéuticas, de cosméticos y dispositivos médicos, con el texto legal exacto y cita trazable a la fuente oficial.",
  alternates: { canonical: "/normativa" },
  openGraph: {
    title: "Buscador de normativa sanitaria chilena · RegulaMED",
    description:
      "Herramienta gratuita para buscar normativa farmacéutica chilena (ISP/ANAMED) con cita trazable al texto legal exacto.",
    url: "/normativa",
  },
};

// La página vive tras sesión, así que se renderiza por petición. El proxy solo
// mira la cookie; la verificación real contra la base de datos está acá.
export const dynamic = "force-dynamic";

export default async function NormativaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await usuarioActual();
  const { q } = await searchParams;
  const volver = `/normativa${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent(volver)}`);
  if (!usuario.perfilCompleto) redirect(`/perfil?next=${encodeURIComponent(volver)}`);

  // La fecha del corpus va a la vista, no escondida en un endpoint.
  //
  // El pipeline estuvo 8 días caído sirviendo normativa con atraso y nadie lo
  // notó, porque nada en la pantalla decía de cuándo era la información. Un
  // usuario que ve "actualizado al 30-08-2026" es el detector de fallas más
  // barato que existe, y en una herramienta regulatoria además es lo honesto:
  // quien va a citar una norma tiene derecho a saber cuándo se verificó.
  const estado = estadoCorpus();

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8">
        {estado.vencido ? (
          <p
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong className="font-semibold">Información posiblemente desactualizada.</strong>{" "}
            {estado.generado
              ? `El corpus se actualizó por última vez el ${fechaLegible(estado.generado)}, hace ${estado.diasDesdeGeneracion} días.`
              : "No se pudo determinar cuándo se actualizó el corpus por última vez."}{" "}
            La vigilancia del listado oficial del ISP corre a diario; más de {DIAS_VENCIDO} días
            significa que no está corriendo. Verifica la vigencia en la fuente antes de citar.
          </p>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Corpus actualizado al {fechaLegible(estado.generado)}
            {estado.documentos ? ` · ${estado.documentos} documentos indexados` : ""} · vigencia
            según el listado oficial del ISP
          </p>
        )}
      </div>
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8" />}>
        <BuscadorNormativa />
      </Suspense>
    </>
  );
}
