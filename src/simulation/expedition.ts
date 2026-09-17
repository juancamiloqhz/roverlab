import { chooseBaselineAction } from '../controllers/baseline';
import { findRoute } from './navigation';
import { authoredScenario } from './scenario';
import type { Action, EndingCondition, EventDetail, ExpeditionCommand, ExpeditionEvent, ExpeditionSnapshot, Position } from './types';

const STEP_MS = 100;
const DURATION_MS = 300_000;
const CELL_TRAVEL_MS = 4_000;
const WAIT_MS = 5_000;

export function createExpedition() {
  const scenario = structuredClone(authoredScenario);
  const startingConditions = {
    scenario, durationMs: DURATION_MS, fixedStepMs: STEP_MS,
    cellTravelMs: CELL_TRAVEL_MS, waitMs: WAIT_MS, controller: 'baseline' as const,
  };
  const events: ExpeditionEvent[] = [];
  let expedition = 1;
  let state: ExpeditionSnapshot = initialState();
  let pendingMs = 0;
  let previousAction: Action | null = null;
  let route: Position[] = [];
  let actionProgressMs = 0;
  let waypointStart = { ...scenario.base };

  function initialState(): ExpeditionSnapshot {
    return {
      status: 'ready', durationMs: DURATION_MS, elapsedMs: 0, remainingMs: DURATION_MS, speed: 1,
      rover: { position: { ...scenario.base }, heading: 0, distance: 0 },
      currentAction: null, endingCondition: null, exploredTargetIds: [],
    };
  }

  function record(detail: EventDetail) {
    events.push({ ...structuredClone(detail), sequence: events.length, expedition, atMs: state.elapsedMs });
  }

  function selectAction() {
    const candidates: Action[] = scenario.explorationTargets
      .filter(target => !state.exploredTargetIds.includes(target.id))
      .filter(target => findRoute(scenario, state.rover.position, target.position) !== null)
      .map(target => ({ kind: 'explore', target }));
    candidates.push({ kind: 'wait', durationMs: WAIT_MS });
    const action = chooseBaselineAction(candidates, previousAction);
    state.currentAction = action;
    actionProgressMs = 0;
    if (action.kind === 'explore') {
      route = findRoute(scenario, state.rover.position, action.target.position)!;
      waypointStart = { ...state.rover.position };
    }
    record({ type: 'action-started', action, controller: 'baseline' });
  }

  function finish(condition: EndingCondition) {
    if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: 'baseline' });
    state.currentAction = null;
    state.status = 'ended';
    state.endingCondition = condition;
    pendingMs = 0;
    record({ type: 'ended', condition });
  }

  function tick() {
    state.elapsedMs += STEP_MS;
    state.remainingMs = DURATION_MS - state.elapsedMs;
    const action = state.currentAction!;
    actionProgressMs += STEP_MS;
    let completed = false;
    if (action.kind === 'wait') {
      completed = actionProgressMs >= action.durationMs;
    } else {
      const waypoint = route[0];
      if (waypoint) {
        const fraction = actionProgressMs / CELL_TRAVEL_MS;
        state.rover.position = {
          x: waypointStart.x + (waypoint.x - waypointStart.x) * fraction,
          z: waypointStart.z + (waypoint.z - waypointStart.z) * fraction,
        };
        state.rover.heading = Math.atan2(waypoint.x - waypointStart.x, waypoint.z - waypointStart.z);
        state.rover.distance += STEP_MS / CELL_TRAVEL_MS;
        if (actionProgressMs >= CELL_TRAVEL_MS) {
          state.rover.position = { ...waypoint };
          waypointStart = { ...waypoint };
          route.shift();
          actionProgressMs = 0;
        }
      }
      completed = route.length === 0;
      if (completed) state.exploredTargetIds.push(action.target.id);
    }
    if (completed) {
      record({ type: 'action-completed', action, controller: 'baseline' });
      previousAction = action;
      state.currentAction = null;
    }
    if (state.remainingMs === 0) finish('timeout');
    else if (completed) selectAction();
  }

  record({ type: 'created' });

  return {
    getSnapshot: () => structuredClone(state),
    getRecord: () => structuredClone({ startingConditions, events }),
    dispatch(command: ExpeditionCommand) {
      if (command.type === 'start' && state.status === 'ready') {
        state.status = 'running';
        record({ type: 'started' });
        selectAction();
      } else if (command.type === 'pause' && state.status === 'running') {
        state.status = 'paused';
        record({ type: 'paused' });
      } else if (command.type === 'resume' && state.status === 'paused') {
        state.status = 'running';
        record({ type: 'resumed' });
      } else if (command.type === 'stop' && (state.status === 'running' || state.status === 'paused')) {
        finish('manual-stop');
      } else if (command.type === 'set-speed' && state.status !== 'ended' && state.speed !== command.speed) {
        state.speed = command.speed;
        record({ type: 'speed-changed', speed: command.speed });
      } else if (command.type === 'reset') {
        if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: 'baseline' });
        expedition++;
        state = initialState();
        pendingMs = 0;
        previousAction = null;
        route = [];
        actionProgressMs = 0;
        waypointStart = { ...scenario.base };
        record({ type: 'reset' });
      }
    },
    // Wall time is supplied by a scheduler, never by rendering or camera frames.
    advanceWallTime(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Wall time must be finite and non-negative.');
      if (state.status !== 'running') return;
      pendingMs += deltaMs * state.speed;
      while (pendingMs + 1e-7 >= STEP_MS && state.status === 'running') {
        pendingMs -= STEP_MS;
        tick();
      }
    },
  };
}

export type ExpeditionSession = ReturnType<typeof createExpedition>;
