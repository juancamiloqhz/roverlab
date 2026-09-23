import type { Intervention, InterventionSchedule, InterventionState } from './interventions';
import type { DecisionBoundary, DecisionTrigger } from '../../shared/cadence';
import type { MissionPreferences, MissionRevision, MissionState, MissionPresetId } from '../../shared/mission';
import type { BaselineEvidence } from '../../shared/baseline';
import type { InferenceLimits, UsagePause } from '../../shared/limits';
import type { AttemptEvidence, AttemptIdentity, DecisionAccounting, InferenceSubmission, InferenceUsage } from '../../shared/inference';
import type { DecisionFailure, DecisionOutcome } from '../../shared/decisions';

export type Position = { x: number; z: number };
export type ScientificObjective = 'past-water' | 'unusual-minerals';
export type SampleClassification = 'unrelated' | 'suggestive' | 'strong-evidence';
export type ScienceRubric = Record<SampleClassification, number>;
export type CargoSample = { sampleId: string; label: string };
export type DeliveredSample = CargoSample & { classification: SampleClassification; score: number; deliveredAtMs: number };
export type ExplorationTarget = { id: string; label: string; position: Position };
export type DustStormConfiguration = {
  position: Position; radius: number; durationMs: number; sensorRange: number; movementEnergyMultiplier: number;
};
export type DustStorm = Omit<DustStormConfiguration, 'durationMs'> & { id: string; expiresAtMs: number };
export type StormObservation = DustStorm & { kind: 'dust-storm'; observedAtMs: number; remainingMs: number };
export type Scenario = {
  id: string;
  name: string;
  width: number;
  depth: number;
  base: Position;
  sensorRange: number;
  regions?: { name: string; min: Position; max: Position }[];
  durationMs?: number;
  batteryCapacity?: number;
  dustStorm?: DustStormConfiguration;
  obstacles: Position[];
  roughTerrain: Position[];
  samples: {
    id: string; label: string; position: Position; properties: string[];
    classifications: Record<ScientificObjective, SampleClassification>;
  }[];
};
export type Terrain = 'plain' | 'rough';
type Observed = { id: string; position: Position; observedAtMs: number };
export type TerrainObservation = Observed & { kind: 'terrain'; terrain: Terrain; blocked: boolean; region?: string };
export type SampleObservation = Observed & {
  kind: 'sample'; sampleId: string; label: string; status: 'available' | 'cargo' | 'delivered';
  properties?: string[]; inspectedAtMs?: number;
};
// Presentation-only world truth. Never part of a snapshot or controller input.
export type FullWorldView = {
  terrain: Pick<TerrainObservation, 'id' | 'position' | 'terrain' | 'blocked' | 'region'>[];
  samples: Pick<SampleObservation, 'id' | 'label' | 'position'>[];
  base: Position;
  storm: DustStorm | null;
};
export type Observation = TerrainObservation
  | (Observed & { kind: 'base' })
  | SampleObservation | StormObservation;
type TargetedAction<Kind> = {
  kind: Kind; target: ExplorationTarget; routeMode?: 'avoid-storm';
  routeEstimate: { distanceCells: number; durationMs: number; energy: number; stormDistanceCells?: number };
};
export type Action =
  | TargetedAction<'explore'> | TargetedAction<'inspect'> | TargetedAction<'collect'> | TargetedAction<'return-to-base'>
  | { kind: 'recharge'; durationMs: number }
  | { kind: 'wait'; durationMs: number };
export type ActionCandidate = Action & { id: string };
export type ExpeditionController = {
  readAttempt?: (identity: AttemptIdentity) => Promise<AttemptEvidence | null>;
  id: 'baseline' | 'scripted' | 'typesafe';
  decide(input: ControllerInput, context: { signal: AbortSignal; reserveAttempt(retryIndex?: 0 | 1): AttemptIdentity | null; reportAttempt(evidence: AttemptEvidence): void }): string | DecisionOutcome | Promise<string | DecisionOutcome>;
};
export type ControllerHistoryEntry = { controller: ExpeditionController['id']; atMs: number; firstDecisionId: number };
export type DecisionReason = DecisionTrigger | 'new-observations';
export type Decision = {
  baselineAlternative?: { action: ActionCandidate; evidence: BaselineEvidence };
  baseline?: BaselineEvidence;
  accounting?: DecisionAccounting;
  reason: DecisionReason;
  id: number; controller: ExpeditionController['id'];
  input: ControllerInput; status: 'pending' | 'applied' | 'discarded' | 'invalid' | 'failed';
  action?: Action;
  selectedCandidateId?: string;
  latencyMs?: number;
  inferenceAttempts: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  failure?: DecisionFailure;
};
export type ControllerInput = {
  decisionBoundary?: DecisionBoundary;
  mission?: MissionRevision;
  remainingMs: number;
  energyUsed: number;
  instructions: string;
  instructionsVersion: number;
  battery: number;
  batteryCapacity: number;
  objective: ScientificObjective;
  cargo: CargoSample[];
  cargoCapacity: number;
  atMs: number;
  position: Position;
  sensorRange: number;
  observations: Observation[];
  memory: Observation[];
  candidates: ActionCandidate[];
  previousAction: Action | null;
};
export type PlaybackSpeed = 1 | 2 | 4;
export type EndingCondition = 'timeout' | 'manual-stop' | 'stranded';
export type ExpeditionCommand =
  | { type: 'set-intervention-schedule'; schedule: InterventionSchedule }
  | { type: 'set-teaching-mode'; enabled: boolean }
  | { type: 'inspect-decision'; decisionId: number }
  | { type: 'end-inspection' | 'continue-choice' }
  | { type: 'start' | 'pause' | 'resume' | 'reset' | 'stop' | 'retry-decision' | 'continue-with-baseline' | 'introduce-storm' }
  | { type: 'set-inference-limits'; limits: InferenceLimits }
  | { type: 'acknowledge-usage'; attemptIds: string[] }
  | { type: 'continue-inference' }
  | { type: 'set-mission-preset'; preset: MissionPresetId }
  | { type: 'set-instructions'; instructions: string }
  | { type: 'set-objective'; objective: ScientificObjective }
  | { type: 'set-controller'; controller: 'baseline' | 'typesafe' }
  | { type: 'set-speed'; speed: PlaybackSpeed };
export type ExpeditionSnapshot = {
  interventions?: InterventionState;
  teachingMode?: boolean;
  inspectionDecisionId?: number | null;
  heldDecisionId?: number | null;
  mission?: MissionState;
  inferenceLimits?: InferenceLimits;
  acknowledgedAttemptIds?: string[];
  usagePause?: UsagePause | null;
  usage?: InferenceUsage;
  stormIntroduced: boolean;
  stormAvailable: boolean;
  controller: ExpeditionController['id'];
  controllerHistory: ControllerHistoryEntry[];
  inferenceAttempts: number;
  inferenceLatencyMs: number;
  decisionFailure: DecisionFailure | null;
  instructions: string;
  instructionsVersion: number;
  decisionPending: boolean;
  reconsiderationReason: DecisionReason | null;
  decisionRevision: number;
  battery: number;
  batteryCapacity: number;
  energyUsed: number;
  objective: ScientificObjective;
  rubric: ScienceRubric;
  cargo: CargoSample[];
  cargoCapacity: number;
  deliveredSamples: DeliveredSample[];
  scienceScore: number;
  discoveryCount: number;
  inspectionCount: number;
  status: 'ready' | 'running' | 'paused' | 'ended';
  durationMs: number;
  elapsedMs: number;
  remainingMs: number;
  speed: PlaybackSpeed;
  rover: { position: Position; heading: number; distance: number };
  currentAction: Action | null;
  endingCondition: EndingCondition | null;
  exploredTargetIds: string[];
  area: { id: string; name: string; width: number; depth: number };
  sensorRange: number;
  observations: Observation[];
  memory: Observation[];
};
export type EventDetail =
  | { type: 'intervention-schedule-selected'; schedule: InterventionSchedule }
  | { type: 'intervention-requested'; intervention: Intervention; source: 'scheduled' | 'manual'; missionVersion?: number }
  | { type: 'teaching-changed'; enabled: boolean }
  | { type: 'decision-inspected' | 'decision-held'; decisionId: number }
  | { type: 'inspection-ended' }
  | { type: 'held-decision-cleared'; decisionId: number; reason: 'executed' | 'invalidated' }
  | { type: 'mission-changed'; mission: MissionRevision }
  | { type: 'mission-applied'; version: number }
  | { type: 'storm-introduced'; storm: DustStorm }
  | { type: 'storm-detected'; storm: StormObservation }
  | { type: 'storm-expired'; stormId: string; detected: boolean }
  | { type: 'storm-effects-changed'; sensorRange: number; movementEnergyMultiplier: number }
  | { type: 'controller-selected'; controller: ExpeditionController['id'] }
  | { type: 'controller-changed'; from: ExpeditionController['id']; to: ExpeditionController['id']; failure?: DecisionFailure; usagePause?: UsagePause }
  | { type: 'inference-limits-changed'; limits: InferenceLimits }
  | { type: 'usage-acknowledged'; attemptIds: string[] }
  | { type: 'usage-paused'; pause: UsagePause }
  | { type: 'inference-continued' }
  | { type: 'inference-attempt'; decisionId: number; attempt: number; controller: ExpeditionController['id']; submission?: InferenceSubmission }
  | { type: 'inference-accounted'; evidence: AttemptEvidence }
  | { type: 'decision-settled'; decision: Decision }
  | { type: 'instructions-changed'; instructions: string; version: number }
  | { type: 'energy-changed'; source: 'movement' | 'recharge'; battery: number; energyUsed: number }
  | { type: 'created' | 'started' | 'paused' | 'resumed' }
  | { type: 'reset'; instructions: string }
  | { type: 'objective-selected'; objective: ScientificObjective; rubric: ScienceRubric }
  | { type: 'sample-inspected'; sample: SampleObservation }
  | { type: 'sample-collected'; sample: CargoSample }
  | { type: 'samples-delivered'; samples: DeliveredSample[]; scienceScore: number }
  | { type: 'speed-changed'; speed: PlaybackSpeed }
  | { type: 'discovered'; observations: Observation[] }
  | { type: 'decision-requested'; decision: Decision }
  | { type: 'decision-discarded' | 'decision-invalid'; decisionId: number }
  | { type: 'decision-made'; input: ControllerInput; action: Action; controller: ExpeditionController['id']; decisionId: number; selectedCandidateId: string; latencyMs: number; inferenceAttempts: number; probabilities?: Record<string, number>; confidence?: number; baseline?: BaselineEvidence }
  | { type: 'action-started' | 'action-completed' | 'action-cancelled'; action: Action; controller: ExpeditionController['id'] }
  | { type: 'ended'; condition: EndingCondition };
export type ExpeditionEvent = EventDetail & { sequence: number; expedition: number; atMs: number };

export type ExpeditionStartingConditions = {
  interventionSchedule?: InterventionSchedule;
  simulationVersion?: 'grid-expedition-v1';
  decisionCadence?: 'meaningful-boundaries-v1';
  mission?: MissionPreferences;
  inferenceLimits?: InferenceLimits;
  scenario: Scenario; objective: ScientificObjective; instructions: string; rubric: ScienceRubric;
  durationMs: number; fixedStepMs: number; travelTimeMs: Record<Terrain, number>;
  rechargePerSecond: number; batteryCapacity: number; initialBattery: number; movementEnergy: Record<Terrain, number>;
  waitMs: number; inspectMs: number; collectMs: number; cargoCapacity: number; controller: ExpeditionController['id'];
};
export type ExpeditionRecord = {
  matchedFrom?: { recordId: string; recordVersion: number; scheduleBasis: 'recorded' | 'reconstructed-legacy' };
  format: 'roverlab-expedition'; version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; id: string; completedAt: string;
  startingConditions: ExpeditionStartingConditions;
  events: ExpeditionEvent[]; decisions: Decision[]; results: ExpeditionSnapshot;
};
