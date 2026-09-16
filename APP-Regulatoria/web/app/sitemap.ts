import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { guiasPublicadas } from "@/lib/guias";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  const guias = guiasPublicadas();

  // Las guías van con prioridad alta: son las únicas páginas del sitio escritas
  // para una búsqueda concreta, y por lo tanto las únicas que pueden traer a
  // alguien que todavía no conoce la marca.
  const urlsGuias: MetadataRoute.Sitemap = guias.length
    ? [
        {
          url: `${SITE.url}/guias`,
          lastModified: ahora,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        ...guias.map((g) => ({
          url: `${SITE.url}/guias/${g.slug}`,
          lastModified: new Date(`${g.actualizada}T12:00:00`),
          changeFrequency: "monthly" as const,
          priority: 0.8,
        })),
      ]
    : [];

  return [
    { url: SITE.url, lastModified: ahora, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE.url}/asesoria`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/normativa`,
      lastModified: ahora,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE.url}/agenda`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...urlsGuias,
    {
      url: `${SITE.url}/privacidad`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE.url}/terminos`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
