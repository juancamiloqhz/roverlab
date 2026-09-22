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
export type TerrainObservation = Observed & { kind: 'terrain'; terrain: Terrain; blocked: boolean };
export type SampleObservation = Observed & {
  kind: 'sample'; sampleId: string; label: string; status: 'available' | 'cargo' | 'delivered';
  properties?: string[]; inspectedAtMs?: number;
};
// Presentation-only world truth. Never part of a snapshot or controller input.
export type FullWorldView = {
  terrain: Pick<TerrainObservation, 'id' | 'position' | 'terrain' | 'blocked'>[];
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
  id: 'baseline' | 'scripted' | 'typesafe';
  decide(input: ControllerInput, context: { signal: AbortSignal; reserveAttempt(retryIndex?: 0 | 1): AttemptIdentity | null; reportAttempt(evidence: AttemptEvidence): void }): string | Promise<string | DecisionOutcome>;
};
export type ControllerHistoryEntry = { controller: ExpeditionController['id']; atMs: number; firstDecisionId: number };
export type DecisionReason = 'start' | 'action-completed' | 'instructions-changed' | 'new-observations' | 'storm-detected' | 'storm-expired' | 'retry' | 'controller-changed';
export type Decision = {
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
  | { type: 'start' | 'pause' | 'resume' | 'reset' | 'stop' | 'retry-decision' | 'continue-with-baseline' | 'introduce-storm' }
  | { type: 'set-instructions'; instructions: string }
  | { type: 'set-objective'; objective: ScientificObjective }
  | { type: 'set-controller'; controller: 'baseline' | 'typesafe' }
  | { type: 'set-speed'; speed: PlaybackSpeed };
export type ExpeditionSnapshot = {
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
  | { type: 'storm-introduced'; storm: DustStorm }
  | { type: 'storm-detected'; storm: StormObservation }
  | { type: 'storm-expired'; stormId: string; detected: boolean }
  | { type: 'storm-effects-changed'; sensorRange: number; movementEnergyMultiplier: number }
  | { type: 'controller-selected'; controller: ExpeditionController['id'] }
  | { type: 'controller-changed'; from: ExpeditionController['id']; to: ExpeditionController['id']; failure: DecisionFailure }
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
  | { type: 'decision-made'; input: ControllerInput; action: Action; controller: ExpeditionController['id']; decisionId: number; selectedCandidateId: string; latencyMs: number; inferenceAttempts: number; probabilities?: Record<string, number>; confidence?: number }
  | { type: 'action-started' | 'action-completed' | 'action-cancelled'; action: Action; controller: ExpeditionController['id'] }
  | { type: 'ended'; condition: EndingCondition };
export type ExpeditionEvent = EventDetail & { sequence: number; expedition: number; atMs: number };

export type ExpeditionStartingConditions = {
  scenario: Scenario; objective: ScientificObjective; instructions: string; rubric: ScienceRubric;
  durationMs: number; fixedStepMs: number; travelTimeMs: Record<Terrain, number>;
  rechargePerSecond: number; batteryCapacity: number; initialBattery: number; movementEnergy: Record<Terrain, number>;
  waitMs: number; inspectMs: number; collectMs: number; cargoCapacity: number; controller: ExpeditionController['id'];
};
export type ExpeditionRecord = {
  format: 'roverlab-expedition'; version: 1 | 2; id: string; completedAt: string;
  startingConditions: ExpeditionStartingConditions;
  events: ExpeditionEvent[]; decisions: Decision[]; results: ExpeditionSnapshot;
};
