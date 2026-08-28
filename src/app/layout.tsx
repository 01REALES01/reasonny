import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { WebVitalsReporter } from '@/components/telemetry/web-vitals-reporter';

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
    <html lang="es">
      <body>
        <ServiceWorkerRegister />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
