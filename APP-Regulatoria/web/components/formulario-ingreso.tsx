"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "enviando" }
  | { tipo: "enlaceEnviado" }
  | { tipo: "error"; mensaje: string };

export function FormularioIngreso({
  next,
  magicLink,
}: {
  next: string;
  magicLink: boolean;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const [email, setEmail] = useState("");

  async function conGoogle() {
    setEstado({ tipo: "enviando" });
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      newUserCallbackURL: "/perfil",
    });
    if (error) {
      setEstado({
        tipo: "error",
        mensaje: "No se pudo abrir el acceso con Google. Intenta de nuevo.",
      });
    }
  }

  async function conEnlace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado({ tipo: "enviando" });
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: next,
    });
    setEstado(
      error
        ? { tipo: "error", mensaje: "No pudimos enviar el enlace. Revisa el correo escrito." }
        : { tipo: "enlaceEnviado" }
    );
  }

  if (estado.tipo === "enlaceEnviado") {
    return (
      <div className="border border-line bg-surface p-5">
        <p className="font-medium">Revisa tu correo</p>
        <p className="mt-2 text-sm text-muted">
          Te enviamos un enlace a <span className="text-foreground">{email}</span>.
          Vence en 15 minutos y sirve una sola vez.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={conGoogle}
        disabled={estado.tipo === "enviando"}
        className="flex w-full items-center justify-center gap-3 border border-line bg-foreground px-5 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {estado.tipo === "enviando" ? "Abriendo…" : "Continuar con Google"}
      </button>

      {magicLink && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="label-micro text-muted">o con tu correo</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={conEnlace} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.cl"
              aria-label="Tu correo"
              className="min-w-0 flex-1 border border-line bg-transparent px-4 py-3 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-foreground"
            />
            <button
              type="submit"
              disabled={estado.tipo === "enviando"}
              className="shrink-0 border border-line px-5 py-3 text-sm transition-colors hover:border-foreground disabled:opacity-60"
            >
              Enviar enlace
            </button>
          </form>
        </>
      )}

      {estado.tipo === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}
