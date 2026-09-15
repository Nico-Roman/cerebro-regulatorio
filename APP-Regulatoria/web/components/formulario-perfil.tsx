"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Registro corto.
 *
 * Antes este formulario pedía empresa, cargo, "desde dónde consultas" (un select
 * obligatorio de siete opciones) y teléfono. Eran cuatro decisiones entre la
 * persona y el buscador, y la del select obligaba a autoclasificarse antes de
 * haber visto si la herramienta sirve: el peor momento posible para pedirlo.
 *
 * Quedan cuatro datos y solo dos obligatorios —nombre y apellido—. El correo ya
 * viene de la cuenta y se muestra sin poder editarse, para que se vea que no hay
 * un dato escondido. Teléfono y empresa son opcionales y lo dicen en la etiqueta.
 */

export interface PerfilInicial {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  empresa: string;
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
        throw new Error(json.mensaje || "No se pudo guardar el registro.");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          etiqueta="Nombre"
          nombre="nombre"
          valor={inicial.nombre}
          requerido
          autoComplete="given-name"
        />
        <Campo
          etiqueta="Apellido"
          nombre="apellido"
          valor={inicial.apellido}
          requerido
          autoComplete="family-name"
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className="label-micro text-muted">Correo</span>
        <input
          type="email"
          value={inicial.email}
          readOnly
          disabled
          className="border border-line bg-surface px-4 py-3 text-base text-muted outline-none"
        />
      </label>

      <Campo
        etiqueta="Teléfono (opcional)"
        nombre="telefono"
        valor={inicial.telefono}
        tipo="tel"
        autoComplete="tel"
        marcador="+56 9 ..."
      />

      <Campo
        etiqueta="Empresa (opcional)"
        nombre="empresa"
        valor={inicial.empresa}
        autoComplete="organization"
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
            Acepto que RegulaMED guarde mis datos y mis búsquedas para operar el
            buscador.
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
          Avísenme cuando cambie una norma importante. (Opcional, te puedes dar de
          baja cuando quieras.)
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
  requerido = false,
  autoComplete,
  marcador,
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  tipo?: string;
  requerido?: boolean;
  autoComplete?: string;
  marcador?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label-micro text-muted">{etiqueta}</span>
      <input
        type={tipo}
        name={nombre}
        defaultValue={valor}
        required={requerido}
        autoComplete={autoComplete}
        placeholder={marcador}
        className="border border-line bg-transparent px-4 py-3 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-foreground"
      />
    </label>
  );
}
