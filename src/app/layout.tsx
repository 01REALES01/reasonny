import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RealMoney',
  description: 'Personal finance with AI-assisted ingestion.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
