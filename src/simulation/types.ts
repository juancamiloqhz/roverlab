export type Position = { x: number; z: number };
export type ScientificObjective = 'past-water' | 'unusual-minerals';
export type SampleClassification = 'unrelated' | 'suggestive' | 'strong-evidence';
export type ScienceRubric = Record<SampleClassification, number>;
export type CargoSample = { sampleId: string; label: string };
export type DeliveredSample = CargoSample & { classification: SampleClassification; score: number; deliveredAtMs: number };
export type ExplorationTarget = { id: string; label: string; position: Position };
export type Scenario = {
  id: string;
  name: string;
  width: number;
  depth: number;
  base: Position;
  sensorRange: number;
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
export type Observation = TerrainObservation
  | (Observed & { kind: 'base' })
  | SampleObservation;
type TargetedAction<Kind> = {
  kind: Kind; target: ExplorationTarget; routeEstimate: { distanceCells: number; durationMs: number; energy: number };
};
export type Action =
  | TargetedAction<'explore'> | TargetedAction<'inspect'> | TargetedAction<'collect'> | TargetedAction<'return-to-base'>
  | { kind: 'recharge'; durationMs: number }
  | { kind: 'wait'; durationMs: number };
export type ControllerInput = {
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
  candidates: Action[];
  previousAction: Action | null;
};
export type PlaybackSpeed = 1 | 2 | 4;
export type EndingCondition = 'timeout' | 'manual-stop' | 'stranded';
export type ExpeditionCommand =
  | { type: 'start' | 'pause' | 'resume' | 'reset' | 'stop' }
  | { type: 'set-objective'; objective: ScientificObjective }
  | { type: 'set-speed'; speed: PlaybackSpeed };
export type ExpeditionSnapshot = {
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
  | { type: 'energy-changed'; source: 'movement' | 'recharge'; battery: number; energyUsed: number }
  | { type: 'created' | 'started' | 'paused' | 'resumed' | 'reset' }
  | { type: 'objective-selected'; objective: ScientificObjective; rubric: ScienceRubric }
  | { type: 'sample-inspected'; sample: SampleObservation }
  | { type: 'sample-collected'; sample: CargoSample }
  | { type: 'samples-delivered'; samples: DeliveredSample[]; scienceScore: number }
  | { type: 'speed-changed'; speed: PlaybackSpeed }
  | { type: 'discovered'; observations: Observation[] }
  | { type: 'decision-made'; input: ControllerInput; action: Action; controller: 'baseline' }
  | { type: 'action-started' | 'action-completed' | 'action-cancelled'; action: Action; controller: 'baseline' }
  | { type: 'ended'; condition: EndingCondition };
export type ExpeditionEvent = EventDetail & { sequence: number; expedition: number; atMs: number };
