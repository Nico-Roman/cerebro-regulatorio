import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlujoObservacion } from "@/components/flujo-observacion";
import { QueQuieresHacer } from "@/components/que-quieres-hacer";
import { PRODUCTOS } from "@/lib/calificacion";
import { flujoTramiteActivo } from "@/lib/flujos/tramite";
import { usuarioActual } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Responder una observación del ISP",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function ObservacionPage() {
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent("/asistente/observacion")}`);
  if (!usuario.perfilCompleto) redirect(`/perfil?next=${encodeURIComponent("/asistente/observacion")}`);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <QueQuieresHacer actual="observacion" tramite={flujoTramiteActivo()} />
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">Responder una observación del ISP</h1>
        <p className="text-sm leading-relaxed text-muted">
          Pega la observación tal como te llegó. Te mostramos qué pide, qué exige la norma (con cita) y un borrador de
          respuesta con lo que falta completar. No pegues datos de pacientes: nombres, RUT ni fechas de nacimiento.
          Cuenta como 1 de tus 10 preguntas del día.
        </p>
      </header>
      <FlujoObservacion productos={[...PRODUCTOS]} />
    </main>
  );
}
