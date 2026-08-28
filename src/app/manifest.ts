import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (PWA — IMPLEMENTATION_PLAN.md 5.2).
 *
 * Provides all required metadata for standalone mobile installation in iOS and Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RealMoney — Finanzas Personales con IA',
    short_name: 'RealMoney',
    description: 'App de finanzas personales con ingesta asistida por IA.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
