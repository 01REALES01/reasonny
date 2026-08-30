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

/**
 * No maximumScale or userScalable: false.
 *
 * They were there for the usual reason - stopping iOS Safari from zooming when
 * a form field is focused - but they disable pinch-to-zoom for everyone, on
 * every screen, permanently. That is a WCAG 1.4.4 failure and it is what held
 * the Lighthouse accessibility score at 0.87, under the 0.9 the budget
 * asserts. Someone who needs to magnify a transaction amount could not.
 *
 * The focus-zoom it was guarding against has a targeted fix that costs no
 * accessibility: iOS only zooms into a field whose font-size is below 16px, and
 * the form controls were at 15px. globals.css now sets them to 16px. Fix the
 * cause, not everyone's gesture.
 */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
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
