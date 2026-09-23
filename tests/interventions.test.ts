import { readProviderInput } from './fixtures/provider-input';
import { expect, test } from 'bun:test';
import { createDecisionHandler } from '../server/decisions';
import { createTypeSafeController } from '../src/controllers/typesafe';
import type { ControllerInput } from '../src/simulation/types';
import { missionPreset } from '../shared/mission';
import { createExpedition, createReplay, type ExpeditionSession } from '../src/simulation/expedition';
import { exportExpeditionRecord, importExpeditionRecord } from '../src/records/contract';
import type { InterventionSchedule } from '../src/simulation/interventions';
import type { Scenario } from '../src/simulation/types';

const corridor: Scenario = {
  id: 'schedule-corridor', name: 'Schedule corridor', width: 10, depth: 1,
  base: { x: 0, z: 0 }, sensorRange: 1, obstacles: [], roughTerrain: [], samples: [],
  dustStorm: { position: { x: 4, z: 0 }, radius: 0.5, durationMs: 20_000, sensorRange: 0.5, movementEnergyMultiplier: 3 },
};
const schedule: InterventionSchedule = {
  version: 'expedition-time-v1',
  events: [
    { id: 'storm', atMs: 8_000, kind: 'storm', storm: corridor.dustStorm! },
    { id: 'priorities', atMs: 8_000, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('conserve-energy') } },
  ],
};

function roundTrip(session: ExpeditionSession) {
  session.dispatch({ type: 'stop' });
  const record = session.getCompletedRecords().at(-1)!;
  const json = exportExpeditionRecord(record);
  const imported = importExpeditionRecord(json);
  const replay = createReplay(imported);
  replay.dispatch({ type: 'set-speed', speed: record.results.speed });
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(record.results.durationMs);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getDecisions()).toEqual(record.decisions);
  expect(exportExpeditionRecord(imported)).toBe(json);
  return imported;
}

test('different trajectories receive the same timed storm and mission request without sharing observations', () => {
  const runs = [false, true].map(moving => {
    const session = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: input =>
      (moving ? input.candidates.find(action => action.kind === 'explore' && action.target.position.x > input.position.x)?.id : undefined) ?? 'wait:5000',
    } });
    session.dispatch({ type: 'set-intervention-schedule', schedule });
    session.dispatch({ type: 'start' });
    session.advanceWallTime(12_000);
    return session;
  });
  for (const session of runs) {
    expect(session.getRecord().events.filter(event => event.type === 'storm-introduced')).toMatchObject([
      { atMs: 8_000, storm: { position: { x: 4, z: 0 }, radius: 0.5, expiresAtMs: 28_000, movementEnergyMultiplier: 3 } },
    ]);
    expect(session.getSnapshot().mission!.history[1]).toMatchObject({ requestedAtMs: 8_000, preferences: schedule.events[1]!.kind === 'mission' ? schedule.events[1]!.mission : undefined });
  }
  expect(runs[0]!.getSnapshot().memory.some(item => item.kind === 'dust-storm')).toBe(false);
  expect(runs[1]!.getSnapshot().memory.some(item => item.kind === 'dust-storm')).toBe(true);
  expect(runs[0]!.getSnapshot().rover.position).not.toEqual(runs[1]!.getSnapshot().rover.position);
  expect(runs[0]!.getRecord().events.filter(event => event.type === 'intervention-requested').map(event => [event.atMs, event.intervention]))
    .toEqual(runs[1]!.getRecord().events.filter(event => event.type === 'intervention-requested').map(event => [event.atMs, event.intervention]));
});

test('manual requests retain their times, reproduce as a schedule, and round-trip without duplicate replay events', () => {
  const controller = { id: 'scripted' as const, decide: () => 'wait:5000' };
  const manual = createExpedition({ scenario: corridor, controller });
  manual.dispatch({ type: 'start' });
  manual.advanceWallTime(1_000);
  manual.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  manual.dispatch({ type: 'introduce-storm' });
  manual.advanceWallTime(1_000);
  manual.dispatch({ type: 'set-instructions', instructions: 'Return with evidence.' });
  manual.advanceWallTime(3_000);
  const recorded = roundTrip(manual);
  expect(recorded.version).toBe(13);
  expect(recorded.results.mission!.history).toMatchObject([
    { version: 0, requestedAtMs: 0, appliedAtMs: 0 },
    { version: 1, requestedAtMs: 1_000, appliedAtMs: null },
    { version: 2, requestedAtMs: 2_000, appliedAtMs: 5_000 },
  ]);
  const reproduced = createExpedition({ scenario: corridor, controller,
    interventionSchedule: recorded.results.interventions!.schedule });
  reproduced.dispatch({ type: 'start' });
  reproduced.advanceWallTime(5_000);
  const other = roundTrip(reproduced);
  expect(other.results.mission).toEqual(recorded.results.mission);
  const externalEvents = (session: ExpeditionSession) => session.getRecord().events
    .flatMap(event => event.type === 'intervention-requested' ? [[event.atMs, event.intervention]] : []);
  expect(externalEvents(reproduced)).toEqual(externalEvents(manual));
  expect(other.results.interventions!.history.map(item => item.source)).toEqual(['scheduled', 'scheduled', 'scheduled']);
});

test('simultaneous requests follow list order after action completion and before the next choice, including timeout', () => {
  const session = createExpedition({ scenario: { ...corridor, durationMs: 10_000 }, controller: { id: 'scripted', decide: () => 'wait:5000' },
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'setup', atMs: 0, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('balanced') } },
      { id: 'first', atMs: 5_000, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('explore-more') } },
      { id: 'last', atMs: 5_000, kind: 'mission', mission: { mode: 'free-text', instructions: 'Save energy.' } },
      { id: 'terminal', atMs: 10_000, kind: 'storm', storm: corridor.dustStorm! },
    ] } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  const atBoundary = session.getRecord().events.filter(event => event.atMs === 5_000).map(event => event.type);
  expect(atBoundary).toEqual(['action-completed', 'intervention-requested', 'mission-changed', 'intervention-requested',
    'instructions-changed', 'mission-applied', 'decision-requested', 'decision-made', 'action-started']);
  expect(session.getDecisions().map(decision => decision.input.mission?.version)).toEqual([1, 3]);
  expect(session.getSnapshot().interventions!.history.map(item => item.id)).toEqual(['setup', 'first', 'last', 'terminal']);
  roundTrip(session);
});

test('an intervention at the depletion boundary still occurs once before the expedition ends', () => {
  const session = createExpedition({ scenario: { ...corridor, batteryCapacity: 2 },
    controller: { id: 'scripted', decide: input => input.candidates.find(action => action.kind === 'explore')!.id },
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'terminal', atMs: 4_000, kind: 'storm', storm: corridor.dustStorm! },
    ] } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(4_000);
  expect(session.getSnapshot()).toMatchObject({ elapsedMs: 4_000, endingCondition: 'stranded',
    interventions: { history: [{ id: 'terminal', requestedAtMs: 4_000 }] } });
  roundTrip(session);
});

test('mission setup remains reproducible when mission control then selects a predefined schedule', () => {
  const session = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: () => 'wait:5000' } });
  session.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  session.dispatch({ type: 'set-intervention-schedule', schedule });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  expect(session.getSnapshot().interventions!.history.map(item => item.requestedAtMs)).toEqual([0, 8_000, 8_000]);
  const record = roundTrip(session);
  const reproduced = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: () => 'wait:5000' },
    interventionSchedule: record.results.interventions!.schedule });
  reproduced.dispatch({ type: 'start' });
  reproduced.advanceWallTime(10_000);
  expect(reproduced.getSnapshot().mission).toEqual(record.results.mission);
  roundTrip(reproduced);
});

test('pending choices, inspection and teaching freeze the schedule; playback speeds preserve event times', async () => {
  const responses: ((id: string) => void)[] = [];
  const session = createExpedition({ scenario: corridor, interventionSchedule: schedule,
    controller: { id: 'scripted', decide: () => new Promise<string>(resolve => responses.push(resolve)) } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(60_000);
  expect(session.getSnapshot().elapsedMs).toBe(0);
  responses.shift()!('wait:5000');
  await Promise.resolve();
  session.advanceWallTime(1_000);
  session.dispatch({ type: 'inspect-decision', decisionId: 1 });
  const inspecting = session.getSnapshot();
  session.advanceWallTime(60_000);
  expect(session.getSnapshot()).toEqual(inspecting);
  session.dispatch({ type: 'end-inspection' });
  session.dispatch({ type: 'set-teaching-mode', enabled: true });
  session.dispatch({ type: 'resume' });
  session.advanceWallTime(4_000);
  responses.shift()!('wait:5000');
  await Promise.resolve();
  const held = session.getSnapshot();
  expect(held).toMatchObject({ elapsedMs: 5_000, heldDecisionId: 2 });
  session.advanceWallTime(60_000);
  expect(session.getSnapshot()).toEqual(held);
  session.dispatch({ type: 'set-speed', speed: 4 });
  session.dispatch({ type: 'continue-choice' });
  session.advanceWallTime(750);
  expect(session.getSnapshot()).toMatchObject({ elapsedMs: 8_000, interventions: { history: [{ requestedAtMs: 8_000 }, { requestedAtMs: 8_000 }] } });
  session.dispatch({ type: 'pause' });
  const paused = session.getSnapshot();
  session.advanceWallTime(60_000);
  expect(session.getSnapshot()).toEqual(paused);
  roundTrip(session);

  for (const speed of [1, 2, 4] as const) {
    const other = createExpedition({ scenario: corridor, interventionSchedule: schedule, controller: { id: 'scripted', decide: () => 'wait:5000' } });
    other.dispatch({ type: 'set-speed', speed });
    other.dispatch({ type: 'start' });
    other.advanceWallTime(8_000 / speed);
    expect(other.getSnapshot().interventions).toEqual(paused.interventions);
    expect(other.getFullWorldView().storm).toEqual(session.getFullWorldView().storm);
  }
});

test('a scheduled mission request during travel keeps its request time and applies only at a waypoint', () => {
  const session = createExpedition({ scenario: corridor, controller: { id: 'scripted', decide: input =>
    input.candidates.find(action => action.kind === 'explore')?.id ?? 'wait:5000' },
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'mid-edge', atMs: 1_000, kind: 'mission', mission: { mode: 'preset', preset: missionPreset('balanced') } },
    ] } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(1_000);
  expect(session.getSnapshot().mission!.history[1]).toMatchObject({ requestedAtMs: 1_000, appliedAtMs: null });
  expect(session.getSnapshot().rover.position.x).toBe(0.25);
  session.advanceWallTime(3_000);
  expect(session.getSnapshot().mission!.history[1]).toMatchObject({ requestedAtMs: 1_000, appliedAtMs: 4_000 });
  expect(session.getDecisions()[1]!.input.mission?.version).toBe(1);
  roundTrip(session);
});

test('a version 10 history replays its original manual events without inventing a schedule', async () => {
  const record = importExpeditionRecord(await Bun.file(new URL('./fixtures/legacy-interventions-v10.json', import.meta.url)).text());
  const before = exportExpeditionRecord(record);
  const replay = createReplay(record);
  replay.dispatch({ type: 'start' });
  replay.advanceWallTime(record.results.durationMs);
  expect(replay.getSnapshot()).toEqual(record.results);
  expect(replay.getSnapshot().interventions).toBeUndefined();
  expect(exportExpeditionRecord(record)).toBe(before);
});

test('schedule imports reject forged history, ordering, payloads, unsupported timing and provenance', () => {
  const session = createExpedition({ scenario: corridor, interventionSchedule: schedule, controller: { id: 'scripted', decide: () => 'wait:5000' } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  const record = roundTrip(session);
  const mutations = [
    (value: any) => { value.version = 10; },
    (value: any) => { value.startingConditions.interventionSchedule.version = 'unknown'; },
    (value: any) => { value.startingConditions.interventionSchedule.events[0].atMs = 8_001; },
    (value: any) => { value.startingConditions.interventionSchedule.events.reverse(); },
    (value: any) => { value.startingConditions.interventionSchedule.events[0].storm.position.x = 100; },
    (value: any) => { value.startingConditions.interventionSchedule.events[0].storm.movementEnergyMultiplier = 0; },
    (value: any) => { value.results.interventions.history[0].requestedAtMs = 9_000; },
    (value: any) => { value.results.interventions.schedule.events[0].storm.radius = 2; },
    (value: any) => { value.events.find((event: any) => event.type === 'intervention-requested').atMs = 7_000; },
    (value: any) => { value.events.find((event: any) => event.type === 'intervention-requested').source = 'manual'; },
    (value: any) => { value.results.interventions.history.push(value.results.interventions.history[0]); },
    (value: any) => { delete value.results.interventions; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(record);
    mutate(invalid);
    expect(() => importExpeditionRecord(JSON.stringify(invalid))).toThrow('Invalid expedition record');
  }
  expect(() => createExpedition({ scenario: corridor, interventionSchedule: {
    version: 'expedition-time-v1', events: [{ ...schedule.events[0]!, atMs: 1 }],
  } })).toThrow();
  expect(() => createExpedition({ scenario: corridor, interventionSchedule: {
    version: 'expedition-time-v1', events: [{ ...schedule.events[0]!, atMs: 300_100 }],
  } })).toThrow('Interventions must fit');
});

test('a real SDK usage pause freezes future interventions until explicit baseline continuation', async () => {
  let calls = 0;
  const handler = createDecisionHandler({ apiKey: 'scripted-key', fetch: async (_url, init) => {
    calls++;
    const input = readProviderInput((JSON.parse(init!.body as string) as { state: ControllerInput }).state);
    expect(input).not.toHaveProperty('interventions');
    return Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 1_000, output_tokens: 40 },
      answers: { action: { type: 'choice', choice: 'wait:5000', confidence: 1,
        probabilities: Object.fromEntries(input.candidates.map(candidate => [candidate.id, candidate.id === 'wait:5000' ? 1 : 0])) } } });
  } });
  const session = createExpedition({ scenario: corridor, interventionSchedule: schedule,
    controller: createTypeSafeController({ fetch: (url, init) => handler(new Request(new URL(url, 'http://localhost'), init)) }) });
  session.dispatch({ type: 'set-inference-limits', limits: { providerAttempts: 1, estimatedCost: 0.1 } });
  session.dispatch({ type: 'start' });
  await new Promise<void>(resolve => session.onDecisionSettled(resolve));
  expect(session.getSnapshot().usagePause?.reasons).toEqual(['attempt-limit']);
  const paused = session.getSnapshot();
  session.advanceWallTime(60_000);
  expect(session.getSnapshot()).toEqual(paused);
  session.dispatch({ type: 'continue-with-baseline' });
  session.advanceWallTime(8_000);
  expect(session.getSnapshot().interventions!.history).toHaveLength(2);
  roundTrip(session);
  expect(calls).toBe(1);
});

test('manual reproduction preserves a request issued after a new action starts at the same timestamp', () => {
  const controller = { id: 'scripted' as const, decide: () => 'wait:5000' };
  const manual = createExpedition({ scenario: corridor, controller });
  manual.dispatch({ type: 'start' });
  manual.advanceWallTime(5_000);
  manual.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  manual.advanceWallTime(5_000);
  const captured = roundTrip(manual);
  const reproduced = createExpedition({ scenario: corridor, controller, interventionSchedule: captured.results.interventions!.schedule });
  reproduced.dispatch({ type: 'start' });
  reproduced.advanceWallTime(10_000);
  expect(reproduced.getSnapshot().mission).toEqual(captured.results.mission);
  expect(reproduced.getDecisions().map(decision => [decision.input.atMs, decision.input.mission!.version])).toEqual([[0, 0], [5_000, 0], [10_000, 1]]);
  roundTrip(reproduced);
});

test('successive manual changes at a waypoint retain their individual safe-boundary applications', () => {
  const controller = { id: 'scripted' as const, decide: (input: ControllerInput) =>
    input.candidates.find(action => action.kind === 'explore' && action.target.position.x > input.position.x)?.id ?? 'wait:5000' };
  const manual = createExpedition({ scenario: corridor, controller });
  manual.dispatch({ type: 'start' });
  manual.advanceWallTime(4_000);
  manual.dispatch({ type: 'set-mission-preset', preset: 'balanced' });
  manual.dispatch({ type: 'set-mission-preset', preset: 'conserve-energy' });
  manual.advanceWallTime(4_000);
  const record = roundTrip(manual);
  const scheduled = createExpedition({ scenario: corridor, controller, interventionSchedule: record.results.interventions!.schedule });
  scheduled.dispatch({ type: 'start' });
  scheduled.advanceWallTime(8_000);
  expect(scheduled.getSnapshot().mission).toEqual(record.results.mission);
  expect(scheduled.getDecisions().map(decision => [decision.input.atMs, decision.input.mission!.version]))
    .toEqual(manual.getDecisions().map(decision => [decision.input.atMs, decision.input.mission!.version]));
  roundTrip(scheduled);
});

test('after-step requests at timeout remain replayable without selecting another action', () => {
  const session = createExpedition({ scenario: { ...corridor, durationMs: 10_000 }, controller: { id: 'scripted', decide: () => 'wait:5000' },
    interventionSchedule: { version: 'expedition-time-v1', events: [
      { id: 'terminal', atMs: 10_000, phase: 'after-step', kind: 'storm', storm: corridor.dustStorm! },
    ] } });
  session.dispatch({ type: 'start' });
  session.advanceWallTime(10_000);
  expect(session.getDecisions()).toHaveLength(2);
  roundTrip(session);
});
