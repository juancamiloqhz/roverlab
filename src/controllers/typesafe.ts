import { sameAttempt } from '../../shared/inference';
import { DECISION_DEADLINE_MS, responseSchema, validChoice, wallClock, type DecisionClock, type DecisionOutcome } from '../../shared/decisions';
import type { ExpeditionController } from '../simulation/types';

export function createTypeSafeController(options: {
  fetch?: (url: string, init: RequestInit) => Promise<Response>; clock?: DecisionClock;
} = {}): ExpeditionController {
  const transport = options.fetch ?? ((url, init) => fetch(url, init));
  const clock = options.clock ?? wallClock;
  return { id: 'typesafe', async decide(input, context) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    context.signal.addEventListener('abort', cancel, { once: true });
    if (context.signal.aborted) cancel();
    const expiresAt = clock.now() + DECISION_DEADLINE_MS;
    const clearDeadline = clock.after(DECISION_DEADLINE_MS, cancel);
    const cancelled = new Promise<DecisionOutcome>(resolve => {
      const settle = () => resolve({ failure: context.signal.aborted ? 'cancelled' : 'deadline' });
      abort.signal.addEventListener('abort', settle, { once: true });
      if (abort.signal.aborted) settle();
    });
    const run = async (): Promise<DecisionOutcome> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (abort.signal.aborted || clock.now() >= expiresAt) return { failure: context.signal.aborted ? 'cancelled' : 'deadline' };
        const identity = context.reserveAttempt(attempt as 0 | 1);
        if (!identity) return { failure: 'budget' };
        try {
          const response = await transport('/api/decision', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, expiresAt, identity }), signal: abort.signal });
          if (!response.ok) return { failure: 'unavailable' };
          const parsed = responseSchema.safeParse(await response.json());
          if (!parsed.success) return { failure: 'invalid-output' };
          if (parsed.data.evidence) {
            if (!sameAttempt(parsed.data.evidence.identity, identity)) return { failure: 'invalid-output' };
            context.reportAttempt(parsed.data.evidence);
          }
          if (!parsed.data.ok) {
            if (parsed.data.retryable && attempt === 0) continue;
            return { failure: parsed.data.failure };
          }
          const selected = validChoice(parsed.data.choice, input);
          return selected ? { selectedCandidateId: selected.choice, probabilities: selected.probabilities, confidence: selected.confidence } : { failure: 'invalid-output' };
        } catch (error) {
          if (error instanceof SyntaxError) return { failure: 'invalid-output' };
          if (attempt === 1) return { failure: 'unavailable' };
        }
      }
      return { failure: 'unavailable' };
    };
    try {
      const result = await Promise.race([run(), cancelled]);
      if (context.signal.aborted) return { failure: 'cancelled' };
      if (clock.now() >= expiresAt) return { failure: 'deadline' };
      return result;
    }
    finally { clearDeadline(); context.signal.removeEventListener('abort', cancel); }
  } };
}
