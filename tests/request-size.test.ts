import { readProviderInput } from './fixtures/provider-input';
import type { ControllerInput } from '../src/simulation/types';
import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { importExpeditionRecord } from '../src/records/contract';

test('the failed capture input and its long matched expedition fit a compact, lossless provider request', async () => {
  for (const name of ['jev', 'baseline']) {
    const record = importExpeditionRecord(await Bun.file(`public/guided/${name}.json`).text());
    const input = record.decisions.at(-1)!.input;
    let requestBytes = 0;
    let supplied: ControllerInput | undefined;
    let options: string[] = [];
    const handler = createDecisionHandler({ apiKey: 'request-size-scripted-key', fetch: async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      // Structured values can expand during provider rendering. Use the exact
      // text when present, otherwise account for indented structured rendering.
      const state = typeof body.state === 'string' ? body.state : JSON.stringify(body.state, null, 2);
      requestBytes = new TextEncoder().encode(state + JSON.stringify(body.questions)).length;
      supplied = readProviderInput(body.state);
      const ids = Object.keys(body.questions.action.criteria);
      options = ids;
      return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 100, output_tokens: 10 }, answers: {
        action: { type: 'choice', choice: ids[0], confidence: 0, probabilities: Object.fromEntries(ids.map(id => [id, 1 / ids.length])) },
      } });
    } });
    const response = await handler(new Request('http://localhost/api/decision', { method: 'POST', body: JSON.stringify({ input,
      expiresAt: Date.now() + 5000, identity: { expeditionId: crypto.randomUUID(), decisionId: 1, attemptId: crypto.randomUUID() } }) }));
    expect(supplied).toEqual(input);
    expect(options).toEqual(input.candidates.map(candidate => candidate.id));
    expect(requestBytes).toBeLessThan(60_000);
    expect((await response.json()).ok).toBe(true);
    expect(requestBytes).toBeGreaterThan(0);
  }
});
