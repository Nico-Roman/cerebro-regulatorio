import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioIngreso } from "@/components/formulario-ingreso";
import { MAGIC_LINK_ACTIVO } from "@/lib/auth";
import { usuarioActual } from "@/lib/sesion";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Entrar al buscador normativo",
  description:
    "Crea tu cuenta gratuita y busca la normativa del ISP/ANAMED con el enlace al documento oficial.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const usuario = await usuarioActual();

  if (usuario) {
    redirect(usuario.perfilCompleto ? destinoSeguro(next) : "/perfil");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="label-micro text-muted">Acceso gratuito</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Entra al buscador normativo
        </h1>
        <p className="mt-4 text-muted">
          El buscador es gratis y va a seguir siéndolo. Solo tienes que
          registrarte.
        </p>

        <div className="mt-8">
          <Suspense fallback={<div className="h-32" />}>
            <FormularioIngreso next={destinoSeguro(next)} magicLink={MAGIC_LINK_ACTIVO} />
          </Suspense>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Al entrar aceptas los{" "}
          <Link href="/terminos" className="underline">Términos</Link> y que
          tratemos tus datos y búsquedas como explica la{" "}
          <Link href="/privacidad" className="underline">Política de Privacidad</Link>.
          Solo los ven los proveedores que hacen funcionar el sitio; no los
          vendemos. Puedes pedir que borremos tu cuenta cuando quieras.
        </p>
      </div>
    </main>
  );
}
