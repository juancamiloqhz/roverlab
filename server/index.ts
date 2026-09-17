import { createDecisionHandler } from './decisions';

const server = Bun.serve({
  hostname: '127.0.0.1', port: 3001, maxRequestBodySize: 2_000_000,
  fetch: createDecisionHandler({ apiKey: process.env.TYPESAFE_API_KEY }),
  error: () => Response.json({ ok: false, failure: 'unavailable', retryable: false }, { status: 500 }),
});
console.info(`RoverLab decision backend: ${server.url}`);
