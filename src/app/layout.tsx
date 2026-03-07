import type { Metadata } from "next";
import { Barlow, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/ToastProvider";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://americano-s.vercel.app"),
  title: {
    default: "Americano's | Torneos de Padel",
    template: "%s | Americano's",
  },
  description:
    "Organiza torneos de padel tipo americano con grupos, ranking, desempates y bracket eliminatorio.",
  applicationName: "Americano's",
  keywords: [
    "torneos de padel",
    "padel americano",
    "organizador de torneos",
    "ranking padel",
    "bracket padel",
  ],
  alternates: {
    canonical: "/dashboard",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://americano-s.vercel.app/dashboard",
    title: "Americano's | Torneos de Padel",
    description:
      "Gestiona torneos con grupos, ranking automatico, desempates y bracket en una sola app.",
    siteName: "Americano's",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Americano's - Gestion de torneos de padel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Americano's | Torneos de Padel",
    description:
      "Gestiona torneos con grupos, ranking automatico, desempates y bracket en una sola app.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${barlow.variable} ${jetbrainsMono.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
