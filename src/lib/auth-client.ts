'use client';

import { createAuthClient, type VanillaBetterAuthClient } from '@neondatabase/auth';

/**
 * Browser-side client for the Neon-hosted auth server.
 *
 * The base URL arrives as a prop from a server component rather than through a
 * NEXT_PUBLIC_ variable. It is not a secret - the browser calls that host
 * anyway - but `neon config apply` writes exactly one variable for it, and
 * duplicating it under a second name is how the two drift apart.
 *
 * Typed as VanillaBetterAuthClient rather than ReturnType<typeof
 * createAuthClient>: for a generic function ReturnType resolves the parameter
 * to its CONSTRAINT, which here is the union of every adapter including the
 * Supabase one, so nothing narrows and no method exists on it.
 *
 * Memoised so the session cache and cross-tab sync the client keeps alive
 * survive re-renders.
 */
let client: VanillaBetterAuthClient | undefined;

export function getAuthClient(baseUrl: string): VanillaBetterAuthClient {
  if (client === undefined) {
    // createAuthClient declares a default type parameter, but its return type
    // still widens to the union of every adapter (including the Supabase one),
    // and the adapter type that would narrow it is only exported from an
    // internal chunk under a mangled alias. One cast here is contained; without
    // it every call site loses the method types. Revisit when the package
    // leaves beta - it is 0.5.0-beta today.
    client = createAuthClient(baseUrl) as VanillaBetterAuthClient;
  }
  return client;
}
