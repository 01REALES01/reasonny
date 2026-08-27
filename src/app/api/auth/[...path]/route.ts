/**
 * Every auth request the browser makes lands here and is forwarded to Neon
 * from the server, so the session cookies come back on OUR origin instead of
 * Neon's. See src/lib/auth-server.ts for why that is not optional on iOS.
 *
 * The path is fixed by this folder, not by configuration: the browser client
 * in src/lib/auth-client.ts is pointed at `/api/auth`, and moving this
 * directory without moving that string breaks sign-in with a 404.
 *
 * WHY NOT A REWRITE IN next.config.ts
 * -----------------------------------
 * A rewrite forwards the request but does not touch the response, so the
 * Set-Cookie would still carry Neon's Domain and its `Partitioned` flag - a
 * third-party cookie either way. This handler rewrites those flags, and
 * additionally mints the signed session_data cookie that lets a Server
 * Component read the session without a round trip to Neon on every render.
 *
 * WHY NOT UNDER /api/v1
 * ---------------------
 * That namespace is the public, versioned API for the Shortcut and the
 * Telegram bot: bearer auth, and a compatibility contract we have to keep.
 * This is an internal browser detail with no contract at all, and the path
 * shape is the SDK's, not ours.
 */

import { getAuthHandlers } from '@/lib/auth-server';

type AuthHandlers = ReturnType<typeof getAuthHandlers>;
type Handler = AuthHandlers[keyof AuthHandlers];

/**
 * Dispatched on the first request rather than destructured at module load, so
 * that `next build` does not need NEON_AUTH_COOKIE_SECRET to emit a page.
 * Same reasoning as the lazy database pool.
 */
const forward =
  (method: keyof AuthHandlers): Handler =>
  (request, context) =>
    getAuthHandlers()[method](request, context);

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const DELETE = forward('DELETE');
export const PATCH = forward('PATCH');
