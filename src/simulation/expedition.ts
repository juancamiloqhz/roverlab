import { chooseBaselineAction } from '../controllers/baseline';
import { findRoute, movementEnergy, positionKey, travelTimeMs } from './navigation';
import { explorationCandidates, knownTerrain, observe, scienceCandidates } from './perception';
import { authoredScenario } from './scenario';
import { scienceRubric } from './science';
import type { Action, ControllerInput, EndingCondition, EventDetail, ExpeditionCommand, ExpeditionEvent, ExpeditionSnapshot, Position, Scenario, ScientificObjective } from './types';

const STEP_MS = 100;
const DURATION_MS = 300_000;
const WAIT_MS = 5_000;
const INSPECT_MS = 6_000;
const COLLECT_MS = 4_000;
const RECHARGE_PER_SECOND = 5;
const roundEnergy = (value: number) => Math.round(value * 1e9) / 1e9;

export function createExpedition(options: { scenario?: Scenario; objective?: ScientificObjective } = {}) {
  const scenario = structuredClone(options.scenario ?? authoredScenario);
  let objective = options.objective ?? 'past-water';
  const startingConditions = {
    scenario, objective, rubric: structuredClone(scienceRubric), durationMs: DURATION_MS, fixedStepMs: STEP_MS,
    travelTimeMs: { plain: travelTimeMs('plain'), rough: travelTimeMs('rough') },
    rechargePerSecond: RECHARGE_PER_SECOND, batteryCapacity: 100, initialBattery: 100, movementEnergy: { plain: movementEnergy('plain'), rough: movementEnergy('rough') },
    waitMs: WAIT_MS, inspectMs: INSPECT_MS, collectMs: COLLECT_MS, cargoCapacity: 2, controller: 'baseline' as const,
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
      battery: 100, batteryCapacity: 100, energyUsed: 0,
      objective, rubric: structuredClone(scienceRubric), cargo: [], cargoCapacity: 2,
      deliveredSamples: [], scienceScore: 0, discoveryCount: 0, inspectionCount: 0,
      status: 'ready', durationMs: DURATION_MS, elapsedMs: 0, remainingMs: DURATION_MS, speed: 1,
      rover: { position: { ...scenario.base }, heading: 0, distance: 0 },
      currentAction: null, endingCondition: null, exploredTargetIds: [],
      area: { id: scenario.id, name: scenario.name, width: scenario.width, depth: scenario.depth },
      sensorRange: scenario.sensorRange, observations: [], memory: [],
    };
  }

  function record(detail: EventDetail) {
    events.push({ ...structuredClone(detail), sequence: events.length, expedition, atMs: state.elapsedMs });
  }

  function selectAction() {
    const candidates = [
      ...explorationCandidates(state.memory, state.rover.position, state.area),
      ...scienceCandidates(state.memory, state.rover.position, state.cargo, state.cargoCapacity),
    ].filter(action => state.battery > 0 || !('target' in action) || action.routeEstimate.distanceCells === 0);
    if (positionKey(state.rover.position) === positionKey(scenario.base) && state.battery < state.batteryCapacity) {
      candidates.push({ kind: 'recharge', durationMs: Math.ceil((state.batteryCapacity - state.battery) / RECHARGE_PER_SECOND * 1_000 / STEP_MS) * STEP_MS });
    }
    candidates.push({ kind: 'wait', durationMs: WAIT_MS });
    const input: ControllerInput = structuredClone({
      battery: state.battery, batteryCapacity: state.batteryCapacity,
      atMs: state.elapsedMs, position: state.rover.position, sensorRange: state.sensorRange,
      objective: state.objective, cargo: state.cargo, cargoCapacity: state.cargoCapacity,
      observations: state.observations, memory: state.memory, candidates, previousAction,
    });
    const action = chooseBaselineAction(input);
    record({ type: 'decision-made', input, action, controller: 'baseline' });
    state.currentAction = action;
    actionProgressMs = 0;
    if ('target' in action) {
      route = findRoute(knownTerrain(state.memory), state.rover.position, action.target.position)!;
      waypointStart = { ...state.rover.position };
    }
    record({ type: 'action-started', action, controller: 'baseline' });
  }

  function sense() {
    const memory = new Map(state.memory.map(observation => [observation.id, observation]));
    state.observations = observe(scenario, state.rover.position, state.elapsedMs).flatMap(observation => {
      const remembered = memory.get(observation.id);
      if (observation.kind !== 'sample' || remembered?.kind !== 'sample') return [observation];
      if (remembered.status !== 'available') return [];
      return [{ ...remembered, observedAtMs: observation.observedAtMs }];
    });
    const discoveries = state.observations.filter(observation => !memory.has(observation.id));
    for (const observation of state.observations) memory.set(observation.id, observation);
    state.memory = [...memory.values()];
    state.discoveryCount = state.memory.filter(item => item.kind === 'sample').length;
    state.inspectionCount = state.memory.filter(item => item.kind === 'sample' && item.properties).length;
    if (discoveries.length) record({ type: 'discovered', observations: discoveries });
  }

  function completeInteraction(action: Extract<Action, { target: unknown }>): boolean {
    if (positionKey(state.rover.position) !== positionKey(action.target.position)) return false;
    if (action.kind === 'explore') {
      state.exploredTargetIds.push(action.target.id);
    } else if (action.kind === 'return-to-base') {
      if (positionKey(state.rover.position) !== positionKey(scenario.base)) return false;
      const samples = state.cargo.map(cargo => {
        const sample = scenario.samples.find(sample => sample.id === cargo.sampleId)!;
        const classification = sample.classifications[state.objective];
        return { ...cargo, classification, score: state.rubric[classification], deliveredAtMs: state.elapsedMs };
      });
      for (const sample of samples) {
        const memory = state.memory.find(item => item.kind === 'sample' && item.sampleId === sample.sampleId);
        if (memory?.kind === 'sample') memory.status = 'delivered';
      }
      state.deliveredSamples.push(...samples);
      state.scienceScore += samples.reduce((score, sample) => score + sample.score, 0);
      state.cargo = [];
      if (samples.length) record({ type: 'samples-delivered', samples, scienceScore: state.scienceScore });
    } else {
      const sample = scenario.samples.find(sample => sample.id === action.target.id);
      const memory = state.memory.find(item => item.kind === 'sample' && item.sampleId === action.target.id);
      if (!sample || memory?.kind !== 'sample' || memory.status !== 'available'
        || positionKey(sample.position) !== positionKey(state.rover.position)) return false;
      if (action.kind === 'inspect') {
        if (memory.properties) return false;
        memory.properties = [...sample.properties];
        memory.inspectedAtMs = state.elapsedMs;
        memory.observedAtMs = state.elapsedMs;
        record({ type: 'sample-inspected', sample: memory });
      } else {
        if (state.cargo.length >= state.cargoCapacity) return false;
        memory.status = 'cargo';
        const cargo = { sampleId: sample.id, label: sample.label };
        state.cargo.push(cargo);
        record({ type: 'sample-collected', sample: cargo });
      }
    }
    return true;
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
    } else if (action.kind === 'recharge') {
      state.battery = Math.min(state.batteryCapacity, roundEnergy(state.battery + RECHARGE_PER_SECOND * STEP_MS / 1_000));
      record({ type: 'energy-changed', source: 'recharge', battery: state.battery, energyUsed: state.energyUsed });
      completed = state.battery === state.batteryCapacity;
    } else {
      const waypoint = route[0];
      if (waypoint) {
        const cell = knownTerrain(state.memory).find(item => positionKey(item.position) === positionKey(waypoint))!;
        const cellTravelMs = travelTimeMs(cell.terrain);
        const consumed = Math.min(state.battery, movementEnergy(cell.terrain) * STEP_MS / cellTravelMs);
        const movementMs = consumed / movementEnergy(cell.terrain) * cellTravelMs;
        actionProgressMs -= STEP_MS - movementMs;
        const fraction = actionProgressMs / cellTravelMs;
        state.rover.position = {
          x: waypointStart.x + (waypoint.x - waypointStart.x) * fraction,
          z: waypointStart.z + (waypoint.z - waypointStart.z) * fraction,
        };
        state.rover.heading = Math.atan2(waypoint.x - waypointStart.x, waypoint.z - waypointStart.z);
        state.rover.distance += consumed / movementEnergy(cell.terrain);
        state.battery = roundEnergy(state.battery - consumed);
        state.energyUsed = roundEnergy(state.energyUsed + consumed);
        record({ type: 'energy-changed', source: 'movement', battery: state.battery, energyUsed: state.energyUsed });
        if (actionProgressMs >= cellTravelMs) {
          state.rover.position = { ...waypoint };
          waypointStart = { ...waypoint };
          route.shift();
          actionProgressMs = 0;
        }
      }
      if (state.battery === 0 && positionKey(state.rover.position) !== positionKey(scenario.base)) {
        sense();
        finish('stranded');
        return;
      }
      const interactionMs = action.kind === 'inspect' ? INSPECT_MS : action.kind === 'collect' ? COLLECT_MS : 0;
      completed = route.length === 0 && actionProgressMs >= interactionMs;
      if (completed && !completeInteraction(action)) {
        record({ type: 'action-cancelled', action, controller: 'baseline' });
        state.currentAction = null;
      }
    }
    sense();
    if (completed) {
      if (state.currentAction) record({ type: 'action-completed', action, controller: 'baseline' });
      previousAction = action;
      state.currentAction = null;
    }
    if (state.remainingMs === 0) finish('timeout');
    else if (completed) selectAction();
  }

  record({ type: 'created' });
  sense();

  return {
    getSnapshot: () => structuredClone(state),
    getRecord: () => structuredClone({ startingConditions, events }),
    dispatch(command: ExpeditionCommand) {
      if (command.type === 'set-objective' && state.status === 'ready' && command.objective !== state.objective) {
        objective = command.objective;
        state.objective = objective;
        record({ type: 'objective-selected', objective, rubric: state.rubric });
      } else if (command.type === 'start' && state.status === 'ready') {
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
        sense();
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
