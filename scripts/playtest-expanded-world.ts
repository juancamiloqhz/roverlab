import { authoredScenario } from '../src/simulation/scenario';
import { createExpedition } from '../src/simulation/expedition';
import type { ActionCandidate, ControllerInput, PlaybackSpeed } from '../src/simulation/types';

// A fixed compass survey exercises feasible trips. Sample selection uses only
// supplied candidates and inspected memory; this is not a baseline replacement.
export function chooseSurveyAction(input: ControllerInput, recharge = true): string {
  const wait = input.candidates.find(action => action.kind === 'wait')!;
  const home = input.candidates.find(action => action.kind === 'return-to-base');
  const charge = input.candidates.find(action => action.kind === 'recharge');
  if (charge && recharge) return charge.id;
  if (home && (input.cargo.length === input.cargoCapacity || recharge && input.battery <= home.routeEstimate.energy + 16
    || input.remainingMs <= home.routeEstimate.durationMs + 20_000)) return home.id;
  const samples = input.memory.filter(item => item.kind === 'sample');
  const delivered = samples.filter(sample => sample.status === 'delivered').length;
  const affordable = (action: ActionCandidate) => !('target' in action) || !recharge
    || action.routeEstimate.energy * 2 + (home?.routeEstimate.energy ?? 0) + 10 <= input.battery;
  const science = input.candidates.filter(action => action.kind === 'inspect' || action.kind === 'collect').filter(affordable)
    .filter(action => action.kind !== 'collect' || samples.some(sample => sample.sampleId === action.target.id && sample.properties))
    .sort((a, b) => a.routeEstimate.durationMs - b.routeEstimate.durationMs || (a.kind === 'inspect' ? -1 : 1));
  if (science[0]) return science[0].id;
  const frontiers = input.candidates.filter(action => action.kind === 'explore').filter(affordable);
  frontiers.sort((a, b) => {
    const pa = a.target.position, pb = b.target.position;
    return delivered < 2 ? pb.x - pa.x || Math.abs(pa.z - input.position.z) - Math.abs(pb.z - input.position.z)
      : delivered < 4 ? pa.x - pb.x || Math.abs(pa.z - input.position.z) - Math.abs(pb.z - input.position.z)
      : delivered < 8 ? pa.z - pb.z || Math.abs(pa.x - input.position.x) - Math.abs(pb.x - input.position.x)
      : pb.x - pa.x || pa.z - pb.z;
  });
  return frontiers[0]?.id ?? home?.id ?? wait.id;
}

export function runExpandedPlaytest({ speed = 1, recharge = true, baseline = false, stormAtMs }: {
  speed?: PlaybackSpeed; recharge?: boolean; baseline?: boolean; stormAtMs?: number;
} = {}) {
  const session = createExpedition({ controller: baseline ? undefined : { id: 'scripted', decide: input => chooseSurveyAction(input, recharge) } });
  session.dispatch({ type: 'set-speed', speed });
  session.dispatch({ type: 'start' });
  if (stormAtMs !== undefined) {
    session.advanceWallTime(stormAtMs / speed);
    session.dispatch({ type: 'introduce-storm' });
  }
  session.advanceWallTime(session.getSnapshot().remainingMs / speed);
  return session.getCompletedRecords()[0]!;
}

if (import.meta.main) {
  // This separate measurement scenario reveals terrain to measure route lengths.
  // It does not participate in any scored expedition below.
  const measurement = createExpedition({ scenario: { ...authoredScenario, sensorRange: 100 } });
  measurement.dispatch({ type: 'start' });
  console.log(JSON.stringify({ baseRoutes: measurement.getDecisions()[0]!.input.candidates
    .filter(action => action.kind === 'inspect').map(action => ({ sample: action.target.id, ...action.routeEstimate })) }));
  for (const options of [{}, { recharge: false }, { baseline: true }, { stormAtMs: 90_000 }]) {
    const start = performance.now();
    const record = runExpandedPlaytest(options);
    const result = record.results;
    console.log(JSON.stringify({ options, wallMs: Math.round(performance.now() - start),
      bytes: JSON.stringify(record).length, decisions: record.decisions.length,
      ending: result.endingCondition, elapsedSeconds: result.elapsedMs / 1_000,
      score: result.scienceScore, discovered: result.discoveryCount, inspected: result.inspectionCount,
      delivered: result.deliveredSamples.map(sample => [sample.sampleId, sample.deliveredAtMs / 1_000]),
      cargo: result.cargo.map(sample => sample.sampleId), energy: result.energyUsed, battery: result.battery,
    }));
  }
}
