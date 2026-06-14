import type { Metadata } from "next";
import localFont from "next/font/local";
import { Syne, Unbounded } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { Toaster } from "@/components/ui/sonner";
const inter = localFont({
  src: [
    {
      path: "./fonts/Inter.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-inter",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
});

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://presentia.ai"),
  title: "PresentIA - Generador de presentaciones con IA de código abierto",
  description:
    "Generador de presentaciones con IA de código abierto con plantillas personalizadas, soporte multi-modelo (OpenAI, Gemini, Ollama) y exportación a PDF/PPTX. Alternativa gratuita a Gamma.",
  keywords: [
    "generador de presentaciones IA",
    "presentaciones con inteligencia artificial",
    "herramienta de visualización de datos",
    "presentación de datos con IA",
    "generador de presentaciones",
    "datos a presentación",
    "presentaciones interactivas",
    "diapositivas profesionales",
  ],
  openGraph: {
    title: "PresentIA - Generador de presentaciones con IA de código abierto",
    description:
      "Generador de presentaciones con IA de código abierto con plantillas personalizadas, soporte multi-modelo (OpenAI, Gemini, Ollama) y exportación a PDF/PPTX. Alternativa gratuita a Gamma.",
    url: "https://presentia.ai",
    siteName: "PresentIA",
    images: [
      {
        url: "https://presentia.ai/presentia-feature-graphics.png",
        width: 1200,
        height: 630,
        alt: "PresentIA Logo",
      },
    ],
    type: "website",
    locale: "es_ES",
  },
  alternates: {
    canonical: "https://presentia.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "PresentIA - Generador de presentaciones con IA de código abierto",
    description:
      "Generador de presentaciones con IA de código abierto con plantillas personalizadas, soporte multi-modelo (OpenAI, Gemini, Ollama) y exportación a PDF/PPTX. Alternativa gratuita a Gamma.",
    images: ["https://presentia.ai/presentia-feature-graphics.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${syne.variable} ${unbounded.variable} antialiased`}
      >
        <Providers>
          <MixpanelInitializer>

            {children}

          </MixpanelInitializer>
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
