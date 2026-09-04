import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioIngreso } from "@/components/formulario-ingreso";
import { MAGIC_LINK_ACTIVO } from "@/lib/auth";
import { usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Entrar al buscador normativo",
  description:
    "Crea tu cuenta gratuita para consultar la normativa del ISP/ANAMED con cita trazable a la fuente oficial.",
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
          El buscador es gratis y seguirá siéndolo. Pedimos cuenta para saber qué
          normativa hace falta en el corpus y poder avisarte cuando cambia algo
          que te afecta.
        </p>

        <div className="mt-8">
          <Suspense fallback={<div className="h-32" />}>
            <FormularioIngreso next={destinoSeguro(next)} magicLink={MAGIC_LINK_ACTIVO} />
          </Suspense>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Al entrar aceptas que guardemos tu nombre, correo y las consultas que
          hagas, para mejorar el corpus normativo y contactarte si lo pides. No
          compartimos tus consultas con terceros y puedes pedir la eliminación de
          tu cuenta cuando quieras.
        </p>
      </div>
    </main>
  );
}

/** Solo aceptamos rutas internas: un `next` a otro dominio es un open redirect. */
function destinoSeguro(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/normativa";
  return next;
}
