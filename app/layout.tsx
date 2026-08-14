import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Grotesca geométrica para titulares: es lo que da el carácter de la marca.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.nombre} — Asesoría en asuntos regulatorios farmacéuticos en Chile`,
    template: `%s · ${SITE.nombre}`,
  },
  description: SITE.descripcion,
  keywords: [
    "asesoría regulatoria farmacéutica",
    "asuntos regulatorios Chile",
    "regulación farmacéutica",
    "registro sanitario ISP",
    "registro de productos farmacéuticos",
    "inscripción de cosméticos",
    "inscripción de dispositivos médicos",
    "registro de dispositivos médicos Chile",
    "farmacovigilancia Chile",
    "tecnovigilancia",
    "cosmetovigilancia",
    "ANAMED",
    "Instituto de Salud Pública",
    "buenas prácticas de manufactura",
    "consultoría regulatoria sanitaria",
  ],
  authors: [{ name: SITE.nombre }],
  creator: SITE.nombre,
  publisher: SITE.nombre,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: SITE.url,
    siteName: SITE.nombre,
    title: `${SITE.nombre} — Asesoría en asuntos regulatorios farmacéuticos en Chile`,
    description: SITE.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.nombre} — Asuntos regulatorios en Chile`,
    description: SITE.descripcion,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  category: "Consultoría regulatoria sanitaria",
};

// Datos estructurados: ayudan a Google a entender que esto es un servicio
// profesional local con un catálogo concreto de prestaciones.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: SITE.nombre,
  description: SITE.descripcion,
  url: SITE.url,
  email: SITE.email,
  telephone: `+${SITE.whatsapp}`,
  areaServed: { "@type": "Country", name: "Chile" },
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE.ciudad,
    addressRegion: SITE.region,
    addressCountry: SITE.pais,
  },
  knowsAbout: [
    "Registro sanitario de productos farmacéuticos",
    "Inscripción de cosméticos",
    "Registro de dispositivos médicos",
    "Farmacovigilancia",
    "Tecnovigilancia",
    "Buenas prácticas de manufactura",
    "Normativa ISP ANAMED Chile",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Nav />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
