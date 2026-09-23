// Deliberate, single-expedition capture. Never imported by tests or browser code.
import { mkdir } from 'node:fs/promises';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createExpedition, createMatchedBaseline, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';

const limits = { providerAttempts: 250, estimatedCost: 0.10 };
const directory = Bun.argv[2];
const live = Bun.argv[3] === '--live';
const key = process.env.TYPESAFE_API_KEY?.trim();
if (!directory || !/^docs\/evaluation\/capture-[a-z0-9-]+$/.test(directory)) throw new Error('Supply a new docs/evaluation/capture-<name> directory.');
if (!key) throw new Error('Configure TYPESAFE_API_KEY on the server before capture.');
if (Object.keys(process.env).some(name => name.startsWith('VITE_') && /KEY|TOKEN|SECRET/.test(name))) throw new Error('Remove browser credential configuration before capture.');
console.info(JSON.stringify({ live, keyConfigured: true, benchmark: 'evidence-survey', limits,
  model: 'jev-latest', deadlineMs: 5000, automaticRetries: 1, stopOnFailureOrUnknownUsage: true }));
if (!live) process.exit(0);
await mkdir(directory, { recursive: false }); // Refuse overwriting any earlier evidence.
const handler = createDecisionHandler({ apiKey: key });
const controller = createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) });
const session = createExpedition({ benchmark: 'evidence-survey', controller });
session.dispatch({ type: 'set-inference-limits', limits });
if (JSON.stringify(session.getSnapshot().inferenceLimits) !== JSON.stringify(limits)) throw new Error('Capture limits were not applied.');
const startedAt = new Date().toISOString();
let stopReason: unknown = null;
let lastDecision = 0;
session.dispatch({ type: 'start' });
for (let steps = 0; steps < 200_000 && session.getSnapshot().status !== 'ended'; steps++) {
  const state = session.getSnapshot();
  if (state.decisionPending) { await Bun.sleep(10); continue; }
  if (state.decisionFailure || state.usagePause) {
    stopReason = { failure: state.decisionFailure, usagePause: state.usagePause };
    session.dispatch({ type: 'stop' });
    break;
  }
  if (state.decisionRevision !== lastDecision) {
    lastDecision = state.decisionRevision;
    console.info(JSON.stringify({ elapsedMs: state.elapsedMs, decisions: session.getDecisions().length,
      attempts: state.usage?.providerAttempts, estimatedCost: state.usage?.estimatedCost }));
  }
  session.advanceWallTime(5_000);
}
if (session.getSnapshot().status !== 'ended') { stopReason = 'Capture iteration limit'; session.dispatch({ type: 'stop' }); }
await session.refreshInferenceUsage(); // Existing evidence only, no new inference.
const source = session.getCompletedRecords()[0]!;
const writeRecord = async (name: string, value: typeof source) => {
  const json = exportExpeditionRecord(value);
  if (json.includes(key)) throw new Error('Credential found in export; refusing to write.');
  const record = importExpeditionRecord(json);
  await Bun.write(`${directory}/${name}.json`, json);
  createReplay(record); // Preserve evidence even if deterministic verification fails.
  return record;
};
const record = await writeRecord('jev', source);
const baseline = createMatchedBaseline(record);
baseline.dispatch({ type: 'start' });
while (baseline.getSnapshot().status !== 'ended') baseline.advanceWallTime(5_000);
const matched = await writeRecord('baseline', baseline.getCompletedRecords()[0]!);
await Bun.write(`${directory}/capture.json`, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(),
  limits, benchmark: 'evidence-survey', stopReason, sourceId: record.id, baselineId: matched.id,
  outcome: { jev: record.results.endingCondition, baseline: matched.results.endingCondition,
    jevScience: record.results.scienceScore, baselineScience: matched.results.scienceScore },
  usage: record.results.usage, inferenceLatencyMs: record.results.inferenceLatencyMs,
  selection: 'First capture, selected for teaching regardless of relative score. No discarded live runs.' }, null, 2));
console.info(JSON.stringify({ directory, ending: record.results.endingCondition, stopReason, usage: record.results.usage,
  jevScience: record.results.scienceScore, baselineScience: matched.results.scienceScore }));
