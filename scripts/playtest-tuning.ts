import { createExpedition } from '../src/simulation/expedition';
import { firstPlayableScenario as authoredScenario } from '../tests/fixtures/first-playable-scenario';
import type { ActionCandidate, ControllerInput, ExpeditionRecord, Scenario, ScientificObjective } from '../src/simulation/types';

type Strategy = 'baseline' | 'survey' | 'no-recharge' | 'wait-for-storm' | 'detour';

// A repeatable compass survey, not a scientific model: deliver the first sample,
// then survey east and north with two cargo slots. Select only offered candidates;
// no world catalog, hidden properties, or hidden routes enter this controller.
function survey(input: ControllerInput, strategy: Strategy, delayMs: number): string {
  const wait = input.candidates.find(action => action.kind === 'wait')!;
  if (input.atMs < delayMs) return wait.id;
  const recharge = input.candidates.find(action => action.kind === 'recharge');
  if (recharge && strategy !== 'no-recharge') return recharge.id;
  const samples = input.memory.filter(item => item.kind === 'sample');
  const returnToBase = input.candidates.find(action => action.kind === 'return-to-base');
  const firstTrip = !samples.some(sample => sample.status === 'delivered');
  let selected: ActionCandidate | undefined = returnToBase && (input.cargo.length === input.cargoCapacity || firstTrip && input.cargo.length > 0)
    ? returnToBase : undefined;
  selected ??= input.candidates.filter(action => action.kind === 'inspect' || action.kind === 'collect')
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs || (a.kind === 'inspect' ? -1 : 1))[0];
  if (!selected && samples.filter(sample => sample.status === 'delivered').length === 3) return wait.id;
  const north = input.cargo.length > 0;
  selected ??= input.candidates.filter(action => action.kind === 'explore').sort((a, b) => north
    ? a.target.position.z - b.target.position.z || Math.abs(a.target.position.x - input.position.x) - Math.abs(b.target.position.x - input.position.x)
    : b.target.position.x - a.target.position.x || Math.abs(a.target.position.z - input.position.z) - Math.abs(b.target.position.z - input.position.z))[0];
  if (selected && 'target' in selected && (selected.routeEstimate.stormDistanceCells ?? 0) > 0) {
    if (strategy === 'wait-for-storm') return wait.id;
    if (strategy === 'detour') {
      const target = selected;
      selected = input.candidates.find(action => 'target' in action && action.kind === target.kind
        && action.target.id === target.target.id && action.routeMode === 'avoid-storm') ?? target;
    }
  }
  return selected?.id ?? wait.id;
}

export function runPlaytest({ strategy = 'survey', scenario = authoredScenario, objective = 'past-water', stormAtMs, delayMs = 0 }: {
  strategy?: Strategy; scenario?: Scenario; objective?: ScientificObjective; stormAtMs?: number; delayMs?: number;
} = {}): ExpeditionRecord {
  const session = createExpedition({ scenario, objective,
    controller: strategy === 'baseline' ? undefined : { id: 'scripted', decide: input => survey(input, strategy, delayMs) },
  });
  session.dispatch({ type: 'start' });
  if (stormAtMs !== undefined) {
    session.advanceWallTime(stormAtMs);
    session.dispatch({ type: 'introduce-storm' });
  }
  session.advanceWallTime(300_000);
  return session.getCompletedRecords()[0]!;
}

// A fully observed route isolates crossing, detouring, and waiting at the authored
// storm's duration/strength. This is a test scenario, not extra rover knowledge in
// Ochre Basin. The destination is outside the storm so a detour can exist.
export function runStormRoutePlaytest(strategy: 'survey' | 'wait-for-storm' | 'detour') {
  const scenario: Scenario = {
    id: 'storm-route-playtest', name: 'Storm route playtest', width: 15, depth: 13,
    base: { x: 0, z: 6 }, sensorRange: 20, obstacles: [], roughTerrain: [],
    samples: [{ ...structuredClone(authoredScenario.samples[0]!), position: { x: 14, z: 6 } }],
    dustStorm: { ...authoredScenario.dustStorm!, position: { x: 7, z: 6 } },
  };
  const session = createExpedition({ scenario, controller: { id: 'scripted', decide(input) {
    const sample = input.memory.find(item => item.kind === 'sample');
    const kind = input.cargo.length ? 'return-to-base' : sample?.kind === 'sample' && sample.status === 'delivered'
      ? 'wait' : sample?.kind === 'sample' && sample.properties ? 'collect' : 'inspect';
    const selected = input.candidates.find(action => action.kind === kind)!;
    if ('target' in selected && (selected.routeEstimate.stormDistanceCells ?? 0) > 0) {
      if (strategy === 'wait-for-storm') return input.candidates.find(action => action.kind === 'wait')!.id;
      if (strategy === 'detour') return input.candidates.find(action => action.kind === kind && 'routeMode' in action && action.routeMode === 'avoid-storm')?.id ?? selected.id;
    }
    return selected.id;
  } } });
  session.dispatch({ type: 'introduce-storm' });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(300_000);
  return session.getCompletedRecords()[0]!;
}

function report(label: string, record: ExpeditionRecord) {
  const result = record.results;
  console.log(JSON.stringify({ label, ending: result.endingCondition, elapsedSeconds: result.elapsedMs / 1_000,
    score: result.scienceScore, discovered: result.discoveryCount, inspected: result.inspectionCount,
    delivered: result.deliveredSamples.map(sample => [sample.sampleId, sample.deliveredAtMs / 1_000]),
    cargo: result.cargo.map(sample => sample.sampleId), energy: Number(result.energyUsed.toFixed(3)), battery: Number(result.battery.toFixed(3)),
  }));
}

if (import.meta.main) {
  for (const objective of ['past-water', 'unusual-minerals'] as const) {
    for (const strategy of ['baseline', 'survey', 'no-recharge', 'wait-for-storm', 'detour'] as const) {
      const stormAtMs = ['wait-for-storm', 'detour'].includes(strategy) ? 90_000 : undefined;
      report(`${objective}: ${strategy}`, runPlaytest({ objective, strategy, stormAtMs }));
    }
  }
  report('survey: storm crossing at 90s', runPlaytest({ stormAtMs: 90_000 }));
  report('survey: 50s initial delay', runPlaytest({ delayMs: 50_000 }));
  for (const strategy of ['survey', 'wait-for-storm', 'detour'] as const) report(`known storm route: ${strategy}`, runStormRoutePlaytest(strategy));
  if (Bun.argv.includes('--sweep')) {
    for (const z of [4, 5, 6]) for (const durationMs of [30_000, 45_000, 60_000]) {
      const scenario = structuredClone(authoredScenario);
      scenario.samples[2]!.position.z = z;
      scenario.dustStorm!.durationMs = durationMs;
      report(`wait: Sample C z=${z}, storm=${durationMs / 1_000}s`, runPlaytest({ scenario, strategy: 'wait-for-storm', stormAtMs: 90_000 }));
    }
    for (const movementEnergyMultiplier of [2, 3, 4]) {
      const scenario = structuredClone(authoredScenario);
      scenario.dustStorm!.movementEnergyMultiplier = movementEnergyMultiplier;
      report(`crossing: storm energy ×${movementEnergyMultiplier}`, runPlaytest({ scenario, stormAtMs: 90_000 }));
    }
  }
}
