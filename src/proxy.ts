import type { NextRequest, NextResponse } from 'next/server';

import { getAuthProxy } from '@/lib/auth-server';

/**
 * Runs before every authenticated page renders.
 *
 * Two jobs, and the second is the one that matters: it turns away a request
 * with no session before the page is built, and it writes back the refreshed
 * session cookies that a Server Component render is not allowed to write. See
 * getAuthProxy in src/lib/auth-server.ts for why that second job is the whole
 * reason this file exists.
 *
 * `middleware.ts` is the old name for this file; Next 16 renamed the convention
 * to `proxy.ts` and gave it the Node runtime by default, which is what the
 * Neon Auth SDK needs.
 */
export default function proxy(request: NextRequest): Promise<NextResponse> {
  return getAuthProxy()(request);
}

/**
 * Only the authenticated screens, listed one by one rather than as a negative
 * pattern.
 *
 * A catch-all matcher would put the proxy in front of the landing page - which
 * is public, static and the LCP that the performance budget is measured on -
 * and in front of /api/v1, which authenticates the Shortcut with a bearer
 * token and has no session cookie to find. Both would break: the landing would
 * bounce a signed-out visitor to /sign-in, and the Shortcut would be redirected
 * instead of writing a transaction.
 *
 * A new authenticated route has to be added here. That is the cost of the safe
 * default, and it is cheaper than the outage the other default causes.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/bienvenida/:path*',
    '/captura/:path*',
    '/mes/:path*',
    '/movimiento/:path*',
    '/nuevo/:path*',
    '/perfil/:path*',
    '/revisar/:path*',
    '/telegram/:path*',
  ],
};
