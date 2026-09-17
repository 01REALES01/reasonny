import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Urbanist } from 'next/font/google';

import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { WebVitalsReporter } from '@/components/telemetry/web-vitals-reporter';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const fontUrbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  // Resolves canonical/OG/Twitter URLs. Without it Next warns and falls back to
  // localhost. The deployed host wins via NEXT_PUBLIC_APP_URL.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://reasonny.app'),
  title: 'Reasonny',
  description: 'Finanzas personales con ingesta asistida por IA.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Reasonny',
  },
  icons: {
    icon: [
      { url: '/icon.png?v=3', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon.svg?v=3', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png?v=3',
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
  // The landing hero and the app both sit under a black-translucent status bar;
  // `cover` lets `env(safe-area-inset-*)` return real values so content can
  // clear the notch instead of hiding behind it.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${fontUrbanist.variable}`}
    >
      <body>
        <ServiceWorkerRegister />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
