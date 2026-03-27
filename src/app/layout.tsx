import type { Metadata } from 'next';
import { Geist_Mono, Inter, Lora, Space_Grotesk } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { getSiteUrl } from '@/lib/seo';
import { isRtlLocale } from '@/lib/i18n-config';
import { AuthInitializer } from '@/components/layout/AuthInitializer';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { LoginModal } from '@/components/ui/LoginModal';
import { Header } from '@/components/layout/Header';
import { getThemeBootstrapScript } from '@/lib/theme-bootstrap';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Craftree — L'arbre de fabrication de la civilisation",
    template: '%s',
  },
  description:
    'Explorez l’arbre complet des technologies humaines, de la matière première au produit final. Découvrez de quoi est faite la civilisation.',
  keywords: [
    'technologies',
    'civilisation',
    'chaînes de fabrication',
    'matières premières',
    'Tree',
    'Craftree',
  ],
  authors: [{ name: 'Craftree' }],
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteUrl,
    siteName: 'Craftree',
    title: "Craftree — L'arbre de fabrication de la civilisation",
    description:
      'Explorez l’arbre complet des technologies humaines, de la matière première au produit final.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: "Craftree — L'arbre de fabrication de la civilisation",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Craftree — L'arbre de fabrication de la civilisation",
    description:
      'Explorez l’arbre complet des technologies humaines, de la matière première au produit final.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Craftree',
  url: siteUrl,
  description:
    'Arbre interactif des technologies et chaînes de fabrication, de la matière première au produit final.',
  inLanguage: 'fr-FR',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${lora.variable} h-full bg-page antialiased`}
    >
      <body className="flex min-h-screen min-h-[100dvh] flex-col bg-page font-sans text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthInitializer />
            <ToastContainer />
            <LoginModal />
            <Header />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
