import type { Metadata } from "next";
import { GestionarReserva } from "@/components/gestionar-reserva";

export const metadata: Metadata = {
  title: "Cancelar reunión",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GestionarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-16 sm:px-8">
      <h1 className="font-display text-3xl tracking-tight">Cancelar la reunión</h1>
      {token ? (
        <GestionarReserva token={token} />
      ) : (
        <p className="text-sm text-muted">
          Este enlace no trae el código de la reserva. Usa el enlace tal como viene en el correo de
          confirmación.
        </p>
      )}
    </main>
  );
}
