import { ToastProvider } from '@/components/ui/ToastProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Metadata } from 'next';
import { Barlow, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://americano-s.vercel.app';
const ogImagePath = '/opengraph-image.jpg?v=20260308';

const barlow = Barlow({
  variable: '--font-barlow',
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Americano's | Torneos de Padel",
    template: "%s | Americano's",
  },
  description:
    'Organiza torneos de padel tipo americano con grupos, ranking, desempates y bracket eliminatorio.',
  applicationName: "Americano's",
  keywords: [
    'torneos de padel',
    'padel americano',
    'organizador de torneos',
    'ranking padel',
    'bracket padel',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    title: "Americano's | Torneos de Padel",
    description:
      'Gestiona torneos con grupos, ranking automatico, desempates y bracket en una sola app.',
    siteName: "Americano's",
    images: [
      {
        url: ogImagePath,
        width: 1216,
        height: 582,
        alt: "Americano's - Gestion de torneos de padel",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Americano's | Torneos de Padel",
    description:
      'Gestiona torneos con grupos, ranking automatico, desempates y bracket en una sola app.',
    images: [`${siteUrl}${ogImagePath}`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <body className={`${barlow.variable} ${jetbrainsMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='tornea-theme';var t=localStorage.getItem(k);var v=(t==='light'||t==='dark')?t:'dark';document.documentElement.setAttribute('data-theme',v);}catch(_){document.documentElement.setAttribute('data-theme','dark');}})();",
          }}
        />
        <ToastProvider>
          <ThemeToggle />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
