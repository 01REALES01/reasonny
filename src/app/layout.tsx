import type { Metadata, Viewport } from 'next';

// The design system (dark theme only in v1) lands with the UI blocks. Nothing
// here invents colours or type: it exists so the App Router has a root.
export const metadata: Metadata = {
  title: 'RealMoney',
  description: 'Personal finance with AI-assisted ingestion.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
