import { expect, test } from 'bun:test';
import { createExpedition } from '../src/simulation/expedition';
import { authoredScenario } from '../src/simulation/scenario';
import type { Scenario } from '../src/simulation/types';

const corridor: Scenario = {
  id: 'science-corridor', name: 'Science corridor', width: 5, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [],
  samples: [{
    id: 'a', label: 'Sample A', position: { x: 2, z: 0 }, properties: ['Layered sediment'],
    classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' },
  }],
};

test('mission control selects an objective before starting and must reset to change it', () => {
  const expedition = createExpedition();
  expect(expedition.getSnapshot().objective).toBe('past-water');
  expedition.dispatch({ type: 'set-objective', objective: 'unusual-minerals' });
  expect(expedition.getSnapshot()).toMatchObject({
    objective: 'unusual-minerals', rubric: { unrelated: 0, suggestive: 5, 'strong-evidence': 10 },
    cargo: [], cargoCapacity: 2, scienceScore: 0, discoveryCount: 0, inspectionCount: 0,
  });
  expedition.dispatch({ type: 'start' });
  for (const command of ['pause', 'stop'] as const) {
    expedition.dispatch({ type: 'set-objective', objective: 'past-water' });
    expect(expedition.getSnapshot().objective).toBe('unusual-minerals');
    expedition.dispatch({ type: command });
  }
  expedition.dispatch({ type: 'set-objective', objective: 'past-water' });
  expect(expedition.getSnapshot().objective).toBe('unusual-minerals');
  expedition.dispatch({ type: 'reset' });
  expedition.dispatch({ type: 'set-objective', objective: 'past-water' });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'ready', elapsedMs: 0, objective: 'past-water' });
  const selections = expedition.getRecord().events.filter(event => event.type === 'objective-selected');
  expect(selections).toMatchObject([
    { expedition: 1, objective: 'unusual-minerals' }, { expedition: 2, objective: 'past-water' },
  ]);
  const detached = expedition.getSnapshot();
  detached.rubric['strong-evidence'] = 0;
  expect(expedition.getSnapshot().rubric['strong-evidence']).toBe(10);
});

test.each([
  ['past-water', [10, 0, 5]], ['unusual-minerals', [0, 10, 5]],
] as const)('two cargo slots require another trip and %s scores each authored classification once', (objective, scores) => {
  const expedition = createExpedition({ objective, scenario: {
    ...corridor, width: 6, sensorRange: 5, obstacles: [{ x: 4, z: 0 }],
    samples: [
      ...authoredScenario.samples.map((sample, index) => ({ ...sample, position: { x: index + 1, z: 0 } })),
      { ...corridor.samples[0]!, id: 'blocked', label: 'Blocked sample', position: { x: 4, z: 0 } },
    ],
  } });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(28_000);
  expect(expedition.getSnapshot()).toMatchObject({
    cargo: [{ sampleId: 'a' }, { sampleId: 'b' }], currentAction: { kind: 'return-to-base' },
    scienceScore: 0, discoveryCount: 4, inspectionCount: 2,
  });
  const fullDecision = expedition.getRecord().events.filter(event => event.type === 'decision-made').at(-1)!;
  expect(fullDecision.input.cargo).toHaveLength(2);
  expect(fullDecision.input.candidates.some(action => action.kind === 'collect')).toBe(false);
  expect(JSON.stringify(fullDecision.input)).not.toContain('classifications');
  expedition.advanceWallTime(8_000);
  expect(expedition.getSnapshot()).toMatchObject({ cargo: [], scienceScore: 10, currentAction: { kind: 'inspect', target: { id: 'c' } } });
  expedition.advanceWallTime(264_000);
  expect(expedition.getSnapshot()).toMatchObject({ cargo: [], scienceScore: 15, discoveryCount: 4, inspectionCount: 3 });
  expect(expedition.getSnapshot().deliveredSamples.map(sample => sample.score)).toEqual([...scores]);
  const decisions = expedition.getRecord().events.filter(event => event.type === 'decision-made');
  expect(decisions.flatMap(event => event.input.candidates).some(action => 'target' in action && action.target.id === 'blocked')).toBe(false);
  expect(expedition.getRecord().events.filter(event => event.type === 'samples-delivered')).toHaveLength(2);
  expedition.dispatch({ type: 'reset' });
  expect(expedition.getSnapshot()).toMatchObject({ objective, cargo: [], deliveredSamples: [], inspectionCount: 0, scienceScore: 0 });
  expect(expedition.getSnapshot().memory.filter(item => item.kind === 'sample').every(sample => sample.status === 'available' && !sample.properties)).toBe(true);
});

test('discovery leads to timed inspection, separate collection, and credit only after delivery', () => {
  const expedition = createExpedition({ scenario: corridor });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(13_000);
  expect(expedition.getSnapshot()).toMatchObject({
    rover: { position: { x: 2, z: 0 } }, currentAction: { kind: 'inspect' },
    discoveryCount: 1, inspectionCount: 0, cargo: [], scienceScore: 0,
  });
  expect(JSON.stringify(expedition.getRecord().events)).not.toContain('Layered sediment');
  expect(JSON.stringify(expedition.getRecord().events)).not.toContain('classifications');
  expedition.advanceWallTime(5_900);
  expect(expedition.getSnapshot().inspectionCount).toBe(0);
  expedition.dispatch({ type: 'pause' });
  const paused = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(paused);
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({ inspectionCount: 1, cargo: [], currentAction: { kind: 'collect' } });
  expect(expedition.getSnapshot().observations.find(item => item.kind === 'sample')).toMatchObject({
    properties: ['Layered sediment'], inspectedAtMs: 19_000, status: 'available',
  });
  expedition.advanceWallTime(3_900);
  expect(expedition.getSnapshot().cargo).toEqual([]);
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({
    cargo: [{ sampleId: 'a', label: 'Sample A' }], scienceScore: 0,
    currentAction: { kind: 'return-to-base' }, deliveredSamples: [],
  });
  expect(expedition.getSnapshot().observations.some(item => item.kind === 'sample')).toBe(false);
  expedition.advanceWallTime(7_900);
  expect(expedition.getSnapshot().scienceScore).toBe(0);
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot()).toMatchObject({
    rover: { position: { x: 0, z: 0 } }, cargo: [], scienceScore: 10,
    discoveryCount: 1, inspectionCount: 1,
    deliveredSamples: [{ sampleId: 'a', classification: 'strong-evidence', score: 10, deliveredAtMs: 31_000 }],
  });
  expedition.advanceWallTime(269_000);
  expect(expedition.getSnapshot().scienceScore).toBe(10);
  expect(expedition.getRecord().events.filter(event => event.type === 'sample-inspected')).toHaveLength(1);
  expect(expedition.getRecord().events.filter(event => event.type === 'sample-collected')).toHaveLength(1);
  expect(expedition.getRecord().events.filter(event => event.type === 'samples-delivered')).toHaveLength(1);
  const collectedDecisions = expedition.getRecord().events.filter(event => event.type === 'decision-made').filter(event => event.atMs >= 23_000);
  expect(collectedDecisions.flatMap(event => event.input.candidates).some(action => action.kind === 'inspect' || action.kind === 'collect')).toBe(false);
  expect(expedition.getSnapshot().memory.find(item => item.kind === 'sample')).toMatchObject({
    status: 'delivered', properties: ['Layered sediment'], inspectedAtMs: 19_000,
  });
});

test.each(['manual-stop', 'timeout'] as const)('%s leaves onboard cargo uncredited', ending => {
  const scenario = structuredClone(corridor);
  if (ending === 'timeout') {
    scenario.width = 23;
    scenario.sensorRange = 22;
    scenario.samples = [19, 20, 21].map((x, index) => ({ ...corridor.samples[0]!, id: String(index), position: { x, z: 0 } }));
  }
  const expedition = createExpedition({ scenario });
  expedition.dispatch({ type: 'start' });
  expedition.advanceWallTime(ending === 'timeout' ? 300_000 : 23_000);
  if (ending === 'manual-stop') expedition.dispatch({ type: 'stop' });
  expect(expedition.getSnapshot()).toMatchObject({
    status: 'ended', endingCondition: ending, cargo: [{ sampleId: ending === 'timeout' ? '2' : 'a' }],
    scienceScore: ending === 'timeout' ? 20 : 0,
    discoveryCount: ending === 'timeout' ? 3 : 1, inspectionCount: ending === 'timeout' ? 3 : 1,
  });
  expect(expedition.getSnapshot().deliveredSamples).toHaveLength(ending === 'timeout' ? 2 : 0);
  const ended = expedition.getSnapshot();
  expedition.advanceWallTime(300_000);
  expect(expedition.getSnapshot()).toEqual(ended);
});
