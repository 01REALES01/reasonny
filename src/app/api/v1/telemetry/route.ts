import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { recordMetrics } from '@/core/services/telemetry.service';
import { TELEMETRY_METRICS, TELEMETRY_RATINGS } from '@/core/telemetry';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Upper bound on samples per beacon.
 *
 * The page collects five web vitals plus the occasional entry duration, so ten
 * is generous. The bound exists because this endpoint takes a body from the
 * browser and writes a row per element: without it, one request could ask for
 * an unbounded number of inserts. Telemetry is the lowest-value data in the
 * system and must not be the most expensive endpoint to serve.
 */
const MAX_SAMPLES_PER_REQUEST = 10;

const SampleSchema = z.object({
  metric: z.enum(TELEMETRY_METRICS),
  // Bounded on both ends. Negative is a broken clock; the ceiling is a day in
  // milliseconds, which no real LCP or form fill approaches, and which stops a
  // absurd value from dragging every future percentile with it.
  value: z.number().finite().min(0).max(86_400_000),
  rating: z.enum(TELEMETRY_RATINGS).optional(),
  route: z.string().max(255).optional(),
});

const PayloadSchema = z.object({
  samples: z.array(SampleSchema).min(1).max(MAX_SAMPLES_PER_REQUEST),
});

/**
 * Receives Core Web Vitals and entry-duration samples from the browser (B9).
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER ACTION
 * -------------------------------------------
 * The samples that matter most are sent with `navigator.sendBeacon` as the tab
 * goes away - that is the only moment INP is final. sendBeacon issues a plain
 * cross-origin-style POST and cannot invoke a Server Action, which needs
 * React's action protocol and a live client runtime. Same reason `quick-add`
 * and the Telegram `callback_query` will be route handlers in phase 4: the
 * caller is not a React form.
 *
 * WHY IT ALWAYS ANSWERS 204, EVEN WHEN IT REJECTS
 * ----------------------------------------------
 * Nothing on the client can act on the answer. The page is being unloaded, and
 * sendBeacon discards the response body without reading it. Returning a status
 * the browser will never surface is theatre; what matters is that a malformed
 * or unauthenticated beacon writes nothing. Genuine faults are logged
 * server-side, which is the only place anyone can actually see them.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await getCurrentUser();

  // An anonymous beacon has no user to attribute the sample to, and telemetry
  // rows are per-tenant by construction. Dropped, not errored.
  if (!session?.id) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn('[telemetry] rejected malformed beacon:', parsed.error.issues);
    return new NextResponse(null, { status: 204 });
  }

  try {
    await recordMetrics(
      toUserId(session.id),
      parsed.data.samples.map((sample) => ({
        metric: sample.metric,
        value: sample.value,
        rating: sample.rating ?? null,
        route: sample.route ?? null,
      })),
    );
  } catch (error) {
    // Losing a measurement must never surface to the user, and must never be
    // silent to us: this is the one place that distinction can be made.
    console.error('[telemetry] failed to record beacon:', error);
  }

  return new NextResponse(null, { status: 204 });
}
