import { readProviderInput } from './fixtures/provider-input';
import { expect, test } from 'bun:test';
import { createExpedition, createReplay } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { ControllerInput } from '../src/simulation/types';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';

test('teaching holds a completed choice before execution and discards paused wall time at every speed', () => {
  const expedition = createExpedition();
  expedition.dispatch({ type: 'set-teaching-mode', enabled: true });
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', heldDecisionId: 1, currentAction: null, elapsedMs: 0 });
  expect(expedition.getRecord().events.some(event => event.type === 'action-started')).toBe(false);
  for (const speed of [1, 2, 4] as const) {
    expedition.dispatch({ type: 'set-speed', speed });
    const frozen = expedition.getSnapshot();
    const world = expedition.getFullWorldView();
    expedition.advanceWallTime(600_000);
    expect(expedition.getSnapshot()).toEqual(frozen);
    expect(expedition.getFullWorldView()).toEqual(world);
  }
  expedition.dispatch({ type: 'continue-choice' });
  expedition.dispatch({ type: 'continue-choice' });
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(1);
  expedition.advanceWallTime(25);
  expect(expedition.getSnapshot().elapsedMs).toBe(100);
  expedition.advanceWallTime(600_000);
  expect(expedition.getSnapshot().status).toBe('paused');
  const next = expedition.getSnapshot();
  expedition.advanceWallTime(600_000);
  expect(expedition.getSnapshot()).toEqual(next);
});

test('selecting history freezes an executing expedition and preserves its recorded knowledge and completed export', () => {
  const expedition = createExpedition();
  expedition.dispatch({ type: 'introduce-storm' });
  expedition.dispatch({ type: 'start' });
  const original = expedition.getDecisions()[0]!;
  expedition.advanceWallTime(30_000);
  expedition.dispatch({ type: 'inspect-decision', decisionId: original.id });
  expedition.dispatch({ type: 'set-speed', speed: 4 });
  const frozen = expedition.getSnapshot();
  const world = expedition.getFullWorldView();
  expedition.advanceWallTime(600_000);
  expedition.dispatch({ type: 'resume' });
  expect(expedition.getSnapshot()).toEqual(frozen);
  expect(expedition.getFullWorldView()).toEqual(world);
  expect(expedition.getDecisions()[0]).toEqual(original);
  expedition.dispatch({ type: 'end-inspection' });
  expedition.dispatch({ type: 'resume' });
  expedition.advanceWallTime(25);
  expect(expedition.getSnapshot().elapsedMs).toBe(frozen.elapsedMs + 100);
  expedition.dispatch({ type: 'stop' });
  const exported = exportExpeditionRecord(expedition.getCompletedRecords()[0]!);
  expedition.dispatch({ type: 'inspect-decision', decisionId: 1 });
  expect(expedition.getSnapshot().inspectionDecisionId).toBe(1);
  expect(exportExpeditionRecord(expedition.getCompletedRecords()[0]!)).toBe(exported);
  expedition.dispatch({ type: 'end-inspection' });
  expect(expedition.getSnapshot().inspectionDecisionId).toBeNull();
});

test.each(['set-instructions', 'set-mission-preset', 'introduce-storm', 'reset', 'stop'] as const)('%s cannot execute a held obsolete choice', command => {
  const expedition = createExpedition({ scenario: { id: 'held', name: 'Held choice', width: 8, depth: 1,
    base: { x: 0, z: 0 }, sensorRange: 2, obstacles: [], roughTerrain: [], samples: [],
    dustStorm: { position: { x: 1, z: 0 }, radius: 2, durationMs: 5000, sensorRange: 1, movementEnergyMultiplier: 2 } } });
  expedition.dispatch({ type: 'set-teaching-mode', enabled: true });
  expedition.dispatch({ type: 'start' });
  if (command === 'set-instructions') expedition.dispatch({ type: command, instructions: 'Changed mission' });
  else if (command === 'set-mission-preset') expedition.dispatch({ type: command, preset: 'conserve-energy' });
  else expedition.dispatch({ type: command });
  expedition.dispatch({ type: 'continue-choice' });
  expedition.advanceWallTime(60_000);
  expect(expedition.getSnapshot().currentAction).toBeNull();
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(0);
  if (command !== 'reset' && command !== 'stop') expedition.dispatch({ type: 'stop' });
  const record = expedition.getCompletedRecords()[0];
  if (record) {
    const replay = createReplay(importExpeditionRecord(exportExpeditionRecord(record)));
    replay.dispatch({ type: 'start' });
    expect(replay.getSnapshot()).toEqual(record.results);
  }
});

test.each([false, true])('inspection and teaching preserve a real SDK usage guard, including baseline continuation: %s', baseline => {
  return (async () => {
    let calls = 0;
    const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
      calls++;
      const input = readProviderInput(JSON.parse(init!.body as string).state) as ControllerInput;
      return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: {
        type: 'choice', choice: 'wait:5000', confidence: 0,
        probabilities: Object.fromEntries(input.candidates.map(item => [item.id, 1 / input.candidates.length])),
      } } });
    } });
    const expedition = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) }) });
    expedition.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 1, estimatedCost: 0.1 } });
    expedition.dispatch({ type: 'set-teaching-mode', enabled: true });
    const settled = new Promise<void>(resolve => expedition.onDecisionSettled(resolve));
    expedition.dispatch({ type: 'start' });
    expedition.dispatch({ type: 'inspect-decision', decisionId: 1 });
    await settled;
    expect(expedition.getSnapshot()).toMatchObject({ usagePause: { reasons: ['attempt-limit'] }, heldDecisionId: 1, currentAction: null });
    expedition.dispatch({ type: 'continue-choice' });
    expedition.dispatch({ type: 'resume' });
    expedition.advanceWallTime(600_000);
    expect(calls).toBe(1);
    expect(expedition.getSnapshot().elapsedMs).toBe(0);
    if (baseline) expedition.dispatch({ type: 'continue-with-baseline' });
    else {
      expedition.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 2, estimatedCost: 0.1 } });
      expedition.dispatch({ type: 'continue-inference' });
    }
    expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', inspectionDecisionId: 1, currentAction: null });
    expedition.dispatch({ type: 'end-inspection' });
    if (baseline) {
      expedition.dispatch({ type: 'resume' });
      expect(expedition.getSnapshot()).toMatchObject({ heldDecisionId: 2, controller: 'baseline' });
    }
    expedition.dispatch({ type: 'continue-choice' });
    expedition.advanceWallTime(100);
    expect(expedition.getSnapshot().elapsedMs).toBe(100);
    expedition.dispatch({ type: 'stop' });
    const record = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
    const replay = createReplay(record);
    replay.dispatch({ type: 'start' });
    replay.advanceWallTime(1000);
    expect(replay.getSnapshot()).toEqual(record.results);
    expect(calls).toBe(1);
  })();
});

test('teaching and historical selection work in replay without changing the recorded choices or source export', () => {
  const live = createExpedition();
  live.dispatch({ type: 'set-teaching-mode', enabled: true });
  live.dispatch({ type: 'start' });
  live.dispatch({ type: 'continue-choice' });
  live.advanceWallTime(60_000);
  live.dispatch({ type: 'inspect-decision', decisionId: 1 });
  live.dispatch({ type: 'end-inspection' });
  live.dispatch({ type: 'continue-choice' });
  live.advanceWallTime(1_000);
  live.dispatch({ type: 'stop' });
  const source = live.getCompletedRecords()[0]!;
  const original = exportExpeditionRecord(source);
  const replay = createReplay(importExpeditionRecord(original));
  replay.dispatch({ type: 'set-teaching-mode', enabled: true });
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot()).toMatchObject({ status: 'paused', elapsedMs: 0, heldDecisionId: 1 });
  replay.dispatch({ type: 'inspect-decision', decisionId: 1 });
  replay.dispatch({ type: 'continue-choice' });
  const frozen = replay.getSnapshot();
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot()).toEqual(frozen);
  replay.dispatch({ type: 'end-inspection' });
  replay.dispatch({ type: 'continue-choice' });
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot()).toMatchObject({ status: 'paused', heldDecisionId: 2 });
  replay.dispatch({ type: 'continue-choice' });
  replay.advanceWallTime(60_000);
  expect(replay.getSnapshot().status).toBe('ended');
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(exportExpeditionRecord(source)).toBe(original);
});

test('a pending choice settling during historical inspection stays held and mission edits invalidate it', async () => {
  let settle!: (id: string) => void;
  let input!: ControllerInput;
  const expedition = createExpedition({ controller: { id: 'scripted', decide(value) {
    input = value;
    return new Promise<string>(resolve => { settle = resolve; });
  } } });
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'inspect-decision', decisionId: 1 });
  settle(input.candidates.find(item => item.kind === 'wait')!.id);
  await Promise.resolve();
  expect(expedition.getSnapshot()).toMatchObject({ status: 'paused', inspectionDecisionId: 1, heldDecisionId: 1, currentAction: null });
  expedition.dispatch({ type: 'resume' });
  expedition.dispatch({ type: 'continue-choice' });
  const frozen = expedition.getSnapshot();
  expedition.advanceWallTime(500_000);
  expect(expedition.getSnapshot()).toEqual(frozen);
  expedition.dispatch({ type: 'set-instructions', instructions: 'Changed while inspecting' });
  expedition.dispatch({ type: 'end-inspection' });
  expedition.dispatch({ type: 'resume' });
  expect(expedition.getSnapshot()).toMatchObject({ heldDecisionId: null, currentAction: null, decisionPending: true });
  expect(expedition.getRecord().events.filter(event => event.type === 'action-started')).toHaveLength(0);
  expect(input.instructions).toBe('Changed while inspecting');
  settle(input.candidates.find(item => item.kind === 'wait')!.id);
  await Promise.resolve();
  expedition.advanceWallTime(100);
  expect(expedition.getSnapshot().elapsedMs).toBe(100);
  expedition.dispatch({ type: 'stop' });
  const record = importExpeditionRecord(exportExpeditionRecord(expedition.getCompletedRecords()[0]!));
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(1000);
  expect(replay.getSnapshot()).toEqual(record.results);
});

test.each(['legacy-usage-v1', 'legacy-usage-v2', 'legacy-usage-v3', 'legacy-mission-v4', 'legacy-baseline-v5',
  'legacy-cadence-v6', 'legacy-world-v7', 'legacy-viewing-v8'])('legacy %s supports inspection and teaching with unchanged exports', async name => {
  const source = importExpeditionRecord(await Bun.file(new URL(`./fixtures/${name}.json`, import.meta.url)).text());
  const exported = exportExpeditionRecord(source);
  const replay = createReplay(source);
  replay.dispatch({ type: 'set-teaching-mode', enabled: true });
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot().heldDecisionId).toBe(1);
  replay.dispatch({ type: 'inspect-decision', decisionId: 1 });
  const frozen = replay.getSnapshot();
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot()).toEqual(frozen);
  expect(replay.getDecisions()[0]!.input).toEqual(source.decisions[0]!.input);
  replay.dispatch({ type: 'end-inspection' });
  replay.dispatch({ type: 'set-teaching-mode', enabled: false });
  replay.dispatch({ type: 'resume' });
  replay.advanceWallTime(300_000);
  expect(replay.getSnapshot().status).toBe('ended');
  expect(replay.getDecisions()).toEqual(source.decisions);
  expect(exportExpeditionRecord(source)).toBe(exported);
});

test('failure recovery cannot request a replacement until historical inspection ends', async () => {
  let calls = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    const input = readProviderInput(JSON.parse(init!.body as string).state) as ControllerInput;
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 40 }, answers: { action: {
      type: 'choice', choice: ++calls === 1 ? 'invented' : 'wait:5000', confidence: 0,
      probabilities: Object.fromEntries(input.candidates.map(item => [item.id, 1 / input.candidates.length])),
    } } });
  } });
  const expedition = createExpedition({ controller: createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) }) });
  let settled = new Promise<void>(resolve => expedition.onDecisionSettled(resolve));
  expedition.dispatch({ type: 'start' });
  expedition.dispatch({ type: 'inspect-decision', decisionId: 1 });
  await settled;
  expect(expedition.getSnapshot().decisionFailure).toBe('invalid-output');
  expedition.dispatch({ type: 'resume' });
  expect(expedition.getSnapshot().decisionFailure).toBe('invalid-output');
  expedition.dispatch({ type: 'retry-decision' });
  expedition.advanceWallTime(60_000);
  expect(calls).toBe(1);
  expedition.dispatch({ type: 'end-inspection' });
  settled = new Promise<void>(resolve => expedition.onDecisionSettled(resolve));
  expedition.dispatch({ type: 'resume' });
  await settled;
  expect(calls).toBe(2);
  expect(expedition.getSnapshot()).toMatchObject({ status: 'running', currentAction: { kind: 'wait' }, heldDecisionId: null });
  expedition.dispatch({ type: 'stop' });
  const record = expedition.getCompletedRecords()[0]!;
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  expect(replay.getDecisions()).toEqual(record.decisions);
});

test('replay inspection controls stay separate from recorded pauses and teaching can be enabled for a completed replay restart', async () => {
  let settle!: (id: string) => void;
  const live = createExpedition({ controller: { id: 'scripted', decide: () => new Promise<string>(resolve => { settle = resolve; }) } });
  live.dispatch({ type: 'start' });
  live.dispatch({ type: 'inspect-decision', decisionId: 1 });
  settle('wait:5000');
  await Promise.resolve();
  live.dispatch({ type: 'end-inspection' });
  live.dispatch({ type: 'resume' });
  live.dispatch({ type: 'stop' });
  const replay = createReplay(live.getCompletedRecords()[0]!);
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot().status).toBe('ended');
  replay.dispatch({ type: 'set-teaching-mode', enabled: true });
  replay.dispatch({ type: 'reset' });
  replay.dispatch({ type: 'start' });
  expect(replay.getSnapshot().heldDecisionId).toBe(1);
  expect(replay.getSnapshot().inspectionDecisionId).toBeNull();
  replay.dispatch({ type: 'inspect-decision', decisionId: 1 });
  replay.dispatch({ type: 'end-inspection' });
  expect(replay.getSnapshot().inspectionDecisionId).toBeNull();
  replay.dispatch({ type: 'continue-choice' });
  expect(replay.getSnapshot().status).toBe('ended');
});

test('inspection preserves a partial simulation step in live play and replay without adding paused wall time', () => {
  const live = createExpedition();
  live.dispatch({ type: 'start' });
  live.advanceWallTime(50);
  live.dispatch({ type: 'inspect-decision', decisionId: 1 });
  live.advanceWallTime(60_000);
  live.dispatch({ type: 'end-inspection' });
  live.dispatch({ type: 'resume' });
  live.advanceWallTime(50);
  expect(live.getSnapshot().elapsedMs).toBe(100);
  live.advanceWallTime(400);
  live.dispatch({ type: 'stop' });
  const replay = createReplay(live.getCompletedRecords()[0]!);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(50);
  replay.dispatch({ type: 'inspect-decision', decisionId: 1 });
  replay.advanceWallTime(60_000);
  replay.dispatch({ type: 'end-inspection' });
  replay.dispatch({ type: 'resume' });
  replay.advanceWallTime(50);
  expect(replay.getSnapshot().elapsedMs).toBe(100);
});
