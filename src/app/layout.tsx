import type { Metadata } from 'next';
import { Geist_Mono, Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { getSiteUrl } from '@/lib/seo';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full bg-[#0A0E17] antialiased`}
    >
      <body className="flex min-h-screen min-h-[100dvh] flex-col bg-[#0A0E17] font-sans text-[#E8ECF4] antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
