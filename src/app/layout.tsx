import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';

import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { WebVitalsReporter } from '@/components/telemetry/web-vitals-reporter';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif-loaded',
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'RealMoney',
  description: 'Finanzas personales con ingesta asistida por IA.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RealMoney',
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
