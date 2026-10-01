import type { Metadata } from "next";
import Link from "next/link";

// Sin este archivo Next muestra su 404 genérica, en inglés.
export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
};

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-24 sm:px-8">
      <span className="label-micro text-muted">Error 404</span>
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Esta página no existe.</h1>
      <p className="text-muted">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">
          Ir al inicio
        </Link>
        <Link href="/normativa" className="underline">
          Buscar una norma
        </Link>
      </div>
    </main>
  );
}
