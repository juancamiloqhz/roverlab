import type { DecisionClock } from '../shared/decisions';
import type { AttemptEvidence, AttemptIdentity } from '../shared/inference';
import { PROMPT_VERSION, REQUESTED_MODEL, responseMetadata } from './inference';

export function createAttemptAccounting(identity: AttemptIdentity, clock: DecisionClock) {
  let evidence: AttemptEvidence = { identity, revision: 1, observedAtMs: clock.now(), dispatch: 'not-dispatched',
    execution: 'not-dispatched', httpStatus: null, requestedModel: REQUESTED_MODEL, promptVersion: PROMPT_VERSION,
    resolvedModel: null, providerRequestId: null, inputTokens: null, outputTokens: null, pricing: null, startedAtMs: null, latencyMs: null };
  let published = false;
  const terminalResponse = () => evidence.execution === 'response-received' || evidence.execution === 'provider-error';
  function update(fields: Partial<AttemptEvidence>) {
    if (Object.entries(fields).every(([key, value]) => JSON.stringify(evidence[key as keyof AttemptEvidence]) === JSON.stringify(value))) return;
    evidence = { ...evidence, ...fields, revision: evidence.revision! + 1, observedAtMs: clock.now() };
    published = true;
  }
  const duration = () => evidence.startedAtMs === null ? null : Math.max(evidence.latencyMs ?? 0, clock.now() - evidence.startedAtMs);
  function receive(body: unknown, requestId: unknown, httpStatus: number, credential: string) {
    const metadata = responseMetadata(body, requestId, clock.now(), credential);
    // Confirmed facts and their historical pricing basis never change on a
    // repeated delivery. Later observations can only fill missing metadata.
    const additions = Object.fromEntries(Object.entries(metadata).filter(([key, value]) => value !== null && evidence[key as keyof AttemptEvidence] === null));
    update({ ...additions, httpStatus: evidence.httpStatus ?? httpStatus,
      execution: httpStatus >= 400 ? 'provider-error' : 'response-received', latencyMs: terminalResponse() ? evidence.latencyMs : duration() });
  }
  return {
    identity,
    get: () => published ? structuredClone(evidence) : null,
    publish: () => { published = true; },
    dispatch: () => update({ dispatch: 'dispatched', execution: 'in-flight', startedAtMs: clock.now() }),
    finish(execution: AttemptEvidence['execution']) {
      if (evidence.dispatch === 'dispatched' && !terminalResponse()) update({ execution, latencyMs: duration() });
    },
    receive,
    observe(response: Response, credential: string) {
      const requestId = response.headers.get('x-typesafe-request-id');
      const header = responseMetadata(null, requestId, clock.now(), credential);
      update({ httpStatus: response.status, providerRequestId: evidence.providerRequestId ?? header.providerRequestId });
      const reader = response.clone().body?.getReader();
      if (!reader) { receive(null, requestId, response.status, credential); return; }
      // Bound this independent observer even if a provider sends an endless or
      // stalled body after cancellation. Partial bodies establish no token count.
      let expired = false;
      const clear = clock.after(5_000, () => { expired = true; void reader.cancel().catch(() => {}); });
      void (async () => {
        const decoder = new TextDecoder();
        let text = "";
        let size = 0;
        try {
          while (!expired) {
            const { done, value } = await reader.read();
            if (expired) return;
            if (done) {
              let body: unknown = null;
              try { body = JSON.parse(text + decoder.decode()); } catch { /* Headers remain evidence for malformed JSON. */ }
              receive(body, requestId, response.status, credential);
              return;
            }
            size += value.byteLength;
            if (size > 1_048_576) { void reader.cancel().catch(() => {}); return; }
            text += decoder.decode(value, { stream: true });
          }
        } catch { /* A failed body cannot confirm usage. */ }
        finally { clear(); }
      })();
    },
  };
}
