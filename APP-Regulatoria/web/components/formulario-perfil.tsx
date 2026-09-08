"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TIPOS = [
  "QF de Asuntos Regulatorios",
  "QA / Calidad",
  "Consultor regulatorio independiente",
  "Importador / distribuidor",
  "Dirección técnica",
  "Estudiante o académico",
  "Otro",
];

export interface PerfilInicial {
  empresa: string;
  cargo: string;
  tipoPerfil: string;
  telefono: string;
  aceptaNovedades: boolean;
  yaAcepto: boolean;
}

export function FormularioPerfil({
  inicial,
  utm,
  next,
}: {
  inicial: PerfilInicial;
  utm: { source?: string; medium?: string; campaign?: string };
  next: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const datos = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, utm }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.mensaje || "No se pudo guardar el perfil.");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el perfil.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Campo etiqueta="Empresa u organización" nombre="empresa" valor={inicial.empresa} />
      <Campo etiqueta="Tu cargo" nombre="cargo" valor={inicial.cargo} />

      <label className="flex flex-col gap-2">
        <span className="label-micro text-muted">Desde dónde consultas</span>
        <select
          name="tipoPerfil"
          defaultValue={inicial.tipoPerfil}
          required
          className="border border-line bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-foreground"
        >
          <option value="" disabled>
            Elige una opción
          </option>
          {TIPOS.map((t) => (
            <option key={t} value={t} className="bg-surface">
              {t}
            </option>
          ))}
        </select>
      </label>

      <Campo
        etiqueta="Teléfono (opcional)"
        nombre="telefono"
        valor={inicial.telefono}
        tipo="tel"
      />

      {!inicial.yaAcepto && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="aceptaPrivacidad"
            required
            className="mt-1 size-4 shrink-0 accent-white"
          />
          <span className="text-muted">
            Acepto que RegulaMED guarde mis datos y mis consultas para operar el
            buscador y mejorar el corpus normativo.
          </span>
        </label>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="aceptaNovedades"
          defaultChecked={inicial.aceptaNovedades}
          className="mt-1 size-4 shrink-0 accent-white"
        />
        <span className="text-muted">
          Quiero recibir avisos cuando cambie normativa relevante para mi área.
          (Opcional, y puedes darte de baja cuando quieras.)
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="self-start bg-foreground px-6 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {guardando ? "Guardando…" : inicial.yaAcepto ? "Guardar cambios" : "Entrar al buscador"}
      </button>
    </form>
  );
}

function Campo({
  etiqueta,
  nombre,
  valor,
  tipo = "text",
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label-micro text-muted">{etiqueta}</span>
      <input
        type={tipo}
        name={nombre}
        defaultValue={valor}
        className="border border-line bg-transparent px-4 py-3 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-foreground"
      />
    </label>
  );
}
