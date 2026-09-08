import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    { url: SITE.url, lastModified: ahora, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE.url}/normativa`,
      lastModified: ahora,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
