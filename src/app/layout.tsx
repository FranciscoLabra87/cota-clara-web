import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { CookieConsent } from '@/components/CookieConsent';
import { site } from '@/data/site';
import './globals.css';

const montserrat = localFont({
  src: [
    { path: './fonts/montserrat-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/montserrat-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/montserrat-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-montserrat',
  display: 'swap',
});

const sourceSans = localFont({
  src: [
    { path: './fonts/source-sans-3-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-sans-3-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/source-sans-3-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: 'Cota Clara · Patrimonio Inmobiliario',
    template: '%s · Cota Clara',
  },
  description:
    'Corretaje, tasaciones, asesoría y gestión de patrimonio inmobiliario en Santiago. Decisiones sobre tu propiedad con precisión técnica y transparencia.',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    siteName: 'Cota Clara · Patrimonio Inmobiliario',
    // Sin esta imagen, Instagram y WhatsApp arman la vista previa con la primera
    // foto del HTML, que es un logo del carrusel de inmobiliarias.
    // Se genera con `node scripts/og-imagen.mjs`.
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Cota Clara · Patrimonio Inmobiliario' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B2F4A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" data-scroll-behavior="smooth" className={`${montserrat.variable} ${sourceSans.variable}`}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="site-main">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
        <CookieConsent measurementId={process.env.NEXT_PUBLIC_GA4_MANUAL_EVENTS === '1' ? process.env.NEXT_PUBLIC_GA4_ID : undefined} />
      </body>
    </html>
  );
}
