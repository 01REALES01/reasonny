import type { MetadataRoute } from 'next';

/**
 * Robots.txt (Principle P8).
 *
 * Blocks crawling of all authenticated and API surfaces.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/sign-in'],
        disallow: ['/api/', '/nuevo', '/dashboard'],
      },
    ],
    sitemap: 'https://reasonny.app/sitemap.xml',
  };
}
