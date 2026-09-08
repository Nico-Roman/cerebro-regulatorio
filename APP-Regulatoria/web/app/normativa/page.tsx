import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BuscadorNormativa } from "@/components/buscador-normativa";
import { usuarioActual } from "@/lib/sesion";

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

  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8" />}>
      <BuscadorNormativa />
    </Suspense>
  );
}
