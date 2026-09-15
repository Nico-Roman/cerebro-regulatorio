import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { FormularioPerfil } from "@/components/formulario-perfil";
import { db } from "@/lib/db";
import { perfil } from "@/lib/db/schema";
import { usuarioActual } from "@/lib/sesion";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Completa tu registro",
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

  // Quien entra con Google ya trajo el nombre completo verificado: se parte en
  // dos y llega escrito en el formulario, así que en el caso normal no hay nada
  // que teclear. Lo que la persona corrija manda sobre lo que dijo Google.
  const { nombre: deCuenta, apellido: apellidoDeCuenta } = partirNombre(usuario.nombre);
  const nombre = fila?.nombre ?? deCuenta;
  const apellido = fila?.apellido ?? apellidoDeCuenta;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-lg">
        <p className="label-micro text-muted">
          {primeraVez ? "Último paso" : "Tus datos"}
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">
          {primeraVez && nombre ? `Hola, ${nombre}` : "Tus datos"}
        </h1>
        <p className="mt-4 text-muted">
          {primeraVez
            ? "Confirma tus datos y entras al buscador. Es una sola vez."
            : "Puedes actualizarlos cuando quieras."}
        </p>

        <div className="mt-8">
          <FormularioPerfil
            inicial={{
              nombre,
              apellido,
              email: usuario.email,
              telefono: fila?.telefono ?? "",
              empresa: fila?.empresa ?? "",
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

/**
 * Parte un nombre completo en nombre y apellido.
 *
 * Con una sola palabra el apellido queda vacío y la persona lo escribe: es
 * preferible a inventar un apellido a partir de la nada. Con tres o más, el
 * primer token es el nombre y el resto el apellido ("Nicolás Román Gligo" →
 * "Nicolás" / "Román Gligo"), que es la forma habitual en Chile y, cuando no
 * acierta, se corrige en el campo.
 */
function partirNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: "", apellido: "" };
  return { nombre: partes[0], apellido: partes.slice(1).join(" ") };
}

function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
