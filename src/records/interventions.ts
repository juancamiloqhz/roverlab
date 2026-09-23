import { interventionPhase, captureIntervention, type Intervention, type InterventionOccurrence } from '../simulation/interventions';
import type { ExpeditionRecord } from '../simulation/types';
import { sameRecordData } from './history';

// Check schedule provenance against actual requests and their mission/storm events.
// Movement and safe-boundary execution are additionally verified by createReplay.
export function hasConsistentInterventions(record: ExpeditionRecord): boolean {
  const initial = record.startingConditions.interventionSchedule;
  const final = record.results.interventions;
  if (record.version < 11) return !initial && !final && record.events.every(event =>
    event.type !== 'intervention-requested' && event.type !== 'intervention-schedule-selected');
  if (!initial || !final) return false;
  let schedule = structuredClone(initial);
  const history: InterventionOccurrence[] = [];
  let started = false;
  let mission = record.startingConditions.mission!;
  let missionVersion = 0;
  let expectedChange: Intervention | null = null;
  const fits = (event: Intervention) => event.atMs <= record.startingConditions.durationMs && (event.kind !== 'storm'
    || (event.storm.position.x < record.startingConditions.scenario.width && event.storm.position.z < record.startingConditions.scenario.depth));
  if (!schedule.events.every(fits)) return false;
  for (const event of record.events) {
    switch (event.type) {
      case 'started': started = true; break;
      case 'intervention-schedule-selected':
        if (started || !event.schedule.events.every(fits) || history.some(item => !sameRecordData(
          schedule.events.find(previous => previous.id === item.id), event.schedule.events.find(next => next.id === item.id)))) return false;
        schedule = structuredClone(event.schedule);
        break;
      case 'intervention-requested': {
        const intervention = event.intervention;
        if (expectedChange || !fits(intervention) || intervention.atMs !== event.atMs || history.some(item => item.id === intervention.id)) return false;
        if (event.source === 'scheduled') {
          const next = schedule.events.find(item => !history.some(occurrence => occurrence.id === item.id));
          if ((interventionPhase(intervention) === 'setup' ? started : !started) || !sameRecordData(next, intervention)) return false;
        } else {
          if (intervention.phase !== (started ? 'after-step' : 'setup')) return false;
          if (schedule.events.some(item => item.id === intervention.id || (item.kind === 'storm' && intervention.kind === 'storm'))) return false;
          captureIntervention({ schedule, history }, intervention);
        }
        const changed = intervention.kind === 'mission' && !sameRecordData(mission, intervention.mission);
        if (event.missionVersion !== (changed ? missionVersion + 1 : undefined)) return false;
        expectedChange = intervention.kind === 'storm' || changed ? intervention : null;
        history.push({ id: intervention.id, source: event.source, requestedAtMs: event.atMs,
          ...(event.missionVersion !== undefined ? { missionVersion: event.missionVersion } : {}) });
        break;
      }
      case 'mission-changed':
      case 'instructions-changed': {
        const preferences = event.type === 'mission-changed' ? event.mission.preferences : { mode: 'free-text' as const, instructions: event.instructions };
        if (!expectedChange || expectedChange.atMs !== event.atMs || expectedChange.kind !== 'mission'
          || !sameRecordData(expectedChange.mission, preferences)) return false;
        mission = preferences;
        missionVersion++;
        expectedChange = null;
        break;
      }
      case 'storm-introduced': {
        if (!expectedChange || expectedChange.atMs !== event.atMs || expectedChange.kind !== 'storm') return false;
        const { durationMs, ...effects } = expectedChange.storm;
        if (!sameRecordData(event.storm, { ...effects, id: 'dust-storm', expiresAtMs: event.atMs + durationMs })) return false;
        expectedChange = null;
        break;
      }
      case 'decision-requested':
      case 'ended':
        if (expectedChange || schedule.events.some(item => (item.atMs < event.atMs
          || (item.atMs === event.atMs && (event.type === 'ended' || interventionPhase(item) !== 'after-step')))
          && !history.some(occurrence => occurrence.id === item.id))) return false;
        break;
    }
  }
  return !expectedChange && sameRecordData({ schedule, history }, final);
}
