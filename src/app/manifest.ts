import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (PWA — IMPLEMENTATION_PLAN.md 5.2).
 *
 * Provides all required metadata for standalone mobile installation in iOS and Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Reasonny — Finanzas Personales con IA',
    short_name: 'Reasonny',
    description: 'App de finanzas personales con ingesta asistida por IA.',
    /**
     * The app, not the sales page.
     *
     * Launching the installed icon straight into the marketing landing meant
     * the only way forward was its "Entrar" button, which points at /sign-in -
     * so every launch looked like a request to sign in again. The dashboard
     * bounces a signed-out visitor to /sign-in on its own, so nothing is lost
     * for someone who really is signed out.
     */
    start_url: '/dashboard',
    // Explicit, because scope defaults to start_url's parent path. Without it
    // a tap on the brand logo (/) could count as leaving the app and open
    // Safari on top of the installed window.
    scope: '/',
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
