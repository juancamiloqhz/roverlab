import { readProviderInput } from '../tests/fixtures/provider-input';
// Browser verification runs the real backend and SDK, replacing only the paid service.
import { createDecisionHandler } from '../server/decisions';
import type { ControllerInput } from '../src/simulation/types';

const releases = new Set<() => void>();
const handler = createDecisionHandler({ apiKey: 'browser-test-key', fetch: async (_url, init) => {
  const input = readProviderInput(JSON.parse(init!.body as string).state) as ControllerInput;
  if (input.instructions === 'Hold for browser verification') await new Promise<void>((resolve, reject) => {
    const release = () => { releases.delete(release); resolve(); };
    releases.add(release);
    init!.signal!.addEventListener('abort', () => { releases.delete(release); reject(new Error('cancelled')); }, { once: true });
  });
  return Response.json({ model: input.instructions === 'Unknown pricing for browser verification' ? 'jev-future' : 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: {
    type: 'choice', choice: input.instructions === 'Invalid choice for browser verification' ? 'invented' : 'wait:5000', confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, 1 / input.candidates.length])),
  } } });
} });
Bun.serve({ hostname: '127.0.0.1', port: 4174, fetch(request) {
  if (new URL(request.url).pathname === '/release') {
    for (const release of releases) release();
    return new Response('released');
  }
  if (new URL(request.url).pathname === '/health') return new Response('ready');
  return handler(request);
} });
