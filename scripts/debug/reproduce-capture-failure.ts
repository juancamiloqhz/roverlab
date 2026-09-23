import { createDecisionHandler } from '../../server/decisions';
import { createTypeSafeController } from '../../src/controllers/typesafe';
import { importExpeditionRecord } from '../../src/records/contract';
import { controllerInputSchema } from '../../shared/decisions';
import { inferenceGuard } from '../../shared/limits';
import { summarizeUsage, type AttemptEvidence, type DecisionAccounting } from '../../shared/inference';

const live = Bun.argv.includes('--live');
const key = live ? process.env.TYPESAFE_API_KEY?.trim() : 'offline-diagnostic';
if (!key) throw new Error('Configure the server-side key.');
if (Object.keys(process.env).some(name => name.startsWith('VITE_') && /KEY|TOKEN|SECRET/.test(name))) throw new Error('Browser credential configuration detected.');
const sourceFile = Bun.argv.includes('--baseline') ? 'public/guided/baseline.json' : 'public/guided/jev.json';
const source = importExpeditionRecord(await Bun.file(sourceFile).text());
const sourceDecision = source.decisions.at(-1)!;
const input = controllerInputSchema.parse(sourceDecision.input);
const limits = { providerAttempts: 1, estimatedCost: 0.01 };
const accounting: DecisionAccounting = { expeditionId: crypto.randomUUID(), attempts: [] };
const decision = { controller: 'typesafe', inferenceAttempts: 0, accounting };
let diagnostic: unknown;
let outbound = 0;
const redact = (value: unknown) => typeof value === 'string' ? value.replaceAll(key, '<REDACTED>').slice(0, 1600) : undefined;
const handler = createDecisionHandler({ apiKey: key, fetch: async (url, init) => {
  if (++outbound > 1) throw new Error('Diagnostic attempt limit exceeded.');
  const payload = JSON.parse(init!.body as string);
  if (!live) {
    const ids = Object.keys(payload.questions.action.criteria);
    diagnostic = { localInputValid: true, payloadBytes: JSON.stringify(payload).length, candidates: ids.length };
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 0, output_tokens: 0 },
      answers: { action: { type: 'choice', choice: ids[0], confidence: 0,
        probabilities: Object.fromEntries(ids.map(id => [id, 1 / ids.length])) } } });
  }
  const response = await fetch(url, init);
  const body = await response.clone().json().catch(() => null);
  diagnostic = { httpStatus: response.status,
    message: redact(body?.message) ?? redact(body?.error?.message) ?? redact(body?.error) ?? redact(body?.detail),
    structuredDetail: body?.detail && typeof body.detail === 'object' ? redact(JSON.stringify(body.detail)) : undefined,
    errorCode: redact(body?.code) ?? redact(body?.error?.code), responseFields: body ? Object.keys(body) : [] };
  return response;
} });
const controller = createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) });
console.info(JSON.stringify({ live, serverKeyConfigured: !!key, limits, sourceFile, sourceDecision: sourceDecision.id, retries: 0 }));
const outcome = await controller.decide(input, { signal: new AbortController().signal,
  reserveAttempt(retryIndex = 0) {
    if (inferenceGuard([decision], limits, []).reasons.length || decision.inferenceAttempts >= 1) return null;
    const identity = { expeditionId: accounting.expeditionId, decisionId: sourceDecision.id, attemptId: crypto.randomUUID() };
    accounting.attempts.push({ submission: { identity, submittedAtMs: Date.now(), retryIndex }, evidence: null });
    decision.inferenceAttempts++;
    return identity;
  }, reportAttempt(evidence: AttemptEvidence) { accounting.attempts[0]!.evidence = evidence; },
});
const result = { at: new Date().toISOString(), live, sourceFile, sourceDecision: sourceDecision.id, limits, diagnostic, outcome, usage: summarizeUsage([decision]), accounting };
if (live) {
  const output = `docs/evaluation/diagnostic-${accounting.expeditionId}.json`;
  const json = JSON.stringify(result, null, 2);
  if (json.includes(key)) throw new Error('Refusing credential-bearing output.');
  await Bun.write(output, json);
  console.info(JSON.stringify({ artifact: output, diagnostic, usage: result.usage }));
} else console.info(JSON.stringify(diagnostic));
if (typeof outcome !== 'string' && outcome.failure) {
  console.error(`Expected an applied choice; received ${outcome.failure}.`);
  process.exitCode = 1;
}
