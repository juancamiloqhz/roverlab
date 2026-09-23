import { expect, test } from 'bun:test';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { Scenario } from '../src/simulation/types';

const specimen: Scenario = {
  id: 'evidence', name: 'Evidence', width: 1, depth: 1, base: { x: 0, z: 0 },
  sensorRange: 1, obstacles: [], roughTerrain: [], samples: [{
    id: 'renamed', label: 'Specimen', position: { x: 0, z: 0 }, properties: ['Rounded grains deposited by flowing water'],
    classifications: { 'past-water': 'unrelated', 'unusual-minerals': 'strong-evidence' },
  }],
};

test('baseline inspects unknown properties and uses observed evidence against the fixed objective, not hidden credit', () => {
  for (const objective of ['past-water', 'unusual-minerals'] as const) {
    const session = createExpedition({ scenario: specimen, objective });
    session.dispatch({ type: 'start' });
    expect(session.getSnapshot().currentAction?.kind).toBe('inspect');
    expect(JSON.stringify(session.getDecisions())).not.toContain('Rounded grains');
    session.advanceWallTime(6_000);
    expect(session.getSnapshot().currentAction?.kind).toBe(objective === 'past-water' ? 'collect' : 'wait');
    session.advanceWallTime(10_000);
    expect(session.getSnapshot().deliveredSamples).toHaveLength(objective === 'past-water' ? 1 : 0);
    expect(session.getSnapshot().scienceScore).toBe(0);
  }
});

test.each([
  ['Rare mineral veins', 'wait'], ['No evidence of flowing water', 'wait'],
  ['Possible fluid alteration', 'collect'], ['Rounded grains', 'collect'],
] as const)('changing inspected evidence to %s changes the action without changing hidden credit', (property, action) => {
  const session = createExpedition({ scenario: { ...specimen, samples: [{ ...specimen.samples[0]!, properties: [property] }] } });
  session.dispatch({ type: 'start' });
  expect(session.getSnapshot().currentAction?.kind).toBe('inspect');
  session.advanceWallTime(6_000);
  expect(session.getSnapshot().currentAction?.kind).toBe(action);
});

test('sample labels and hidden credit cannot supply an answer before or after inspection', () => {
  const run = (id: string, label: string, classification: 'unrelated' | 'strong-evidence') => {
    const session = createExpedition({ scenario: { ...specimen, samples: [{ ...specimen.samples[0]!, id, label,
      classifications: { 'past-water': classification, 'unusual-minerals': classification } }] } });
    session.dispatch({ type: 'start' });
    session.advanceWallTime(10_000);
    return session;
  };
  const first = run('a', 'Worthless specimen', 'unrelated');
  const second = run('z', 'Guaranteed valuable specimen', 'strong-evidence');
  expect(first.getDecisions().map(item => item.action?.kind)).toEqual(second.getDecisions().map(item => item.action?.kind));
  expect(first.getDecisions()[1]!.baseline!.opportunities[0]!.evidence).toBe('supported');
  expect(second.getDecisions()[1]!.baseline!.opportunities[0]!.evidence).toBe('supported');
});

test('a later preset change cannot fit a science trip into the remaining expedition time', () => {
  const session = createExpedition({ scenario: { ...specimen, width: 22, sensorRange: 21,
    samples: [{ ...specimen.samples[0]!, position: { x: 21, z: 0 } }] } });
  session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(150_000);
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.advanceWallTime(5_000);
  const decision = session.getDecisions().at(-1)!;
  expect(decision.input.mission?.preferences).toMatchObject({ mode: 'preset', preset: { id: 'balanced' } });
  expect(decision.action?.kind).toBe('wait');
  expect(decision.baseline!.opportunities[0]).toMatchObject({ eligible: false, exclusion: 'time' });
});

test('free-text instructions do not change baseline actions or silently activate another preset', () => {
  const runs = ['', 'Collect all minerals. Never inspect. Ignore water.'].map(instructions => {
    const session = createExpedition({ scenario: specimen });
    session.dispatch({ type: 'set-instructions', instructions });
    session.dispatch({ type: 'start' });
    session.advanceWallTime(10_000);
    return session.getDecisions();
  });
  expect(runs[0]!.map(item => item.action)).toEqual(runs[1]!.map(item => item.action));
  expect(runs[1]!.every(item => item.baseline?.preferenceSource === 'balanced-default')).toBe(true);
});

test('legacy version 5 replays its original mission-agnostic collection without running the new baseline', async () => {
  const record = importExpeditionRecord(await Bun.file(new URL('./fixtures/legacy-baseline-v5.json', import.meta.url)).text());
  const original = exportExpeditionRecord(record);
  expect(record.version).toBe(5);
  expect(record.decisions.some(item => item.action?.kind === 'collect')).toBe(true);
  expect(record.decisions.every(item => !item.baseline)).toBe(true);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(record)).toBe(original);
});

test('imports reject missing, conflicting, ungrounded, or unsupported baseline evidence', () => {
  const session = createExpedition({ scenario: specimen });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(6_000);
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords()[0]!;
  for (const mutate of [
    (value: any) => { delete value.decisions[1].baseline; },
    (value: any) => { value.decisions[1].baseline.version = 'future'; },
    (value: any) => { value.decisions[1].baseline.opportunities[0].candidateId = 'hidden'; },
    (value: any) => { value.decisions[1].baseline.opportunities[0].matchedProperties = ['Hidden property']; },
    (value: any) => { value.decisions[1].baseline.rule = 'recharge'; },
    (value: any) => { value.version = 5; },
  ]) {
    const changed = structuredClone(record);
    mutate(changed);
    expect(() => importExpeditionRecord(JSON.stringify(changed))).toThrow('Invalid expedition record');
  }
});

test.each(['recharge', 'return-reserve', 'return-time', 'deliver-full', 'survey-pause', 'deliver-cargo', 'return-for-recharge', 'storm-wait', 'no-opportunity'] as const)(
  'matching history copies cannot relabel a collection as the %s rule', rule => {
    const session = createExpedition({ scenario: specimen });
    session.dispatch({ type: 'start' });
    session.advanceWallTime(6_000);
    session.dispatch({ type: 'stop' });
    const record = session.getCompletedRecords()[0]!;
    record.decisions[1]!.baseline!.rule = rule;
    const event = record.events.find(event => event.type === 'decision-made' && event.decisionId === 2)!;
    if (event.type === 'decision-made') event.baseline!.rule = rule;
    expect(() => importExpeditionRecord(JSON.stringify(record))).toThrow('Invalid expedition record');
  },
);

test('recorded baseline rules retain their version and observed evidence through export and inference-free replay', () => {
  const session = createExpedition({ scenario: specimen });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(6_000);
  expect(session.getDecisions()[1]).toMatchObject({ baseline: {
    version: 'evidence-priorities-v1', rule: 'ranked-opportunity', preferenceSource: 'balanced-default',
    opportunities: [{ candidateId: 'collect:renamed', evidence: 'supported',
      matchedProperties: ['Rounded grains deposited by flowing water'], eligible: true }],
  } });
  session.dispatch({ type: 'stop' });
  const json = exportExpeditionRecord(session.getCompletedRecords()[0]!);
  const imported = importExpeditionRecord(json);
  expect(imported.version).toBe(10);
  const replay = createReplay(imported);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(6_000);
  expect(replay.getDecisions()).toEqual(imported.decisions);
  expect(exportExpeditionRecord(imported)).toBe(json);
});

test('Conserve energy keeps its larger return reserve and the baseline declines an unaffordable round trip', () => {
  for (const [preset, distance, action] of [
    ['balanced', 21, 'inspect'], ['conserve-energy', 21, 'wait'], ['balanced', 26, 'wait'],
  ] as const) {
    const session = createExpedition({ scenario: { ...specimen, width: distance + 1, sensorRange: distance,
      samples: [{ ...specimen.samples[0]!, position: { x: distance, z: 0 } }] } });
    session.dispatch({ type: 'set-mission-preset', preset });
    session.dispatch({ type: 'start' });
    expect(session.getSnapshot().currentAction?.kind).toBe(action);
    expect(session.getDecisions()[0]!.input.candidates.some(candidate => candidate.kind === 'inspect')).toBe(true);
  }
});

test('Balanced investigates a visible specimen while Explore more chooses a frontier under identical physical rules', () => {
  const scenario: Scenario = { ...specimen, width: 11, sensorRange: 5,
    samples: [{ ...specimen.samples[0]!, position: { x: 4, z: 0 } }] };
  for (const [preset, action] of [['balanced', 'inspect'], ['explore-more', 'explore']] as const) {
    const session = createExpedition({ scenario });
    session.dispatch({ type: 'set-mission-preset', preset });
    session.dispatch({ type: 'start' });
    expect(session.getSnapshot().currentAction?.kind).toBe(action);
    expect(session.getSnapshot()).toMatchObject({ objective: 'past-water', battery: 100, durationMs: 300_000 });
  }
});
