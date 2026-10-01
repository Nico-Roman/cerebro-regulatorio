import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlujoTramite } from "@/components/flujo-tramite";
import { QueQuieresHacer } from "@/components/que-quieres-hacer";
import { PREGUNTAS, flujoTramiteActivo, rutasSinValidar } from "@/lib/flujos/tramite";
import { usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "¿Qué trámite necesito?",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function TramitePage() {
  // Apagado hasta que Nico valide las rutas (FLUJO_TRAMITE=on).
  if (!flujoTramiteActivo()) notFound();
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent("/asistente/tramite")}`);
  if (!usuario.perfilCompleto) redirect(`/perfil?next=${encodeURIComponent("/asistente/tramite")}`);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <QueQuieresHacer actual="tramite" tramite />
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">¿Qué trámite necesito?</h1>
        <p className="text-sm leading-relaxed text-muted">
          Cinco preguntas cerradas. La ruta sale de una tabla revisada por un químico farmacéutico, no del modelo; el
          asistente solo la explica citando la norma. Cuenta como 1 de tus 10 preguntas del día.
        </p>
        {rutasSinValidar().length > 0 && (
          <p className="border-l-2 border-amber-500/70 pl-3 text-sm text-amber-200">
            Ruta en revisión profesional: úsala como orientación y confírmala antes de presentar.
          </p>
        )}
      </header>
      <FlujoTramite preguntas={PREGUNTAS} />
    </main>
  );
}
