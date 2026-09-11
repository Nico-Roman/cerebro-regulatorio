import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { FormularioPerfil } from "@/components/formulario-perfil";
import { db } from "@/lib/db";
import { perfil } from "@/lib/db/schema";
import { usuarioActual } from "@/lib/sesion";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Completa tu perfil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?next=/perfil");

  const params = await searchParams;
  const [fila] = await db
    .select()
    .from(perfil)
    .where(eq(perfil.userId, usuario.id))
    .limit(1);

  const primeraVez = !fila?.aceptaPrivacidadAt;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-lg">
        <p className="label-micro text-muted">
          {primeraVez ? "Un paso antes de buscar" : "Tu perfil"}
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">
          {primeraVez ? `Hola, ${primerNombre(usuario.nombre)}` : "Tu perfil"}
        </h1>
        <p className="mt-4 text-muted">
          {primeraVez
            ? "Cuéntanos desde dónde consultas. Con esto sabemos qué normativa priorizar en el corpus y a quién avisarle cuando cambia."
            : "Puedes actualizar estos datos cuando quieras."}
        </p>

        <div className="mt-8">
          <FormularioPerfil
            inicial={{
              empresa: fila?.empresa ?? "",
              cargo: fila?.cargo ?? "",
              tipoPerfil: fila?.tipoPerfil ?? "",
              telefono: fila?.telefono ?? "",
              aceptaNovedades: fila?.aceptaNovedades ?? false,
              yaAcepto: !primeraVez,
            }}
            utm={{
              source: primerValor(params.utm_source),
              medium: primerValor(params.utm_medium),
              campaign: primerValor(params.utm_campaign),
            }}
            next={destinoSeguro(primerValor(params.next))}
          />
        </div>
      </div>
    </main>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || "";
}

function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
