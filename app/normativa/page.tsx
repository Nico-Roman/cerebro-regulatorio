import type { Metadata } from "next";
import { Suspense } from "react";
import { BuscadorNormativa } from "@/components/buscador-normativa";

export const metadata: Metadata = {
  title: "Buscador de normativa farmacéutica y sanitaria chilena",
  description:
    "Busca gratis en la normativa del ISP/ANAMED: decretos, resoluciones y normas técnicas farmacéuticas, de cosméticos y dispositivos médicos, con el texto legal exacto y cita trazable a la fuente oficial.",
  alternates: { canonical: "/normativa" },
  openGraph: {
    title: "Buscador de normativa sanitaria chilena · RegulaMED",
    description:
      "Herramienta gratuita para buscar normativa farmacéutica chilena (ISP/ANAMED) con cita trazable al texto legal exacto.",
    url: "/normativa",
  },
};

export default function NormativaPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8" />}>
      <BuscadorNormativa />
    </Suspense>
  );
}
