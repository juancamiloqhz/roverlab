export type Position = { x: number; z: number };
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
  samples: { id: string; label: string; position: Position; properties: string[] }[];
};
export type Terrain = 'plain' | 'rough';
type Observed = { id: string; position: Position; observedAtMs: number };
export type TerrainObservation = Observed & { kind: 'terrain'; terrain: Terrain; blocked: boolean };
export type Observation = TerrainObservation
  | (Observed & { kind: 'base' })
  | (Observed & { kind: 'sample'; sampleId: string; label: string });
export type Action =
  | { kind: 'explore'; target: ExplorationTarget; routeEstimate: { distanceCells: number; durationMs: number } }
  | { kind: 'wait'; durationMs: number };
export type ControllerInput = {
  atMs: number;
  position: Position;
  sensorRange: number;
  observations: Observation[];
  memory: Observation[];
  candidates: Action[];
  previousAction: Action | null;
};
export type PlaybackSpeed = 1 | 2 | 4;
export type EndingCondition = 'timeout' | 'manual-stop';
export type ExpeditionCommand =
  | { type: 'start' | 'pause' | 'resume' | 'reset' | 'stop' }
  | { type: 'set-speed'; speed: PlaybackSpeed };
export type ExpeditionSnapshot = {
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
  | { type: 'created' | 'started' | 'paused' | 'resumed' | 'reset' }
  | { type: 'speed-changed'; speed: PlaybackSpeed }
  | { type: 'discovered'; observations: Observation[] }
  | { type: 'decision-made'; input: ControllerInput; action: Action; controller: 'baseline' }
  | { type: 'action-started' | 'action-completed' | 'action-cancelled'; action: Action; controller: 'baseline' }
  | { type: 'ended'; condition: EndingCondition };
export type ExpeditionEvent = EventDetail & { sequence: number; expedition: number; atMs: number };
