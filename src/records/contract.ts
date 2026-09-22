import { missionPreferencesSchema, missionRevisionSchema, missionStateSchema, missionInstructions } from '../../shared/mission';
import { inferenceLimitsSchema, usagePauseSchema } from '../../shared/limits';
import { accountingSchema, attemptEvidenceSchema, inferenceUsageSchema, submissionSchema, summarizeUsage } from '../../shared/inference';
import { z } from 'zod';
import { hasConsistentHistory, sameRecordData } from './history';
import { controllerInputSchema, failureSchema, observationSchema, recordedActionSchema, validChoice, INFERENCE_LIMIT, MAX_MISSION_INSTRUCTIONS_LENGTH } from '../../shared/decisions';
import type { Decision, ExpeditionEvent, ExpeditionRecord, ExpeditionSnapshot, ExpeditionStartingConditions } from '../simulation/types';

const number = z.number().finite().nonnegative();
const integer = number.int();
const text = z.string().max(20_000);
const instructions = z.string().max(MAX_MISSION_INSTRUCTIONS_LENGTH);
const identity = z.string().min(1).max(200);
const position = z.strictObject({ x: number, z: number });
const objective = z.enum(['past-water', 'unusual-minerals']);
const controller = z.enum(['baseline', 'typesafe', 'scripted']);
const classification = z.enum(['unrelated', 'suggestive', 'strong-evidence']);
const rubric = z.strictObject({ unrelated: z.literal(0), suggestive: z.literal(5), 'strong-evidence': z.literal(10) });
const ending = z.enum(['timeout', 'manual-stop', 'stranded']);
const speed = z.union([z.literal(1), z.literal(2), z.literal(4)]);
const reason = z.enum(['start', 'action-completed', 'instructions-changed', 'new-observations', 'storm-detected', 'storm-expired', 'retry', 'controller-changed', 'mission-changed']);
const cargoSample = z.strictObject({ sampleId: identity, label: text });
const deliveredSample = cargoSample.extend({ classification, score: number, deliveredAtMs: number });
const stormFields = { position, radius: number.positive(), sensorRange: number, movementEnergyMultiplier: number.min(1) };
const storm = z.strictObject({ ...stormFields, id: identity, expiresAtMs: number });
const history = z.array(z.strictObject({ controller, atMs: number, firstDecisionId: integer.positive() })).min(1).max(2);
const observations = z.array(observationSchema).max(10_000);

const startingConditions: z.ZodType<ExpeditionStartingConditions> = z.strictObject({
  mission: missionPreferencesSchema.optional(),
  inferenceLimits: inferenceLimitsSchema.optional(),
  scenario: z.strictObject({
    id: identity, name: text, width: integer.positive().max(100), depth: integer.positive().max(100), base: position, sensorRange: number,
    dustStorm: z.strictObject({ ...stormFields, durationMs: number.positive() }).optional(),
    obstacles: z.array(position).max(10_000), roughTerrain: z.array(position).max(10_000),
    samples: z.array(z.strictObject({ id: identity, label: text, position, properties: z.array(text).max(100),
      classifications: z.strictObject({ 'past-water': classification, 'unusual-minerals': classification }),
    })).max(100),
  }).refine(scenario => {
    const cells = [scenario.base, ...scenario.obstacles, ...scenario.roughTerrain, ...scenario.samples.map(sample => sample.position)];
    return cells.every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x < scenario.width && cell.z < scenario.depth)
      && new Set(scenario.samples.map(sample => sample.id)).size === scenario.samples.length;
  }),
  objective, instructions, rubric, durationMs: number.positive(), fixedStepMs: number.positive(),
  travelTimeMs: z.strictObject({ plain: number.positive(), rough: number.positive() }),
  movementEnergy: z.strictObject({ plain: number, rough: number }), rechargePerSecond: number.positive(),
  batteryCapacity: number.positive(), initialBattery: number, waitMs: number.positive(), inspectMs: number.positive(), collectMs: number.positive(),
  cargoCapacity: z.literal(2), controller,
});

const decision: z.ZodType<Decision> = z.strictObject({
  accounting: accountingSchema.optional(),
  id: integer.positive(), controller, reason, input: controllerInputSchema,
  status: z.enum(['pending', 'applied', 'discarded', 'invalid', 'failed']),
  action: recordedActionSchema.optional(), selectedCandidateId: identity.optional(), latencyMs: number.optional(),
  inferenceAttempts: integer.max(INFERENCE_LIMIT),
  probabilities: z.record(identity, number.max(1)).optional(), confidence: number.max(1).optional(), failure: failureSchema.optional(),
}).refine(value => {
  if (value.controller === 'baseline' && (value.probabilities || value.confidence !== undefined || value.inferenceAttempts !== 0)) return false;
  if (value.status !== 'applied') return !value.action && !value.selectedCandidateId;
  const selected = value.input.candidates.find(candidate => candidate.id === value.selectedCandidateId);
  if (!selected || !sameRecordData(selected, value.action) || value.failure) return false;
  if (value.controller === 'typesafe' || value.probabilities) {
    return !!validChoice({ type: 'choice', choice: value.selectedCandidateId, confidence: value.confidence, probabilities: value.probabilities }, value.input);
  }
  return true;
});

const eventFields = { sequence: integer, expedition: integer.positive(), atMs: number };
const event: z.ZodType<ExpeditionEvent> = z.discriminatedUnion('type', [
  z.strictObject({ ...eventFields, type: z.literal('mission-changed'), mission: missionRevisionSchema }),
  z.strictObject({ ...eventFields, type: z.literal('mission-applied'), version: integer }),
  z.strictObject({ ...eventFields, type: z.literal('storm-introduced'), storm }),
  z.strictObject({ ...eventFields, type: z.literal('storm-detected'), storm: observationSchema.options[2] }),
  z.strictObject({ ...eventFields, type: z.literal('storm-expired'), stormId: identity, detected: z.boolean() }),
  z.strictObject({ ...eventFields, type: z.literal('storm-effects-changed'), sensorRange: number, movementEnergyMultiplier: number.min(1) }),
  z.strictObject({ ...eventFields, type: z.literal('controller-selected'), controller }),
  z.strictObject({ ...eventFields, type: z.literal('controller-changed'), from: controller, to: controller, failure: failureSchema.optional(), usagePause: usagePauseSchema.optional() }),
  z.strictObject({ ...eventFields, type: z.literal('inference-limits-changed'), limits: inferenceLimitsSchema }),
  z.strictObject({ ...eventFields, type: z.literal('usage-acknowledged'), attemptIds: z.array(z.uuid()).min(1).max(20_000) }),
  z.strictObject({ ...eventFields, type: z.literal('usage-paused'), pause: usagePauseSchema }),
  z.strictObject({ ...eventFields, type: z.literal('inference-continued') }),
  z.strictObject({ ...eventFields, type: z.literal('inference-attempt'), decisionId: integer.positive(), attempt: integer.positive().max(Number.MAX_SAFE_INTEGER), controller, submission: submissionSchema.optional() }),
  z.strictObject({ ...eventFields, type: z.literal('inference-accounted'), evidence: attemptEvidenceSchema }),
  z.strictObject({ ...eventFields, type: z.literal('decision-settled'), decision }),
  z.strictObject({ ...eventFields, type: z.literal('instructions-changed'), instructions, version: integer }),
  z.strictObject({ ...eventFields, type: z.literal('energy-changed'), source: z.enum(['movement', 'recharge']), battery: number, energyUsed: number }),
  z.strictObject({ ...eventFields, type: z.enum(['created', 'started', 'paused', 'resumed']) }),
  z.strictObject({ ...eventFields, type: z.literal('reset'), instructions }),
  z.strictObject({ ...eventFields, type: z.literal('objective-selected'), objective, rubric }),
  z.strictObject({ ...eventFields, type: z.literal('sample-inspected'), sample: observationSchema.options[3] }),
  z.strictObject({ ...eventFields, type: z.literal('sample-collected'), sample: cargoSample }),
  z.strictObject({ ...eventFields, type: z.literal('samples-delivered'), samples: z.array(deliveredSample).max(2), scienceScore: number }),
  z.strictObject({ ...eventFields, type: z.literal('speed-changed'), speed }),
  z.strictObject({ ...eventFields, type: z.literal('discovered'), observations }),
  z.strictObject({ ...eventFields, type: z.literal('decision-requested'), decision }),
  z.strictObject({ ...eventFields, type: z.enum(['decision-discarded', 'decision-invalid']), decisionId: integer.positive() }),
  z.strictObject({ ...eventFields, type: z.literal('decision-made'), input: controllerInputSchema, action: recordedActionSchema, controller,
    decisionId: integer.positive(), selectedCandidateId: identity, latencyMs: number, inferenceAttempts: integer.max(INFERENCE_LIMIT),
    probabilities: z.record(identity, number.max(1)).optional(), confidence: number.max(1).optional() }),
  z.strictObject({ ...eventFields, type: z.enum(['action-started', 'action-completed', 'action-cancelled']), action: recordedActionSchema, controller }),
  z.strictObject({ ...eventFields, type: z.literal('ended'), condition: ending }),
]);

const results: z.ZodType<ExpeditionSnapshot> = z.strictObject({
  mission: missionStateSchema.optional(),
  inferenceLimits: inferenceLimitsSchema.optional(), acknowledgedAttemptIds: z.array(z.uuid()).max(20_000).optional(),
  usagePause: usagePauseSchema.nullable().optional(),
  usage: inferenceUsageSchema.optional(),
  stormIntroduced: z.boolean(), stormAvailable: z.boolean(), controller, controllerHistory: history,
  inferenceAttempts: integer.max(Number.MAX_SAFE_INTEGER), inferenceLatencyMs: number, decisionFailure: failureSchema.nullable(),
  instructions, instructionsVersion: integer, decisionPending: z.literal(false), reconsiderationReason: z.null(), decisionRevision: integer,
  battery: number, batteryCapacity: number.positive(), energyUsed: number, objective, rubric,
  cargo: z.array(cargoSample).max(2), cargoCapacity: z.literal(2), deliveredSamples: z.array(deliveredSample).max(100),
  scienceScore: number, discoveryCount: integer, inspectionCount: integer, status: z.literal('ended'),
  durationMs: number.positive(), elapsedMs: number, remainingMs: number, speed,
  rover: z.strictObject({ position, heading: z.number().finite(), distance: number }), currentAction: z.null(), endingCondition: ending,
  exploredTargetIds: z.array(identity).max(10_000), area: z.strictObject({ id: identity, name: text, width: integer.positive(), depth: integer.positive() }),
  sensorRange: number, observations, memory: observations,
});

const recordSchema: z.ZodType<ExpeditionRecord> = z.strictObject({
  format: z.literal('roverlab-expedition'), version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), id: z.uuid(), completedAt: z.iso.datetime(),
  startingConditions, events: z.array(event).min(1).max(100_000), decisions: z.array(decision).max(10_000), results,
}).refine(record => {
  const { results: final, startingConditions: start, decisions, events } = record;
  const ended = events.filter(event => event.type === 'ended');
  return ended.length === 1 && ended[0]!.condition === final.endingCondition && ended[0]!.atMs === final.elapsedMs
    && events.some(event => event.type === 'started')
    && new Set(events.map(event => event.expedition)).size === 1
    && events.every((event, index) => event.atMs <= final.elapsedMs && (index === 0 || event.sequence > events[index - 1]!.sequence))
    && final.durationMs === start.durationMs && final.elapsedMs + final.remainingMs === final.durationMs
    && final.battery <= final.batteryCapacity && final.batteryCapacity === start.batteryCapacity
    && final.area.id === start.scenario.id && final.area.width === start.scenario.width && final.area.depth === start.scenario.depth
    && final.controllerHistory.at(-1)?.controller === final.controller
    && final.scienceScore === final.deliveredSamples.reduce((sum, sample) => sum + sample.score, 0)
    && final.deliveredSamples.every(sample => sample.score === final.rubric[sample.classification])
    && new Set([...final.cargo, ...final.deliveredSamples].map(sample => sample.sampleId)).size === final.cargo.length + final.deliveredSamples.length
    && decisions.every((decision, index) => decision.id === index + 1 && decision.status !== 'pending'
      && decision.input.objective === final.objective && decision.input.atMs <= final.elapsedMs)
    && final.inferenceAttempts === decisions.reduce((sum, decision) => sum + decision.inferenceAttempts, 0)
    && Math.abs(final.inferenceLatencyMs - decisions.filter(decision => decision.controller === 'typesafe').reduce((sum, decision) => sum + (decision.latencyMs ?? 0), 0)) < 0.001;
}).refine(record => {
  const requested = record.events.flatMap(event => event.type === 'decision-requested' || event.type === 'decision-settled' ? [event.decision] : []);
  if (record.version === 1) return !record.results.usage && [...record.decisions, ...requested].every(item => !item.accounting)
    && record.events.every(event => event.type !== 'inference-accounted' && (event.type !== 'inference-attempt' || !event.submission));
  if (!record.results.usage || !sameRecordData(record.results.usage, summarizeUsage(record.decisions))) return false;
  const identities = new Set<string>();
  return [...record.decisions, ...requested].every(decision => decision.controller === 'typesafe'
    ? decision.accounting?.expeditionId === record.id : !decision.accounting)
    && record.decisions.every(decision => {
      if (!decision.accounting) return decision.inferenceAttempts === 0;
      return decision.accounting.attempts.length === decision.inferenceAttempts
        && decision.accounting.attempts.every(({ submission }, index) => {
          const { identity } = submission;
          if (identity.expeditionId !== record.id || identity.decisionId !== decision.id
            || identities.has(identity.attemptId) || submission.retryIndex !== index) return false;
          identities.add(identity.attemptId);
          return true;
        });
    });
}).refine(record => {
  const newEvents = ['inference-limits-changed', 'usage-acknowledged', 'usage-paused', 'inference-continued'];
  if (record.version < 4) return !record.startingConditions.inferenceLimits && !record.results.inferenceLimits
    && record.results.acknowledgedAttemptIds === undefined && record.results.usagePause === undefined
    && record.results.inferenceAttempts <= INFERENCE_LIMIT
    && record.events.every(event => !newEvents.includes(event.type) && (event.type !== 'controller-changed' || !event.usagePause))
    && record.decisions.every(decision => decision.failure !== 'usage-paused');
  return !!record.startingConditions.inferenceLimits && !!record.results.inferenceLimits
    && record.results.acknowledgedAttemptIds !== undefined && record.results.usagePause !== undefined
    && record.decisions.every(decision => decision.inferenceAttempts <= 2);
}).refine(record => {
  const inputs = [...record.decisions.map(decision => decision.input), ...record.events.flatMap(event =>
    event.type === 'decision-requested' || event.type === 'decision-settled' ? [event.decision.input]
      : event.type === 'decision-made' ? [event.input] : [])];
  if (record.version < 5) return !record.startingConditions.mission && !record.results.mission
    && inputs.every(input => !input.mission)
    && record.events.every(event => event.type !== 'mission-changed' && event.type !== 'mission-applied');
  return !!record.startingConditions.mission && !!record.results.mission && inputs.every(input => !!input.mission)
    && record.startingConditions.instructions === missionInstructions(record.startingConditions.mission);
}).refine(hasConsistentHistory);

export const MAX_RECORD_BYTES = 32 * 1024 * 1024;
export function validateExpeditionRecord(value: unknown): ExpeditionRecord {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid expedition record. Choose a complete RoverLab version 1, 2, 3, 4, or 5 JSON export with valid history and results.');
  return parsed.data;
}
export function importExpeditionRecord(json: string): ExpeditionRecord {
  if (new TextEncoder().encode(json).length > MAX_RECORD_BYTES) throw new Error('This expedition record is too large. The limit is 32 MB.');
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new Error('Invalid JSON. Choose an expedition JSON file exported by RoverLab.'); }
  return validateExpeditionRecord(value);
}
export function exportExpeditionRecord(record: ExpeditionRecord): string {
  return JSON.stringify(validateExpeditionRecord(record));
}
