import { expect, test } from 'bun:test';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { ControllerInput, Scenario } from '../src/simulation/types';

const scenario: Scenario = { id: 'comparison', name: 'Decision comparison', width: 5, depth: 3,
  base: { x: 0, z: 1 }, sensorRange: 3, obstacles: [], roughTerrain: [], samples: [
    { id: 'nearby', label: 'Nearby sample', position: { x: 1, z: 1 }, properties: ['Rounded grains'],
      classifications: { 'past-water': 'strong-evidence', 'unusual-minerals': 'unrelated' } },
  ] };
const response = (input: ControllerInput, choice: string) => Response.json({ model: 'jev-1.13.0',
  usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: { type: 'choice', choice, confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(item => [item.id, 1 / input.candidates.length])),
  } } });

test('a pending Jev decision records the baseline from its exact input without another dispatch or execution', async () => {
  let calls = 0;
  let supplied!: ControllerInput;
  let release!: (response: Response) => void;
  let received!: () => void;
  const requestReceived = new Promise<void>(resolve => { received = resolve; });
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    calls++;
    supplied = JSON.parse(init!.body as string).state as ControllerInput;
    received();
    return new Promise<Response>(resolve => { release = resolve; });
  } });
  const expedition = createExpedition({ scenario, controller: createTypeSafeController({
    fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)),
  }) });
  const settled = new Promise<void>(resolve => expedition.onDecisionSettled(resolve));
  expedition.dispatch({ type: 'start' });
  await requestReceived;
  const pending = expedition.getDecisions()[0]!;
  expect(pending).toMatchObject({ status: 'pending', baselineAlternative: {
    action: { id: 'inspect:nearby', kind: 'inspect', target: { id: 'nearby', position: { x: 1, z: 1 } } },
    evidence: { version: 'evidence-priorities-v1', rule: 'ranked-opportunity', preferenceSource: 'balanced-default' },
  } });
  expect(pending.input).toEqual(supplied);
  expect(pending.action).toBeUndefined();
  expect(pending.input.memory.find(item => item.kind === 'sample')).not.toHaveProperty('properties');
  const frozen = expedition.getSnapshot();
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot()).toEqual(frozen);
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(0);
  release(response(supplied, 'wait:5000'));
  await settled;
  expect(expedition.getDecisions()[0]!.input).toEqual(supplied);
  expect(expedition.getSnapshot()).toMatchObject({ elapsedMs: 0, battery: 100, currentAction: { kind: 'wait' }, controller: 'typesafe' });
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(1);
  expect(calls).toBe(1);
  expedition.advanceWallTime(1000);
  expedition.dispatch({ type: 'stop' });
  const source = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
  const replay = createReplay(source);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1000);
  expect(replay.getSnapshot()).toEqual(source.results);
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(calls).toBe(1);
});

test('imports reject changed targets, rules, ownership, omitted alternatives and changes between request and settlement', async () => {
  let finish!: () => void;
  const expedition = createExpedition({ scenario, controller: { id: 'typesafe', decide: () => new Promise(resolve => {
    finish = () => resolve({ failure: 'invalid-output' });
  }) } });
  expedition.dispatch({ type: 'start' });
  finish();
  await Promise.resolve();
  expedition.dispatch({ type: 'stop' });
  const original = exportExpeditionRecord(expedition.getCompletedRecords()[0]!);
  for (const corrupt of ['target', 'route', 'rule', 'missing', 'ownership', 'settlement'] as const) {
    const record = importExpeditionRecord(original);
    const copies = [...record.decisions, ...record.events.flatMap(event =>
      event.type === 'decision-requested' || event.type === 'decision-settled' ? [event.decision] : [])];
    for (const decision of copies) {
      const alternative = decision.baselineAlternative!;
      if (corrupt === 'missing') delete decision.baselineAlternative;
      else if (corrupt === 'ownership') decision.controller = 'baseline';
      else if (corrupt === 'rule' || (corrupt === 'settlement' && decision.status !== 'pending')) alternative.evidence.rule = 'recharge';
      else if (corrupt === 'target' && 'target' in alternative.action) alternative.action.target.position.x = 4;
      else if (corrupt === 'route' && 'target' in alternative.action) alternative.action.routeMode = 'avoid-storm';
    }
    expect(() => importExpeditionRecord(JSON.stringify(record)), corrupt).toThrow('Invalid expedition record');
  }
});

function scriptedJev(input: ControllerInput, choice = 'wait:5000') {
  return { selectedCandidateId: choice, confidence: 0,
    probabilities: Object.fromEntries(input.candidates.map(item => [item.id, 1 / input.candidates.length])) };
}

test('agreement and disagreement preserve Jev execution, shared priorities and detached input through teaching and replay', () => {
  for (const choice of ['inspect:nearby', 'wait:5000']) {
    const jev = createExpedition({ scenario, controller: { id: 'typesafe', decide(input) {
      const result = scriptedJev(input, choice);
      // A controller cannot change either the saved evidence or the comparison.
      input.candidates.reverse();
      input.position.x = 4;
      input.memory.length = 0;
      return result;
    } } });
    const control = createExpedition({ scenario, controller: { id: 'scripted', decide: () => choice } });
    for (const session of [jev, control]) {
      session.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
      session.dispatch({ type: 'set-teaching-mode', enabled: true });
      session.dispatch({ type: 'start' });
    }
    const decision = jev.getDecisions()[0]!;
    expect(decision.baselineAlternative).toMatchObject({ action: { id: 'inspect:nearby' }, evidence: { preferenceSource: 'shared-preset' } });
    expect(decision.input).toEqual(control.getDecisions()[0]!.input);
    expect(decision.action).toEqual(decision.input.candidates.find(item => item.id === choice));
    expect(jev.getSnapshot()).toMatchObject({ elapsedMs: 0, currentAction: null, heldDecisionId: 1 });
    const alternative = structuredClone(decision.baselineAlternative);
    decision.baselineAlternative!.action.id = 'mutated public read';
    expect(jev.getDecisions()[0]!.baselineAlternative).toEqual(alternative);
    for (const session of [jev, control]) {
      session.dispatch({ type: 'continue-choice' });
      session.dispatch({ type: 'continue-choice' });
      session.advanceWallTime(1000);
      session.dispatch({ type: 'stop' });
    }
    for (const field of ['elapsedMs', 'battery', 'energyUsed', 'rover', 'cargo', 'scienceScore', 'observations', 'memory'] as const) {
      expect(jev.getSnapshot()[field]).toEqual(control.getSnapshot()[field]);
    }
    expect(jev.getRecord().events.filter(item => item.type === 'action-started')).toHaveLength(1);
    const original = exportExpeditionRecord(jev.getCompletedRecords()[0]!);
    const replay = createReplay(importExpeditionRecord(original));
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(1000);
    expect(replay.getDecisions()[0]!.baselineAlternative).toEqual(alternative);
    expect(exportExpeditionRecord(jev.getCompletedRecords()[0]!)).toBe(original);
  }
});

test('choices for the same target retain distinct crossing and detour routes', () => {
  const routeScenario: Scenario = { ...scenario, width: 5, sensorRange: 8,
    samples: scenario.samples.map(sample => ({ ...sample, position: { x: 4, z: 1 } })),
    dustStorm: { position: { x: 2, z: 1 }, radius: 0.5, durationMs: 90_000, sensorRange: 0.5, movementEnergyMultiplier: 5 } };
  const expedition = createExpedition({ scenario: routeScenario, controller: { id: 'typesafe', decide: input => scriptedJev(input, 'inspect:nearby') } });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  const decision = expedition.getDecisions()[0]!;
  expect(decision.action).toMatchObject({ kind: 'inspect', target: { id: 'nearby' }, routeEstimate: { energy: 16, distanceCells: 4 } });
  expect(decision.baselineAlternative).toMatchObject({ action: { id: 'inspect:nearby:avoid-storm', kind: 'inspect', target: { id: 'nearby' },
    routeMode: 'avoid-storm', routeEstimate: { energy: 12, distanceCells: 6 } } });
  expedition.advanceWallTime(4000);
  expect(expedition.getSnapshot().energyUsed).toBe(2);
  expedition.dispatch({ type: 'stop' });
  const source = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
  const replay = createReplay(source);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(4000);
  expect(replay.getDecisions()).toEqual(source.decisions);
});

test('waiting and recharge alternatives retain durations and the original rover or base location', () => {
  const waiting = createExpedition({ scenario: { ...scenario, width: 1, depth: 1, base: { x: 0, z: 0 }, samples: [] },
    controller: { id: 'typesafe', decide: input => scriptedJev(input) } });
  waiting.dispatch({ type: 'start' });
  expect(waiting.getDecisions()[0]!).toMatchObject({ action: { kind: 'wait', durationMs: 5000 },
    baselineAlternative: { action: { kind: 'wait', durationMs: 5000 }, evidence: { rule: 'no-opportunity' } } });
  const recharge = createExpedition({ scenario: { ...scenario, width: 5, sensorRange: 8,
    samples: scenario.samples.map(sample => ({ ...sample, position: { x: 4, z: 1 } })) }, controller: { id: 'typesafe', decide(input) {
    const choice = input.candidates.find(item => item.kind === 'recharge')
      ?? input.candidates.find(item => item.kind === (input.memory.some(item => item.kind === 'sample' && item.properties) ? 'return-to-base' : 'inspect'));
    return scriptedJev(input, choice?.id);
  } } });
  recharge.dispatch({ type: 'set-teaching-mode', enabled: true });
  recharge.dispatch({ type: 'start' });
  for (let step = 0; step < 10 && !recharge.getDecisions().some(item => item.action?.kind === 'recharge'); step++) {
    recharge.dispatch({ type: 'continue-choice' });
    recharge.advanceWallTime(60_000);
  }
  const decision = recharge.getDecisions().find(item => item.action?.kind === 'recharge')!;
  expect(decision).toBeDefined();
  expect(decision.baselineAlternative).toMatchObject({ action: { kind: 'recharge', durationMs: 3200 }, evidence: { rule: 'recharge' } });
  expect(decision.input.position).toEqual({ x: 0, z: 1 });
  expect(decision.input.memory.find(item => item.kind === 'base')!.position).toEqual(decision.input.position);
});

test.each(['failed', 'discarded'] as const)('%s Jev results keep alternatives without executing them or changing the controller', async status => {
  let finish!: () => void;
  const expedition = createExpedition({ scenario, controller: { id: 'typesafe', decide: input => new Promise(resolve => {
    finish = () => resolve(status === 'failed' ? { failure: 'unavailable' } : scriptedJev(input));
  }) } });
  expedition.dispatch({ type: 'start' });
  if (status === 'discarded') expedition.dispatch({ type: 'stop' });
  finish();
  await Promise.resolve();
  expect(expedition.getDecisions()[0]!).toMatchObject({ status, baselineAlternative: { action: { id: 'inspect:nearby' } } });
  expect(expedition.getDecisions()[0]!.action).toBeUndefined();
  expect(expedition.getSnapshot()).toMatchObject({ elapsedMs: 0, battery: 100, currentAction: null, controller: 'typesafe' });
  expect(expedition.getRecord().events.filter(item => item.type === 'action-started')).toHaveLength(0);
  if (status === 'failed') expedition.dispatch({ type: 'stop' });
  const source = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
  const replay = createReplay(source);
  replay.dispatch({ type: 'start' });
  expect(replay.getDecisions()).toEqual(source.decisions);
});

test('version 9 Jev history stays unchanged and replay never invents an alternative', async () => {
  const source = importExpeditionRecord(await Bun.file(new URL('./fixtures/legacy-comparison-v9.json', import.meta.url)).text());
  const original = exportExpeditionRecord(source);
  const replay = createReplay(source);
  replay.dispatch({ type: 'start' });
  replay.dispatch({ type: 'inspect-decision', decisionId: 1 });
  expect(replay.getDecisions()[0]!.baselineAlternative).toBeUndefined();
  replay.dispatch({ type: 'end-inspection' });
  replay.dispatch({ type: 'resume' });
  replay.advanceWallTime(1000);
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(replay.getSnapshot()).toEqual(source.results);
  expect(exportExpeditionRecord(source)).toBe(original);
});
