import type { ExpeditionRecord } from '../simulation/types';
import { compareInterventions, interventionPhase, type Intervention, type InterventionSchedule } from '../simulation/interventions';
import { sameRecordData } from './history';

// Older records contain actual edits and storms but no planned future requests.
// Preserve that distinction when reconstructing their observable schedule.
export function recordedSchedule(record: ExpeditionRecord): InterventionSchedule {
  if (record.results.interventions) return structuredClone(record.results.interventions.schedule);
  const started = record.events.find(event => event.type === 'started')!;
  const events: Intervention[] = record.events.flatMap((event): Intervention[] => {
    const fields = { id: `legacy-${event.sequence}`, atMs: event.atMs,
      phase: event.sequence < started.sequence ? 'setup' as const : 'after-step' as const };
    if (event.type === 'mission-changed') return [{ ...fields, kind: 'mission', mission: event.mission.preferences }];
    if (event.type === 'instructions-changed') return [{ ...fields, kind: 'mission', mission: { mode: 'free-text', instructions: event.instructions } }];
    if (event.type === 'storm-introduced') {
      const { id: _id, expiresAtMs, ...storm } = event.storm;
      return [{ ...fields, kind: 'storm', storm: { ...storm, durationMs: expiresAtMs - event.atMs } }];
    }
    return [];
  });
  return { version: 'expedition-time-v1', events: events.sort(compareInterventions) };
}

function simulationSettings(record: ExpeditionRecord) {
  const { scenario, objective, rubric, instructions, mission, controller, inferenceLimits, interventionSchedule,
    simulationVersion = 'grid-expedition-v1', ...settings } = record.startingConditions;
  return { simulationVersion, ...settings };
}

function scheduleConditions(record: ExpeditionRecord) {
  return recordedSchedule(record).events.map(intervention => {
    const { id: _id, ...event } = intervention;
    return { ...event, phase: interventionPhase(intervention) };
  });
}

function missionRequests(record: ExpeditionRecord) {
  return { initial: record.startingConditions.mission ?? { mode: 'free-text', instructions: record.startingConditions.instructions },
    requests: scheduleConditions(record).filter(event => event.kind === 'mission') };
}

export function compareExpeditionRecords(left: ExpeditionRecord, right: ExpeditionRecord) {
  const records = [left, right];
  return {
    scenario: sameRecordData(left.startingConditions.scenario, right.startingConditions.scenario),
    simulation: sameRecordData(simulationSettings(left), simulationSettings(right)),
    objective: left.results.objective === right.results.objective,
    rubric: sameRecordData(left.results.rubric, right.results.rubric),
    missionRequests: sameRecordData(missionRequests(left), missionRequests(right)),
    missionApplications: left.results.mission && right.results.mission
      ? sameRecordData(left.results.mission.history, right.results.mission.history) : null,
    schedule: sameRecordData(scheduleConditions(left), scheduleConditions(right)),
    scheduleComplete: records.every(record => !!record.results.interventions && record.matchedFrom?.scheduleBasis !== 'reconstructed-legacy'),
    freeText: records.some(record => !record.results.mission || record.results.mission.effective.preferences.mode === 'free-text'
      || record.decisions.some(decision => decision.input.mission?.preferences.mode === 'free-text')),
  };
}

// Definitions and thresholds come from the recorded preset, never today's preset.
export function presetAdherence(record: ExpeditionRecord) {
  const initialTerrain = new Set<string>();
  const terrain = new Set<string>();
  for (const event of record.events) if (event.type === 'discovered') for (const item of event.observations) {
    if (item.kind === 'terrain') {
      terrain.add(item.id);
      if (event.atMs === 0) initialTerrain.add(item.id);
    }
  }
  const collected = record.results.deliveredSamples.length + record.results.cargo.length;
  const returnMargins = record.decisions.flatMap(decision => {
    const preferences = decision.input.mission?.preferences;
    if (preferences?.mode !== 'preset') return [];
    const routes = decision.input.candidates.filter(action => action.kind === 'return-to-base');
    const margin = routes.length ? decision.input.battery - Math.min(...routes.map(route => route.routeEstimate.energy)) : null;
    return [{ decisionId: decision.id, atMs: decision.input.atMs, preset: preferences.preset,
      margin, required: preferences.preset.settings.returnReserveEnergy }];
  });
  return { knowledgeRate: record.results.elapsedMs ? (terrain.size - initialTerrain.size) / (record.results.elapsedMs / 60_000) : null,
    deliveryFraction: collected ? record.results.deliveredSamples.length / collected : null, returnMargins };
}
