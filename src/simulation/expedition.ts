import { chooseBaselineAction } from '../controllers/baseline';
import { INFERENCE_LIMIT, MAX_MISSION_INSTRUCTIONS_LENGTH, type DecisionOutcome } from '../../shared/decisions';
import { findRoute, movementEnergy, positionKey, travelCost, travelTimeMs } from './navigation';
import { explorationCandidates, knownTerrain, observe, scienceCandidates } from './perception';
import { authoredScenario } from './scenario';
import { knownStorm } from './storm';
import { scienceRubric } from './science';
import type { Action, ActionCandidate, ControllerInput, Decision, DustStorm, ExpeditionController, EndingCondition, EventDetail, ExpeditionCommand, ExpeditionEvent, ExpeditionSnapshot, ExpeditionRecord, ExpeditionStartingConditions, FullWorldView, Position, Scenario, ScientificObjective } from './types';

const STEP_MS = 100;
const DURATION_MS = 300_000;
const WAIT_MS = 5_000;
const INSPECT_MS = 6_000;
const COLLECT_MS = 4_000;
const RECHARGE_PER_SECOND = 5;
const roundEnergy = (value: number) => Math.round(value * 1e9) / 1e9;

export function createExpedition(options: { scenario?: Scenario; objective?: ScientificObjective; controller?: ExpeditionController; typesafeController?: ExpeditionController } = {}) {
  const scenario = structuredClone(options.scenario ?? authoredScenario);
  // Reuse the world's terrain projection without installing it in rover knowledge.
  const fullTerrain = observe(scenario, scenario.base, 0, Infinity)
    .filter(item => item.kind === 'terrain')
    .map(({ id, position, terrain, blocked }) => ({ id, position, terrain, blocked }));
  let objective = options.objective ?? 'past-water';
  let instructions = '';
  const baseline: ExpeditionController = { id: 'baseline', decide: input => chooseBaselineAction(input).id };
  let controller = options.controller ?? baseline;
  let decisions: Decision[] = [];
  const decisionListeners = new Set<() => void>();
  let inFlight: { decision: Decision; expedition: number; abort: AbortController } | null = null;
  const startingConditions: ExpeditionStartingConditions = {
    scenario, objective, instructions, rubric: structuredClone(scienceRubric), durationMs: DURATION_MS, fixedStepMs: STEP_MS,
    travelTimeMs: { plain: travelTimeMs('plain'), rough: travelTimeMs('rough') },
    rechargePerSecond: RECHARGE_PER_SECOND, batteryCapacity: 100, initialBattery: 100, movementEnergy: { plain: movementEnergy('plain'), rough: movementEnergy('rough') },
    waitMs: WAIT_MS, inspectMs: INSPECT_MS, collectMs: COLLECT_MS, cargoCapacity: 2, controller: controller.id,
  };
  let runStartingConditions = startingConditions;
  const completedRecords: ExpeditionRecord[] = [];
  const completionListeners = new Set<(record: ExpeditionRecord) => void>();
  const pendingCompletions = new Map<number, Omit<ExpeditionRecord, 'events'>>();
  const events: ExpeditionEvent[] = [];
  let expedition = 1;
  let storm: DustStorm | null = null;
  let movementEnergyMultiplier = 1;
  let state: ExpeditionSnapshot = initialState();
  let pendingMs = 0;
  let previousAction: Action | null = null;
  let route: Position[] = [];
  let actionProgressMs = 0;
  let waypointStart = { ...scenario.base };

  function initialState(): ExpeditionSnapshot {
    return {
      stormIntroduced: false, stormAvailable: !!scenario.dustStorm,
      controller: controller.id, inferenceAttempts: 0, inferenceLatencyMs: 0, decisionFailure: null,
      controllerHistory: [{ controller: controller.id, atMs: 0, firstDecisionId: 1 }],
      instructions, instructionsVersion: 0, decisionRevision: 0, reconsiderationReason: null, decisionPending: inFlight !== null,
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

  function availableCandidates(): ActionCandidate[] {
    const candidates = [
      ...explorationCandidates(state.memory, state.rover.position, state.area, state.elapsedMs),
      ...scienceCandidates(state.memory, state.rover.position, state.cargo, state.cargoCapacity, state.elapsedMs),
    ].filter(action => state.battery > 0 || !('target' in action) || action.routeEstimate.distanceCells === 0);
    if (positionKey(state.rover.position) === positionKey(scenario.base) && state.battery < state.batteryCapacity) {
      candidates.push({ kind: 'recharge', durationMs: Math.ceil((state.batteryCapacity - state.battery) / RECHARGE_PER_SECOND * 1_000 / STEP_MS) * STEP_MS });
    }
    candidates.push({ kind: 'wait', durationMs: WAIT_MS });
    return candidates.map(action => ({ ...action, id: `${action.kind}:${'target' in action ? action.target.id + (action.routeMode ? ':avoid-storm' : '') : action.durationMs}` }));
  }

  function selectAction() {
    if (inFlight || state.status !== 'running' || state.currentAction || state.decisionFailure) return;
    const input: ControllerInput = structuredClone({
      instructions: state.instructions, instructionsVersion: state.instructionsVersion,
      battery: state.battery, batteryCapacity: state.batteryCapacity,
      energyUsed: state.energyUsed, remainingMs: state.remainingMs,
      atMs: state.elapsedMs, position: state.rover.position, sensorRange: state.sensorRange,
      objective: state.objective, cargo: state.cargo, cargoCapacity: state.cargoCapacity,
      observations: state.observations, memory: state.memory, candidates: availableCandidates(), previousAction,
    });
    const decision: Decision = { reason: state.reconsiderationReason ?? 'action-completed', id: decisions.length + 1, input, controller: controller.id, status: 'pending', inferenceAttempts: 0 };
    state.reconsiderationReason = null;
    decisions.push(decision);
    state.decisionRevision++;
    const request = { decision, expedition, abort: new AbortController() };
    inFlight = request;
    state.decisionPending = true;
    record({ type: 'decision-requested', decision });
    const requestedAt = performance.now();
    try {
      const result = controller.decide(structuredClone(input), {
        signal: request.abort.signal,
        reserveAttempt() {
          if (request !== inFlight || request.abort.signal.aborted || state.inferenceAttempts >= INFERENCE_LIMIT) return false;
          state.inferenceAttempts++;
          decision.inferenceAttempts++;
          state.decisionRevision++;
          record({ type: 'inference-attempt', decisionId: decision.id, attempt: state.inferenceAttempts, controller: decision.controller });
          return true;
        },
      });
      if (typeof result === 'string') applyDecision(result, 0);
      else {
        // Discard the remainder of a scheduler batch at the asynchronous boundary.
        // It must never be replayed as catch-up after a pending decision.
        pendingMs %= STEP_MS;
        const settle = (id: string | DecisionOutcome | null) => {
          applyDecision(id, performance.now() - requestedAt);
          // Let the wall-time scheduler reset its anchor at the exact end of the freeze.
          for (const listener of decisionListeners) listener();
        };
        result.then(settle, () => settle(null));
      }
    } catch {
      applyDecision(null, 0);
    }
  }

  function applyDecision(result: string | DecisionOutcome | null, latencyMs: number) {
    const request = inFlight!;
    const decision = request.decision;
    inFlight = null;
    state.decisionPending = false;
    decision.latencyMs = latencyMs;
    const settledState = request.expedition === expedition ? state
      : pendingCompletions.get(request.expedition)?.results;
    if (settledState) {
      settledState.decisionPending = false;
      settledState.decisionRevision++;
      if (decision.controller === 'typesafe') settledState.inferenceLatencyMs += latencyMs;
    }
    if (request.expedition !== expedition || decision.input.instructionsVersion !== state.instructionsVersion
      || state.status === 'ended' || state.status === 'ready' || decision.status === 'discarded') {
      events.push({ type: 'decision-settled', decision: structuredClone(decision), expedition: request.expedition, atMs: decision.input.atMs, sequence: events.length });
      completeRecord();
      selectAction();
      return;
    }
    const outcome: DecisionOutcome = typeof result === 'string' ? { selectedCandidateId: result } : result ?? { failure: 'invalid-output' };
    const candidateId = outcome.selectedCandidateId;
    decision.probabilities = outcome.probabilities;
    decision.confidence = outcome.confidence;
    // Only the simulator's complete candidate is executable; never trust controller-owned objects.
    const offered = decision.input.candidates.find(candidate => candidate.id === candidateId);
    const action = availableCandidates().find(candidate => candidate.id === candidateId);
    if (outcome.failure || !offered || !action || JSON.stringify(offered) !== JSON.stringify(action)) {
      state.decisionRevision++;
      decision.failure = outcome.failure ?? 'invalid-output';
      decision.status = decision.failure === 'invalid-output' ? 'invalid' : 'failed';
      decision.latencyMs = latencyMs;
      state.status = 'paused';
      state.decisionFailure = decision.failure;
      record({ type: 'decision-invalid', decisionId: decision.id });
      record({ type: 'decision-settled', decision });
      return;
    }
    state.decisionRevision++;
    decision.status = 'applied';
    decision.selectedCandidateId = action.id;
    decision.action = action;
    decision.latencyMs = latencyMs;
    record({ type: 'decision-made', input: decision.input, action, controller: controller.id,
      decisionId: decision.id, selectedCandidateId: action.id, latencyMs, inferenceAttempts: decision.inferenceAttempts,
      probabilities: decision.probabilities, confidence: decision.confidence });
    state.currentAction = action;
    actionProgressMs = 0;
    route = [];
    if ('target' in action) {
      route = findRoute(knownTerrain(state.memory), state.rover.position, action.target.position, action.routeMode === 'avoid-storm' ? knownStorm(state.memory) : undefined)!;
      waypointStart = { ...state.rover.position };
    }
    record({ type: 'action-started', action, controller: controller.id });
  }

  function invalidateDecision() {
    if (inFlight && inFlight.decision.status === 'pending') {
      state.decisionRevision++;
      inFlight.decision.status = 'discarded';
      record({ type: 'decision-discarded', decisionId: inFlight.decision.id });
      inFlight.abort.abort();
    }
  }

  function resumeAfterDecisionFailure(reason: 'retry' | 'controller-changed') {
    state.decisionFailure = null;
    state.status = 'running';
    state.reconsiderationReason = reason;
    record({ type: 'resumed' });
    selectAction();
  }

  function reconsiderAtWaypoint() {
    if (!state.reconsiderationReason || !state.currentAction) return;
    // Inspection, collection, and bounded waiting finish first. Travel and recharge
    // can be interrupted while stationary, but never part-way through a grid edge.
    if (state.currentAction.kind !== 'recharge' && !('target' in state.currentAction && actionProgressMs === 0)) return;
    record({ type: 'action-cancelled', action: state.currentAction, controller: controller.id });
    state.currentAction = null;
    route = [];
    selectAction();
  }

  function sense() {
    const memory = new Map(state.memory.map(observation => [observation.id, observation]));
    if (storm && state.elapsedMs >= storm.expiresAtMs) {
      const detected = memory.has(storm.id);
      record({ type: 'storm-expired', stormId: storm.id, detected });
      if (detected) state.reconsiderationReason = 'storm-expired';
      storm = null;
    }
    // A disclosed expiry is predictable even out of range; do not refresh last-seen time.
    for (const observation of memory.values()) {
      if (observation.kind === 'dust-storm') observation.remainingMs = Math.max(0, observation.expiresAtMs - state.elapsedMs);
    }
    const distanceToStorm = storm ? Math.hypot(state.rover.position.x - storm.position.x, state.rover.position.z - storm.position.z) : Infinity;
    const insideStorm = storm && distanceToStorm <= storm.radius;
    const sensorRange = storm && insideStorm ? Math.min(scenario.sensorRange, storm.sensorRange) : scenario.sensorRange;
    const multiplier = storm && insideStorm ? storm.movementEnergyMultiplier : 1;
    if (sensorRange !== state.sensorRange || multiplier !== movementEnergyMultiplier) {
      record({ type: 'storm-effects-changed', sensorRange, movementEnergyMultiplier: multiplier });
    }
    state.sensorRange = sensorRange;
    movementEnergyMultiplier = multiplier;
    state.observations = observe(scenario, state.rover.position, state.elapsedMs, state.sensorRange).flatMap(observation => {
      const remembered = memory.get(observation.id);
      if (observation.kind !== 'sample' || remembered?.kind !== 'sample') return [observation];
      if (remembered.status !== 'available') return [];
      return [{ ...remembered, observedAtMs: observation.observedAtMs }];
    });
    if (storm && distanceToStorm <= storm.radius + state.sensorRange) {
      const observation = { ...storm, kind: 'dust-storm' as const, observedAtMs: state.elapsedMs, remainingMs: storm.expiresAtMs - state.elapsedMs };
      state.observations.push(observation);
      if (!memory.has(storm.id)) {
        record({ type: 'storm-detected', storm: observation });
        invalidateDecision();
        state.reconsiderationReason = 'storm-detected';
      }
    }
    const discoveries = state.observations.filter(observation => !memory.has(observation.id));
    for (const observation of state.observations) memory.set(observation.id, observation);
    state.memory = [...memory.values()];
    state.discoveryCount = state.memory.filter(item => item.kind === 'sample').length;
    state.inspectionCount = state.memory.filter(item => item.kind === 'sample' && item.properties).length;
    if (discoveries.length) {
      record({ type: 'discovered', observations: discoveries });
      if (state.currentAction && !state.reconsiderationReason) state.reconsiderationReason = 'new-observations';
    }
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
    invalidateDecision();
    state.reconsiderationReason = null;
    if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: controller.id });
    state.currentAction = null;
    state.status = 'ended';
    state.endingCondition = condition;
    pendingMs = 0;
    record({ type: 'ended', condition });
    // Hold these run-owned references until any cancelled inference has settled,
    // even if mission control resets before its latency becomes available.
    pendingCompletions.set(expedition, {
      format: 'roverlab-expedition', version: 1, id: crypto.randomUUID(), completedAt: new Date().toISOString(),
      startingConditions: runStartingConditions, decisions, results: state,
    });
    completeRecord();
  }

  function completeRecord() {
    for (const [completedExpedition, completed] of pendingCompletions) {
      if (inFlight?.expedition === completedExpedition) continue;
      const record = structuredClone({ ...completed, events: events.filter(event => event.expedition === completedExpedition) });
      record.results.decisionPending = false;
      pendingCompletions.delete(completedExpedition);
      completedRecords.push(record);
      for (const listener of completionListeners) listener(structuredClone(record));
    }
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
        const start = state.rover.position;
        const positionAfter = (movementMs: number) => ({
          x: waypointStart.x + (waypoint.x - waypointStart.x) * (actionProgressMs - STEP_MS + movementMs) / cellTravelMs,
          z: waypointStart.z + (waypoint.z - waypointStart.z) * (actionProgressMs - STEP_MS + movementMs) / cellTravelMs,
        });
        const energyFor = (movementMs: number) => travelCost(start, positionAfter(movementMs), cell.terrain, state.elapsedMs - STEP_MS, storm).energy;
        let movementMs = STEP_MS;
        const consumed = Math.min(state.battery, roundEnergy(energyFor(STEP_MS)));
        if (consumed < roundEnergy(energyFor(STEP_MS))) {
          // Solve distance at depletion, including a storm boundary within this step.
          let low = 0, high = STEP_MS;
          for (let iteration = 0; iteration < 40; iteration++) {
            const middle = (low + high) / 2;
            if (energyFor(middle) <= consumed) low = middle;
            else high = middle;
          }
          movementMs = low;
        }
        state.rover.position = positionAfter(movementMs);
        actionProgressMs -= STEP_MS - movementMs;
        state.rover.heading = Math.atan2(waypoint.x - waypointStart.x, waypoint.z - waypointStart.z);
        state.rover.distance += movementMs / cellTravelMs;
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
        record({ type: 'action-cancelled', action, controller: controller.id });
        state.currentAction = null;
      }
    }
    sense();
    if (completed) {
      if (state.currentAction) record({ type: 'action-completed', action, controller: controller.id });
      previousAction = action;
      state.currentAction = null;
    }
    if (state.remainingMs === 0) finish('timeout');
    else if (completed) selectAction();
    else reconsiderAtWaypoint();
  }

  record({ type: 'created' });
  sense();

  return {
    getSnapshot: () => structuredClone(state),
    getCompletedRecords: () => structuredClone(completedRecords),
    onExpeditionCompleted(listener: (record: ExpeditionRecord) => void) {
      completionListeners.add(listener);
      return () => { completionListeners.delete(listener); };
    },
    getFullWorldView(): FullWorldView {
      const removed = new Set([...state.cargo, ...state.deliveredSamples].map(sample => sample.sampleId));
      return structuredClone({
        terrain: fullTerrain, base: scenario.base, storm,
        samples: scenario.samples.filter(sample => !removed.has(sample.id))
          .map(sample => ({ id: `sample:${sample.id}`, label: sample.label, position: sample.position })),
      });
    },
    getDecisions: () => structuredClone(decisions),
    onDecisionSettled(listener: () => void) {
      decisionListeners.add(listener);
      return () => { decisionListeners.delete(listener); };
    },
    getRecord: () => structuredClone({ startingConditions, events, results: {
      controller: state.controller, controllerHistory: state.controllerHistory, inferenceAttempts: state.inferenceAttempts, inferenceLatencyMs: state.inferenceLatencyMs,
      endingCondition: state.endingCondition, scienceScore: state.scienceScore, energyUsed: state.energyUsed,
      discoveryCount: state.discoveryCount, inspectionCount: state.inspectionCount,
    } }),
    dispatch(command: ExpeditionCommand) {
      if (command.type === 'set-instructions' && command.instructions.length > MAX_MISSION_INSTRUCTIONS_LENGTH) {
        throw new RangeError('Mission instructions must be 20,000 characters or fewer.');
      }
      if (command.type === 'introduce-storm' && scenario.dustStorm && !state.stormIntroduced && state.status !== 'ended') {
        const { durationMs, ...configuration } = scenario.dustStorm;
        storm = { ...structuredClone(configuration), id: 'dust-storm', expiresAtMs: state.elapsedMs + durationMs };
        state.stormIntroduced = true;
        record({ type: 'storm-introduced', storm });
        sense();
        reconsiderAtWaypoint();
        selectAction();
      } else if (command.type === 'set-instructions' && state.status !== 'ended' && command.instructions !== instructions) {
        instructions = command.instructions;
        state.instructions = instructions;
        state.instructionsVersion++;
        invalidateDecision();
        state.reconsiderationReason = 'instructions-changed';
        record({ type: 'instructions-changed', instructions, version: state.instructionsVersion });
        reconsiderAtWaypoint();
        selectAction();
      } else if (command.type === 'set-controller' && state.status === 'ready') {
        const next = command.controller === 'baseline' ? baseline : options.typesafeController;
        if (next && next.id !== controller.id) {
          controller = next;
          state.controller = controller.id;
          state.controllerHistory = [{ controller: controller.id, atMs: 0, firstDecisionId: 1 }];
          record({ type: 'controller-selected', controller: controller.id });
        }
      } else if (command.type === 'set-objective' && state.status === 'ready' && command.objective !== state.objective) {
        objective = command.objective;
        state.objective = objective;
        record({ type: 'objective-selected', objective, rubric: state.rubric });
      } else if (command.type === 'start' && state.status === 'ready') {
        state.status = 'running';
        record({ type: 'started' });
        state.reconsiderationReason = 'start';
        selectAction();
      } else if (command.type === 'pause' && state.status === 'running') {
        state.status = 'paused';
        record({ type: 'paused' });
      } else if (command.type === 'retry-decision' && state.status === 'paused' && state.decisionFailure
        && controller.id === 'typesafe' && !inFlight && state.inferenceAttempts < INFERENCE_LIMIT) {
        resumeAfterDecisionFailure('retry');
      } else if (command.type === 'continue-with-baseline' && state.status === 'paused' && state.decisionFailure
        && controller.id === 'typesafe' && !inFlight) {
        record({ type: 'controller-changed', from: controller.id, to: baseline.id, failure: state.decisionFailure });
        controller = baseline;
        state.controller = controller.id;
        state.controllerHistory.push({ controller: controller.id, atMs: state.elapsedMs, firstDecisionId: decisions.length + 1 });
        resumeAfterDecisionFailure('controller-changed');
      } else if (command.type === 'resume' && state.status === 'paused' && !state.decisionFailure) {
        state.status = 'running';
        record({ type: 'resumed' });
        selectAction();
      } else if (command.type === 'stop' && (state.status === 'running' || state.status === 'paused')) {
        finish('manual-stop');
      } else if (command.type === 'set-speed' && state.status !== 'ended' && state.speed !== command.speed) {
        state.speed = command.speed;
        record({ type: 'speed-changed', speed: command.speed });
      } else if (command.type === 'reset') {
        invalidateDecision();
        if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: controller.id });
        expedition++;
        runStartingConditions = { ...startingConditions, objective, instructions, controller: controller.id };
        decisions = [];
        storm = null;
        movementEnergyMultiplier = 1;
        state = initialState();
        pendingMs = 0;
        previousAction = null;
        route = [];
        actionProgressMs = 0;
        waypointStart = { ...scenario.base };
        record({ type: 'reset', instructions });
        sense();
      }
    },
    // Wall time is supplied by a scheduler, never by rendering or camera frames.
    advanceWallTime(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Wall time must be finite and non-negative.');
      if (state.status !== 'running' || state.decisionPending) return;
      pendingMs += deltaMs * state.speed;
      while (pendingMs + 1e-7 >= STEP_MS && state.status === 'running' && !state.decisionPending) {
        pendingMs -= STEP_MS;
        tick();
      }
    },
  };
}

export type ExpeditionSession = ReturnType<typeof createExpedition>;
