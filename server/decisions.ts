import { APIConnectionError, APIError, choice, TypeSafeClient, type Fetch } from '@typesafe-ai/sdk';
import { DECISION_DEADLINE_MS, requestSchema, validChoice, wallClock, type DecisionClock, type DecisionResponse } from '../shared/decisions';

// One local request issues at most one SDK attempt. The browser coordinates the
// complete operation so its deadline includes both local transport and retries.
export function createDecisionHandler(options: { apiKey?: string; fetch?: Fetch; clock?: DecisionClock } = {}) {
  const clock = options.clock ?? wallClock;
  const client = options.apiKey?.trim() ? new TypeSafeClient({ apiKey: options.apiKey,
    baseURL: 'https://api.typesafe.ai', defaultModel: 'jev-latest', logLevel: 'off',
    retry: { maxRetries: 0 }, timeout: DECISION_DEADLINE_MS, fetch: options.fetch }) : null;
  return async (request: Request): Promise<Response> => {
    const respond = (body: DecisionResponse) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    if (new URL(request.url).pathname !== '/api/decision' || request.method !== 'POST') return new Response(null, { status: 404 });
    const origin = request.headers.get('origin');
    // Vite is configured to preserve the browser's Host header.
    if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return respond({ ok: false, failure: 'invalid-request', retryable: false }); }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return respond({ ok: false, failure: 'invalid-request', retryable: false });
    if (!client) return respond({ ok: false, failure: 'configuration', retryable: false });
    const { input, expiresAt } = parsed.data;
    const remaining = Math.min(DECISION_DEADLINE_MS, expiresAt - clock.now());
    if (remaining <= 0) return respond({ ok: false, failure: 'deadline', retryable: false });
    const abort = new AbortController();
    const cancel = () => abort.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const clearDeadline = clock.after(remaining, cancel);
    try {
      abort.signal.throwIfAborted();
      const result = await client.systemOne({
        state: input,
        questions: { action: choice(
          'Choose the complete available action that best pursues `objective` under the current `instructions`, known observations and memory, time, battery and cargo. Only delivered samples earn science credit. Properties are unknown until inspection. Explore to discover more, inspect to learn, collect to carry, return to deliver, recharge at base, or wait. Known dust storms disclose their expiry and effects. Route estimates assume immediate departure; avoid-storm candidates take a longer known route around the region, and waiting consumes expedition time. Choose exactly one supplied candidate; do not infer hidden terrain or properties.',
          Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate])),
        ) },
      }, { signal: abort.signal, timeout: remaining, retry: { maxRetries: 0 } });
      if (abort.signal.aborted || clock.now() >= expiresAt) return respond({ ok: false, failure: 'deadline', retryable: false });
      const selected = validChoice(result?.answers?.action, input);
      return selected ? respond({ ok: true, choice: selected }) : respond({ ok: false, failure: 'invalid-output', retryable: false });
    } catch (error) {
      if (abort.signal.aborted) return respond({ ok: false, failure: request.signal.aborted ? 'cancelled' : 'deadline', retryable: false });
      if (error instanceof APIError && [401, 403].includes(error.status)) return respond({ ok: false, failure: 'configuration', retryable: false });
      const retryable = error instanceof APIConnectionError || (error instanceof APIError && (error.status === 408 || error.status === 429 || error.status >= 500));
      return respond({ ok: false, failure: 'unavailable', retryable });
    } finally {
      clearDeadline();
      request.signal.removeEventListener('abort', cancel);
    }
  };
}
