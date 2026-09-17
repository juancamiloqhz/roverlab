export type Position = { x: number; z: number };
export type ExplorationTarget = { id: string; label: string; position: Position };
export type Scenario = {
  id: string;
  name: string;
  width: number;
  depth: number;
  base: Position;
  obstacles: Position[];
  explorationTargets: ExplorationTarget[];
};
export type Action =
  | { kind: 'explore'; target: ExplorationTarget }
  | { kind: 'wait'; durationMs: number };
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
};
export type EventDetail =
  | { type: 'created' | 'started' | 'paused' | 'resumed' | 'reset' }
  | { type: 'speed-changed'; speed: PlaybackSpeed }
  | { type: 'action-started' | 'action-completed' | 'action-cancelled'; action: Action; controller: 'baseline' }
  | { type: 'ended'; condition: EndingCondition };
export type ExpeditionEvent = EventDetail & { sequence: number; expedition: number; atMs: number };
