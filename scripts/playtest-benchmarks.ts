import { createExpedition } from '../src/simulation/expedition';
import { benchmarkIds, type BenchmarkId } from '../src/simulation/benchmarks';
import { chooseSurveyAction } from './playtest-expanded-world';
import { chooseBaselineAction } from '../src/controllers/baseline';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { createDecisionHandler } from '../server/decisions';
import type { ControllerInput, ExpeditionRecord } from '../src/simulation/types';
import type { MissionPresetId } from '../shared/mission';

export type Strategy = 'baseline' | 'survey' | 'no-recharge';
function measureBenchmark(record: ExpeditionRecord) {
  const result = record.results;
  return {
    benchmark: result.benchmark!.id,
    decisions: record.decisions.length, providerAttempts: result.usage!.providerAttempts,
    coalescedDecisions: record.decisions.filter(decision => (decision.input.decisionBoundary?.triggers.length ?? 0) > 1).length,
    terrainCells: result.memory.filter(item => item.kind === 'terrain').length,
    ending: result.endingCondition, elapsedSeconds: result.elapsedMs / 1_000,
    score: result.scienceScore, discovered: result.discoveryCount, inspected: result.inspectionCount,
    delivered: result.deliveredSamples.map(sample => [sample.sampleId, sample.deliveredAtMs / 1_000]),
    cargo: result.cargo.map(sample => sample.sampleId), energy: result.energyUsed, battery: result.battery,
    position: result.rover.position,
    missions: result.mission!.history.map(entry => ({ requested: entry.requestedAtMs, applied: entry.appliedAtMs,
      preset: entry.preferences.mode === 'preset' ? entry.preferences.preset.id : 'free-text' })),
    storms: record.events.filter(event => event.type === 'storm-introduced' || event.type === 'storm-detected' || event.type === 'storm-expired'),
  };
}

export async function runBenchmarkPlaytest(benchmark: BenchmarkId, strategy: Strategy = 'baseline', preset?: MissionPresetId, provider = false) {
  const choose = (input: ControllerInput) => strategy === 'baseline' ? chooseBaselineAction(input).id : chooseSurveyAction(input, strategy !== 'no-recharge');
  const handler = createDecisionHandler({ apiKey: 'benchmark-scripted-provider', fetch: async (_url, init) => {
    const input: ControllerInput = JSON.parse(init!.body as string).state;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 },
      answers: { action: { type: 'choice', choice: choose(input), confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map(action => [action.id, 1 / input.candidates.length])) } } });
  } });
  const session = createExpedition({ benchmark, wallNow: () => 0,
    controller: provider ? createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) })
      : strategy === 'baseline' ? undefined : { id: 'scripted', decide: choose },
  });
  if (preset) session.dispatch({ type: 'set-mission-preset', preset });
  session.dispatch({ type: 'start' });
  for (let turn = 0; turn < 10_000 && session.getSnapshot().status !== 'ended'; turn++) {
    if (session.getSnapshot().decisionPending) await Bun.sleep(0);
    else session.advanceWallTime(5_000);
    if (session.getSnapshot().decisionFailure || session.getSnapshot().usagePause) throw new Error('Benchmark paused at an inference guard.');
  }
  const record = session.getCompletedRecords()[0];
  if (!record) throw new Error('Benchmark did not complete.');
  return record;
}

if (import.meta.main) {
  const provider = Bun.argv.includes('--provider');
  for (const benchmark of benchmarkIds) for (const preset of ['balanced', 'conserve-energy', 'explore-more'] as const) {
    for (const strategy of ['baseline', 'survey'] as const) {
      const record = await runBenchmarkPlaytest(benchmark, strategy, preset, provider);
      console.log(JSON.stringify({ strategy, startingPreset: preset, scriptedProvider: provider, ...measureBenchmark(record) }));
    }
  }
  for (const benchmark of benchmarkIds) {
    const record = await runBenchmarkPlaytest(benchmark, 'no-recharge', undefined, provider);
    console.log(JSON.stringify({ strategy: 'no-recharge', scriptedProvider: provider, ...measureBenchmark(record) }));
  }
}
