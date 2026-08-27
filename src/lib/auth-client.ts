'use client';

import { createAuthClient, type VanillaBetterAuthClient } from '@neondatabase/auth';

/**
 * Browser-side client for authentication.
 *
 * It is pointed at THIS app, not at Neon. The catch-all route at
 * src/app/api/auth/[...path] forwards to Neon from the server, which is what
 * makes the session cookie first-party - see src/lib/auth-server.ts for why
 * that is not optional on iOS. Nothing here needs to know Neon's hostname, so
 * NEON_AUTH_BASE_URL stays server-side and never reaches the bundle.
 *
 * The path must be absolute-with-a-path: Better Auth appends '/api/auth' to
 * any base URL that has no path of its own, so passing the bare origin would
 * silently work and passing '/api/auth/' would not.
 *
 * Typed as VanillaBetterAuthClient rather than ReturnType<typeof
 * createAuthClient>: for a generic function ReturnType resolves the parameter
 * to its CONSTRAINT, which here is the union of every adapter including the
 * Supabase one, so nothing narrows and no method exists on it.
 *
 * Memoised so the session cache and cross-tab sync the client keeps alive
 * survive re-renders.
 */
const AUTH_API_PATH = '/api/auth';

let client: VanillaBetterAuthClient | undefined;

export function getAuthClient(): VanillaBetterAuthClient {
  if (client === undefined) {
    // createAuthClient declares a default type parameter, but its return type
    // still widens to the union of every adapter (including the Supabase one),
    // and the adapter type that would narrow it is only exported from an
    // internal chunk under a mangled alias. One cast here is contained; without
    // it every call site loses the method types. Revisit when the package
    // leaves beta - it is 0.5.0-beta today.
    client = createAuthClient(
      `${window.location.origin}${AUTH_API_PATH}`,
    ) as VanillaBetterAuthClient;
  }
  return client;
}
