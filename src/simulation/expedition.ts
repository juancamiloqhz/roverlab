import { benchmarkScenario, type BenchmarkId } from './benchmarks';
import { compareInterventions, interventionPhase, captureIntervention, emptyInterventionSchedule, interventionScheduleSchema, type Intervention, type InterventionSchedule } from './interventions';
import { DECISION_CADENCE, type DecisionTrigger } from '../../shared/cadence';
import { missionInstructions, missionPreset, type MissionPreferences } from '../../shared/mission';
import { defaultInferenceLimits, inferenceGuard, inferenceLimitsSchema } from '../../shared/limits';
import { canUpdateEvidence, sameAttempt, summarizeUsage, type AttemptEvidence } from '../../shared/inference';
import { chooseBaselineDecision } from '../controllers/baseline';
import { INFERENCE_LIMIT, MAX_MISSION_INSTRUCTIONS_LENGTH, type DecisionOutcome } from '../../shared/decisions';
import { findRoute, movementEnergy, positionKey, travelCost, travelTimeMs } from './navigation';
import { explorationCandidates, knownTerrain, observe, scienceCandidates } from './perception';
import { authoredScenario } from './scenario';
import { knownStorm } from './storm';
import { scienceRubric } from './science';
import { validateExpeditionRecord } from '../records/contract';
import { sameRecordData } from '../records/history';
import { recordedSchedule } from '../records/matching';
import type { Action, ActionCandidate, ControllerInput, Decision, DustStorm, ExpeditionController, EndingCondition, EventDetail, ExpeditionCommand, ExpeditionEvent, ExpeditionSnapshot, ExpeditionRecord, ExpeditionStartingConditions, FullWorldView, PlaybackSpeed, Position, Scenario, ScientificObjective } from './types';

const STEP_MS = 100;
const WAIT_MS = 5_000;
const INSPECT_MS = 6_000;
const COLLECT_MS = 4_000;
const RECHARGE_PER_SECOND = 5;
const roundEnergy = (value: number) => Math.round(value * 1e9) / 1e9;

type ExpeditionOptions = { benchmark?: BenchmarkId; interventionSchedule?: InterventionSchedule; wallNow?: () => number; scenario?: Scenario; objective?: ScientificObjective; controller?: ExpeditionController; typesafeController?: ExpeditionController };
type MatchedSource = { start: ExpeditionStartingConditions; provenance: NonNullable<ExpeditionRecord['matchedFrom']> };

export function createExpedition(options: ExpeditionOptions = {}) {
  return createSimulation(options).session;
}

class ReplayHistory {
  private cursor = 0;
  constructor(readonly source: ExpeditionRecord) {}
  get next() { return this.source.events[this.cursor]; }
  get afterNext() { return this.source.events[this.cursor + 1]; }
  accept(event: ExpeditionEvent) {
    if (!sameRecordData(event, this.next)) {
      throw new Error(`Cannot replay this expedition: recorded history differs at event ${this.next?.sequence ?? 'end'} (${this.next?.type ?? event.type}).`);
    }
    this.cursor++;
  }
}

function createSimulation(options: ExpeditionOptions, replay?: ReplayHistory, matched?: MatchedSource) {
  const selectedBenchmark = options.benchmark ? benchmarkScenario(options.benchmark) : undefined;
  const benchmark = replay?.source.startingConditions.benchmark ?? matched?.start.benchmark ?? selectedBenchmark?.benchmark;
  const meaningfulBoundaries = replay ? !!replay.source.startingConditions.decisionCadence
    : matched ? !!matched.start.decisionCadence : true;
  const scenario = structuredClone(replay?.source.startingConditions.scenario ?? options.scenario ?? selectedBenchmark?.scenario ?? authoredScenario);
  const versionedSettings = !replay || replay.source.version >= 8;
  const durationMs = versionedSettings ? scenario.durationMs ?? 300_000 : 300_000;
  const initialSchedule = interventionScheduleSchema.parse(replay?.source.startingConditions.interventionSchedule ?? options.interventionSchedule ?? selectedBenchmark?.interventionSchedule ?? emptyInterventionSchedule());
  validateSchedule(initialSchedule);
  let batchingInterventions = false;
  const batteryCapacity = versionedSettings ? scenario.batteryCapacity ?? 100 : 100;
  // Reuse the world's terrain projection without installing it in rover knowledge.
  const fullTerrain = observe(scenario, scenario.base, 0, Infinity)
    .filter(item => item.kind === 'terrain')
    .map(({ id, position, terrain, blocked, region }) => ({ id, position, terrain, blocked, ...(region ? { region } : {}) }));
  let objective = replay?.source.startingConditions.objective ?? options.objective ?? selectedBenchmark?.objective ?? 'past-water';
  let instructions = replay?.source.startingConditions.instructions ?? matched?.start.instructions ?? '';
  let mission: MissionPreferences = structuredClone(replay?.source.startingConditions.mission ?? matched?.start.mission ?? selectedBenchmark?.mission ?? { mode: 'free-text', instructions });
  const baseline: ExpeditionController = { id: 'baseline', decide: input => {
    const selected = chooseBaselineDecision(input);
    return { selectedCandidateId: selected.action.id, baseline: selected.evidence };
  } };
  const recordedController = (id: ExpeditionController['id']): ExpeditionController => ({ id, decide() {
    throw new Error('Replay cannot request a live controller decision.');
  } });
  let controller = replay ? recordedController(replay.source.startingConditions.controller) : options.controller ?? baseline;
  let decisions: Decision[] = [];
  const decisionListeners = new Set<() => void>();
  const usageReads: (() => Promise<void>)[] = [];
  let refreshingUsage: Promise<void> | null = null;
  const usageListeners = new Set<() => void>();
  let inFlight: { decision: Decision; expedition: number; abort: AbortController } | null = null;
  const startingConditions: ExpeditionStartingConditions = {
    ...(benchmark ? { benchmark: structuredClone(benchmark) } : {}),
    ...(!replay || replay.source.version >= 11 ? { interventionSchedule: initialSchedule } : {}),
    ...(versionedSettings ? { simulationVersion: 'grid-expedition-v1' as const } : {}),
    ...(meaningfulBoundaries ? { decisionCadence: DECISION_CADENCE } : {}),
    ...(!replay || replay.source.version >= 5 ? { mission: structuredClone(mission) } : {}),
    ...(!replay || replay.source.version >= 4 ? { inferenceLimits: structuredClone(replay?.source.startingConditions.inferenceLimits ?? defaultInferenceLimits) } : {}),
    scenario, objective, instructions, rubric: structuredClone(scienceRubric), durationMs, fixedStepMs: STEP_MS,
    travelTimeMs: { plain: travelTimeMs('plain'), rough: travelTimeMs('rough') },
    rechargePerSecond: RECHARGE_PER_SECOND, batteryCapacity, initialBattery: batteryCapacity, movementEnergy: { plain: movementEnergy('plain'), rough: movementEnergy('rough') },
    waitMs: WAIT_MS, inspectMs: INSPECT_MS, collectMs: COLLECT_MS, cargoCapacity: 2, controller: controller.id,
  };
  if (replay && !sameRecordData(startingConditions, replay.source.startingConditions)) {
    throw new Error('Cannot replay this expedition: its simulation settings are not supported by this version of RoverLab.');
  }
  let runStartingConditions = startingConditions;
  const completedRecords: ExpeditionRecord[] = [];
  const completionListeners = new Set<(record: ExpeditionRecord) => void>();
  const pendingCompletions = new Map<number, Omit<ExpeditionRecord, 'events'>>();
  const events: ExpeditionEvent[] = [];
  let expedition = 1;
  let expeditionId = replay?.source.id ?? crypto.randomUUID();
  const wallNow = options.wallNow ?? (() => performance.now());
  let storm: DustStorm | null = null;
  let movementEnergyMultiplier = 1;
  let state: ExpeditionSnapshot = initialState();
  // Inspection after completion is presentation state, never part of the saved
  // result or of a late accounting update to that result.
  let completedInspectionId: number | null = null;
  let pendingMs = 0;
  let previousAction: Action | null = null;
  let actionController = controller.id;
  let route: Position[] = [];
  let actionProgressMs = 0;
  const pendingTriggers = new Set<DecisionTrigger>();
  let resourceThresholds = new Set<DecisionTrigger>();
  let waypointStart = { ...scenario.base };

  function initialState(): ExpeditionSnapshot {
    const initialMission = { version: 0, preferences: structuredClone(mission) };
    return {
      ...(benchmark ? { benchmark: structuredClone(benchmark) } : {}),
      ...(startingConditions.interventionSchedule ? { interventions: { schedule: structuredClone(initialSchedule), history: [] } } : {}),
      ...(!replay || replay.source.version >= 9 ? { teachingMode: false, inspectionDecisionId: null, heldDecisionId: null } : {}),
      ...(startingConditions.mission ? { mission: { requested: structuredClone(initialMission), effective: structuredClone(initialMission),
        history: [{ ...structuredClone(initialMission), requestedAtMs: 0, appliedAtMs: 0 }] } } : {}),
      ...(startingConditions.inferenceLimits ? { inferenceLimits: structuredClone(startingConditions.inferenceLimits), acknowledgedAttemptIds: [], usagePause: null } : {}),
      ...(!replay || replay.source.version >= 2 ? { usage: summarizeUsage([]) } : {}),
      stormIntroduced: false, stormAvailable: !!scenario.dustStorm,
      controller: controller.id, inferenceAttempts: 0, inferenceLatencyMs: 0, decisionFailure: null,
      controllerHistory: [{ controller: controller.id, atMs: 0, firstDecisionId: 1 }],
      instructions, instructionsVersion: 0, decisionRevision: 0, reconsiderationReason: null, decisionPending: inFlight !== null,
      battery: batteryCapacity, batteryCapacity, energyUsed: 0,
      objective, rubric: structuredClone(scienceRubric), cargo: [], cargoCapacity: 2,
      deliveredSamples: [], scienceScore: 0, discoveryCount: 0, inspectionCount: 0,
      status: 'ready', durationMs, elapsedMs: 0, remainingMs: durationMs, speed: 1,
      rover: { position: { ...scenario.base }, heading: 0, distance: 0 },
      currentAction: null, endingCondition: null, exploredTargetIds: [],
      area: { id: scenario.id, name: scenario.name, width: scenario.width, depth: scenario.depth },
      sensorRange: scenario.sensorRange, observations: [], memory: [],
    };
  }

  function record(detail: EventDetail, atMs = state.elapsedMs, recordedExpedition = expedition) {
    const event = { ...structuredClone(detail), sequence: replay?.next?.sequence ?? events.length,
      expedition: replay?.next?.expedition ?? recordedExpedition, atMs };
    replay?.accept(event);
    events.push(event);
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

  function requestReconsideration(reason: DecisionTrigger) {
    if (!meaningfulBoundaries) { state.reconsiderationReason = reason; return; }
    if (state.status === 'ready' || state.status === 'ended') return;
    pendingTriggers.add(reason);
    state.reconsiderationReason = [...pendingTriggers][0]!;
  }

  function checkResourceThresholds() {
    if (!meaningfulBoundaries) return;
    const reached = new Set<DecisionTrigger>();
    if (state.cargo.length >= state.cargoCapacity) reached.add('cargo-full');
    const returns = scienceCandidates(state.memory, state.rover.position, state.cargo, state.cargoCapacity, state.elapsedMs)
      .filter(action => action.kind === 'return-to-base');
    if (returns.length) {
      const preferences = state.mission!.effective.preferences;
      const reserve = preferences.mode === 'preset' ? preferences.preset.settings.returnReserveEnergy
        : missionPreset('balanced').settings.returnReserveEnergy;
      if (state.battery <= Math.min(...returns.map(action => action.routeEstimate.energy)) + reserve) reached.add('battery-reserve');
      if (state.cargo.length && state.remainingMs <= Math.min(...returns.map(action => action.routeEstimate.durationMs)) + 15_000) reached.add('return-time');
    }
    for (const trigger of reached) if (!resourceThresholds.has(trigger)) requestReconsideration(trigger);
    resourceThresholds = reached;
  }

  function currentGuard() {
    return state.inferenceLimits ? inferenceGuard(decisions, state.inferenceLimits, state.acknowledgedAttemptIds!) : null;
  }

  function checkUsageGuard() {
    if (!state.inferenceLimits || controller.id !== 'typesafe' || state.status === 'ready' || state.status === 'ended') return false;
    const pause = currentGuard()!;
    if ((pause.reasons.length || state.usagePause) && !sameRecordData(state.usagePause, pause)) {
      state.usagePause = pause;
      state.status = 'paused';
      record({ type: 'usage-paused', pause });
    }
    return pause.reasons.length > 0;
  }

  function continueInference() {
    if (inFlight || !state.usagePause || checkUsageGuard()) return;
    state.usagePause = null;
    record({ type: 'inference-continued' });
    state.decisionFailure = null;
    state.status = viewingPause() ? 'paused' : 'running';
    if (!state.currentAction && !state.heldDecisionId && !state.reconsiderationReason) requestReconsideration('retry');
    record({ type: 'resumed' });
    if (state.status === 'running') executeHeldChoice();
    selectAction();
  }

  function applyMission() {
    const current = state.mission;
    if (!current || current.requested.version === current.effective.version || state.currentAction || inFlight?.expedition === expedition) return;
    current.effective = structuredClone(current.requested);
    current.history.at(-1)!.appliedAtMs = state.elapsedMs;
    record({ type: 'mission-applied', version: current.effective.version });
  }

  function changeMission(preferences: MissionPreferences) {
    if (state.status === 'ended' || (state.mission
      ? sameRecordData(preferences, state.mission.requested.preferences)
      : missionInstructions(preferences) === instructions)) return;
    mission = structuredClone(preferences);
    instructions = missionInstructions(mission);
    state.instructions = instructions;
    state.instructionsVersion++;
    invalidateDecision();
    requestReconsideration(mission.mode === 'free-text' ? 'instructions-changed' : 'mission-changed');
    if (state.mission) {
      state.mission.requested = { version: state.instructionsVersion, preferences: structuredClone(mission) };
      state.mission.history.push({ ...structuredClone(state.mission.requested), requestedAtMs: state.elapsedMs, appliedAtMs: null });
    }
    if (mission.mode === 'free-text') record({ type: 'instructions-changed', instructions, version: state.instructionsVersion });
    else record({ type: 'mission-changed', mission: state.mission!.requested });
    if (batchingInterventions) return;
    reconsiderAtWaypoint();
    applyMission();
    selectAction();
  }

  function validateSchedule(schedule: InterventionSchedule) {
    if (schedule.events.some(event => event.atMs > durationMs || (event.kind === 'storm'
      && (event.storm.position.x >= scenario.width || event.storm.position.z >= scenario.depth)))) {
      throw new RangeError('Interventions must fit the expedition duration and world.');
    }
  }

  function introduceStorm(configuration: NonNullable<Scenario['dustStorm']>) {
    const { durationMs, ...effects } = configuration;
    storm = { ...structuredClone(effects), id: 'dust-storm', expiresAtMs: state.elapsedMs + durationMs };
    state.stormIntroduced = true;
    record({ type: 'storm-introduced', storm });
    sense();
    if (!batchingInterventions) {
      reconsiderAtWaypoint();
      selectAction();
    }
  }

  function manualInterventionId() {
    let index = state.interventions!.schedule.events.length + 1;
    while (state.interventions!.schedule.events.some(event => event.id === `manual-${index}`)) index++;
    return `manual-${index}`;
  }

  function requestIntervention(intervention: Intervention, source: 'manual' | 'scheduled') {
    const interventions = state.interventions!;
    if (source === 'manual') {
      captureIntervention(interventions, intervention);
    }
    const revision = intervention.kind === 'mission' && !sameRecordData(intervention.mission, state.mission!.requested.preferences)
      ? { missionVersion: state.instructionsVersion + 1 } : {};
    interventions.history.push({ id: intervention.id, source, requestedAtMs: state.elapsedMs, ...revision });
    record({ type: 'intervention-requested', intervention, source, ...revision });
    if (intervention.kind === 'mission') changeMission(intervention.mission);
    else introduceStorm(intervention.storm);
  }

  function applyScheduledInterventions(phase: ReturnType<typeof interventionPhase> = 'before-choice') {
    if (!state.interventions) return;
    const { schedule, history } = state.interventions;
    batchingInterventions = phase === 'before-choice' || state.remainingMs === 0
      || (state.battery === 0 && positionKey(state.rover.position) !== positionKey(scenario.base));
    for (const intervention of schedule.events) {
      if (intervention.atMs === state.elapsedMs && interventionPhase(intervention) === phase && !history.some(item => item.id === intervention.id)) {
        requestIntervention(intervention, 'scheduled');
      }
    }
    batchingInterventions = false;
    applyMission();
  }

  function selectAction() {
    if (batchingInterventions || inFlight || state.status !== 'running' || state.currentAction || state.heldDecisionId || state.inspectionDecisionId || state.decisionFailure) return;
    if (checkUsageGuard()) return;
    if (replay && replay.next?.type !== 'decision-requested' && replay.next?.type !== 'mission-applied') return;
    applyMission();
    checkResourceThresholds();
    const input: ControllerInput = structuredClone({
      ...(meaningfulBoundaries ? { decisionBoundary: { version: DECISION_CADENCE, triggers: [...pendingTriggers] } } : {}),
      ...(state.mission ? { mission: state.mission.effective } : {}),
      instructions: state.instructions, instructionsVersion: state.instructionsVersion,
      battery: state.battery, batteryCapacity: state.batteryCapacity,
      energyUsed: state.energyUsed, remainingMs: state.remainingMs,
      atMs: state.elapsedMs, position: state.rover.position, sensorRange: state.sensorRange,
      objective: state.objective, cargo: state.cargo, cargoCapacity: state.cargoCapacity,
      observations: state.observations, memory: state.memory, candidates: availableCandidates(), previousAction,
    });
    const decision: Decision = { reason: state.reconsiderationReason ?? 'action-completed', id: decisions.length + 1, input, controller: controller.id, status: 'pending', inferenceAttempts: 0 };
    if (controller.id === 'typesafe') {
      if (!replay) decision.baselineAlternative = structuredClone(chooseBaselineDecision(structuredClone(input)));
      else if (replay.next?.type === 'decision-requested' && replay.next.decision.baselineAlternative) {
        decision.baselineAlternative = structuredClone(replay.next.decision.baselineAlternative);
      }
    }
    if (controller.id === 'typesafe' && (!replay || replay.source.version >= 2)) decision.accounting = { expeditionId, attempts: [] };
    state.reconsiderationReason = null;
    pendingTriggers.clear();
    decisions.push(decision);
    if (state.usage) state.usage = summarizeUsage(decisions);
    state.decisionRevision++;
    const request = { decision, expedition, abort: new AbortController() };
    inFlight = request;
    state.decisionPending = true;
    record({ type: 'decision-requested', decision });
    if (replay) return;
    const requestedAt = wallNow();
    const accountingOrigin = { expedition, decisions, state };
    const readAttempt = controller.readAttempt;
    try {
      const result = controller.decide(structuredClone(input), {
        signal: request.abort.signal,
        reserveAttempt(retryIndex = 0) {
          if (request !== inFlight || request.abort.signal.aborted || (state.inferenceLimits ? currentGuard()!.reasons.length > 0 : state.inferenceAttempts >= INFERENCE_LIMIT)) return null;
          state.inferenceAttempts++;
          decision.inferenceAttempts++;
          state.decisionRevision++;
          const identity = { expeditionId, decisionId: decision.id, attemptId: crypto.randomUUID() };
          const submission = { identity, retryIndex, submittedAtMs: Date.now() };
          decision.accounting ??= { expeditionId, attempts: [] };
          decision.accounting.attempts.push({ submission, evidence: null });
          state.usage = summarizeUsage(decisions);
          record({ type: 'inference-attempt', decisionId: decision.id, attempt: state.inferenceAttempts, controller: decision.controller, submission });
          if (readAttempt) usageReads.push(async () => {
            const evidence = await readAttempt(identity);
            if (evidence) accountAttempt(evidence, accountingOrigin);
          });
          return identity;
        },
        reportAttempt: evidence => accountAttempt(evidence, accountingOrigin),
      });
      if (typeof result === 'string' || !('then' in result)) applyDecision(result, 0);
      else {
        // Discard the remainder of a scheduler batch at the asynchronous boundary.
        // It must never be replayed as catch-up after a pending decision.
        pendingMs %= STEP_MS;
        const settle = (id: string | DecisionOutcome | null) => {
          applyDecision(id, Math.max(0, wallNow() - requestedAt));
          // Let the wall-time scheduler reset its anchor at the exact end of the freeze.
          for (const listener of decisionListeners) listener();
        };
        result.then(settle, () => settle(null));
      }
    } catch {
      applyDecision(null, 0);
    }
  }

  function accountAttempt(evidence: AttemptEvidence, origin = { expedition, decisions, state }) {
    const decision = origin.decisions.find(item => item.id === evidence.identity.decisionId);
    const attempt = decision?.accounting?.attempts.find(item => sameAttempt(item.submission.identity, evidence.identity));
    if (!attempt || !canUpdateEvidence(attempt.evidence, evidence)) return;
    attempt.evidence = structuredClone(evidence);
    origin.state.usage = summarizeUsage(origin.decisions);
    origin.state.decisionRevision++;
    record({ type: 'inference-accounted', evidence }, origin.state.elapsedMs, origin.expedition);
    if (origin.expedition === expedition && !inFlight) checkUsageGuard();
    const completedIndex = completedRecords.findIndex(item => item.id === evidence.identity.expeditionId);
    if (completedIndex !== -1) {
      completedRecords[completedIndex] = structuredClone({ ...completedRecords[completedIndex]!,
        decisions: origin.decisions, results: origin.state, events: events.filter(event => event.expedition === origin.expedition) });
    }
    for (const listener of usageListeners) listener();
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
      record({ type: 'decision-settled', decision }, decision.input.atMs, request.expedition);
      completeRecord();
      checkUsageGuard();
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
      state.decisionFailure = decision.failure === 'usage-paused' ? null : decision.failure;
      record({ type: 'decision-invalid', decisionId: decision.id });
      record({ type: 'decision-settled', decision });
      checkUsageGuard();
      return;
    }
    state.decisionRevision++;
    decision.status = 'applied';
    decision.selectedCandidateId = action.id;
    decision.action = action;
    if (decision.controller === 'baseline' && outcome.baseline) decision.baseline = structuredClone(outcome.baseline);
    decision.latencyMs = latencyMs;
    record({ type: 'decision-made', input: decision.input, action, controller: controller.id,
      decisionId: decision.id, selectedCandidateId: action.id, latencyMs, inferenceAttempts: decision.inferenceAttempts,
      probabilities: decision.probabilities, confidence: decision.confidence,
      ...(decision.baseline ? { baseline: decision.baseline } : {}) });
    if (state.teachingMode !== undefined && (state.teachingMode || state.status === 'paused' || state.inspectionDecisionId)) {
      state.heldDecisionId = decision.id;
      state.status = 'paused';
      pendingMs = 0;
      record({ type: 'decision-held', decisionId: decision.id });
    } else startAction(action);
    checkUsageGuard();
  }

  function startAction(action: Action) {
    state.currentAction = action;
    actionController = controller.id;
    actionProgressMs = 0;
    route = [];
    if ('target' in action) {
      route = findRoute(knownTerrain(state.memory), state.rover.position, action.target.position, action.routeMode === 'avoid-storm' ? knownStorm(state.memory) : undefined)!;
      waypointStart = { ...state.rover.position };
    }
    record({ type: 'action-started', action, controller: controller.id });
  }

  function viewingPause() {
    return !!state.inspectionDecisionId || !!(state.teachingMode && state.heldDecisionId);
  }

  function clearHeldChoice(reason: 'executed' | 'invalidated') {
    if (!state.heldDecisionId) return;
    record({ type: 'held-decision-cleared', decisionId: state.heldDecisionId, reason });
    state.heldDecisionId = null;
  }

  function executeHeldChoice() {
    if (!state.heldDecisionId) return;
    const decision = decisions.find(item => item.id === state.heldDecisionId)!;
    const candidate = availableCandidates().find(item => item.id === decision.selectedCandidateId);
    if (decision.input.instructionsVersion !== state.instructionsVersion || !candidate || !sameRecordData(candidate, decision.action)) {
      clearHeldChoice('invalidated');
      requestReconsideration('retry');
      return;
    }
    clearHeldChoice('executed');
    startAction(candidate);
  }

  function invalidateDecision() {
    clearHeldChoice('invalidated');
    if (inFlight && inFlight.decision.status === 'pending') {
      state.decisionRevision++;
      if (meaningfulBoundaries && inFlight.expedition === expedition) {
        const triggers = [...inFlight.decision.input.decisionBoundary!.triggers, ...pendingTriggers];
        pendingTriggers.clear();
        for (const trigger of triggers) requestReconsideration(trigger);
      }
      inFlight.decision.status = 'discarded';
      record({ type: 'decision-discarded', decisionId: inFlight.decision.id });
      inFlight.abort.abort();
    }
  }

  function resumeAfterDecisionFailure(reason: 'retry' | 'controller-changed') {
    state.decisionFailure = null;
    state.status = viewingPause() ? 'paused' : 'running';
    requestReconsideration(reason);
    record({ type: 'resumed' });
    reconsiderAtWaypoint();
    selectAction();
  }

  function reconsiderAtWaypoint() {
    if (!state.reconsiderationReason || !state.currentAction) return;
    // Inspection, collection, and bounded waiting finish first. Travel and recharge
    // can be interrupted while stationary, but never part-way through a grid edge.
    if (state.currentAction.kind !== 'recharge' && !('target' in state.currentAction && actionProgressMs === 0)) return;
    record({ type: 'action-cancelled', action: state.currentAction, controller: actionController });
    state.currentAction = null;
    route = [];
    selectAction();
  }

  function sense() {
    const memory = new Map(state.memory.map(observation => [observation.id, observation]));
    if (storm && state.elapsedMs >= storm.expiresAtMs) {
      const detected = memory.has(storm.id);
      record({ type: 'storm-expired', stormId: storm.id, detected });
      if (detected) requestReconsideration('storm-expired');
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
      if (meaningfulBoundaries) requestReconsideration('storm-effects-changed');
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
        requestReconsideration('storm-detected');
      }
    }
    const discoveries = state.observations.filter(observation => !memory.has(observation.id));
    for (const observation of state.observations) memory.set(observation.id, observation);
    state.memory = [...memory.values()];
    state.discoveryCount = state.memory.filter(item => item.kind === 'sample').length;
    state.inspectionCount = state.memory.filter(item => item.kind === 'sample' && item.properties).length;
    if (discoveries.length) {
      record({ type: 'discovered', observations: discoveries });
      if (meaningfulBoundaries) {
        if (discoveries.some(item => item.kind === 'sample')) requestReconsideration('sample-discovered');
      } else if (state.currentAction && !state.reconsiderationReason) state.reconsiderationReason = 'new-observations';
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
        if (meaningfulBoundaries) requestReconsideration('sample-inspected');
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
    if (state.inspectionDecisionId) {
      state.inspectionDecisionId = null;
      record({ type: 'inspection-ended' });
    }
    state.reconsiderationReason = null;
    pendingTriggers.clear();
    if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: actionController });
    state.currentAction = null;
    state.status = 'ended';
    state.endingCondition = condition;
    pendingMs = 0;
    record({ type: 'ended', condition });
    if (replay) return;
    // Hold these run-owned references until any cancelled inference has settled,
    // even if mission control resets before its latency becomes available.
    pendingCompletions.set(expedition, {
      format: 'roverlab-expedition', version: 13, id: expeditionId, completedAt: new Date().toISOString(),
      ...(matched ? { matchedFrom: structuredClone(matched.provenance) } : {}),
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
    state.remainingMs = durationMs - state.elapsedMs;
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
        applyScheduledInterventions();
        applyScheduledInterventions('after-step');
        sense();
        finish('stranded');
        return;
      }
      const interactionMs = action.kind === 'inspect' ? INSPECT_MS : action.kind === 'collect' ? COLLECT_MS : 0;
      completed = route.length === 0 && actionProgressMs >= interactionMs;
      if (completed && !completeInteraction(action)) {
        record({ type: 'action-cancelled', action, controller: actionController });
        state.currentAction = null;
      }
    }
    sense();
    if (completed || actionProgressMs === 0) checkResourceThresholds();
    if (completed) {
      if (state.currentAction) record({ type: 'action-completed', action, controller: actionController });
      if (meaningfulBoundaries) requestReconsideration('action-completed');
      previousAction = action;
      state.currentAction = null;
    }
    applyScheduledInterventions();
    if (state.remainingMs === 0) {
      applyScheduledInterventions('after-step');
      finish('timeout');
    } else {
      if (completed) selectAction();
      else reconsiderAtWaypoint();
      // Replay consumes these requests between the original recorded choice events.
      if (!replay) applyScheduledInterventions('after-step');
    }
  }

  record(replay?.next?.type === 'reset' ? { type: 'reset', instructions } : { type: 'created' });
  sense();

  const session = {
    getSnapshot: () => structuredClone(completedInspectionId ? { ...state, inspectionDecisionId: completedInspectionId } : state),
    refreshInferenceUsage() {
      refreshingUsage ??= Promise.all(usageReads.map(read => read().catch(() => {}))).then(() => {}).finally(() => { refreshingUsage = null; });
      return refreshingUsage;
    },
    onUsageUpdated(listener: () => void) {
      usageListeners.add(listener);
      return () => { usageListeners.delete(listener); };
    },
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
      ...(state.usage ? { usage: state.usage } : {}),
      ...(state.inferenceLimits ? { inferenceLimits: state.inferenceLimits, acknowledgedAttemptIds: state.acknowledgedAttemptIds, usagePause: state.usagePause } : {}),
      controller: state.controller, controllerHistory: state.controllerHistory, inferenceAttempts: state.inferenceAttempts, inferenceLatencyMs: state.inferenceLatencyMs,
      endingCondition: state.endingCondition, scienceScore: state.scienceScore, energyUsed: state.energyUsed,
      discoveryCount: state.discoveryCount, inspectionCount: state.inspectionCount,
    } }),
    dispatch(command: ExpeditionCommand) {
      if (command.type === 'set-teaching-mode' && state.teachingMode !== undefined && state.status !== 'ended' && state.teachingMode !== command.enabled) {
        state.teachingMode = command.enabled;
        record({ type: 'teaching-changed', enabled: command.enabled });
      } else if (command.type === 'inspect-decision' && state.inspectionDecisionId !== undefined
        && decisions.some(item => item.id === command.decisionId) && state.inspectionDecisionId !== command.decisionId) {
        if (state.status === 'ended') completedInspectionId = command.decisionId;
        else {
          state.inspectionDecisionId = command.decisionId;
          state.status = 'paused';
          record({ type: 'decision-inspected', decisionId: command.decisionId });
        }
      } else if (command.type === 'end-inspection' && completedInspectionId) {
        completedInspectionId = null;
      } else if (command.type === 'end-inspection' && state.inspectionDecisionId) {
        state.inspectionDecisionId = null;
        if (state.status !== 'ended') record({ type: 'inspection-ended' });
      } else if (command.type === 'continue-choice' && state.status === 'paused' && state.heldDecisionId
        && !state.inspectionDecisionId && !state.decisionFailure && !state.usagePause && !checkUsageGuard()) {
        state.status = 'running';
        record({ type: 'resumed' });
        executeHeldChoice();
        selectAction();
      }
      if (command.type === 'set-instructions' && command.instructions.length > MAX_MISSION_INSTRUCTIONS_LENGTH) {
        throw new RangeError('Mission instructions must be 20,000 characters or fewer.');
      }
      if (command.type === 'set-inference-limits' && state.inferenceLimits && !inFlight
        && (state.status === 'ready' || (state.status === 'paused' && state.usagePause))) {
        const limits = inferenceLimitsSchema.parse(command.limits);
        if (state.status !== 'ready' && (limits.providerAttempts < state.inferenceLimits.providerAttempts
          || limits.estimatedCost < state.inferenceLimits.estimatedCost)) return;
        if (sameRecordData(limits, state.inferenceLimits)) return;
        state.inferenceLimits = limits;
        record({ type: 'inference-limits-changed', limits });
        checkUsageGuard();
      } else if (command.type === 'acknowledge-usage' && state.usagePause && !inFlight && state.status === 'paused') {
        const affected = currentGuard()!.attemptIds;
        if (!affected.length || !sameRecordData([...command.attemptIds].sort(), [...affected].sort())) return;
        state.acknowledgedAttemptIds!.push(...affected);
        record({ type: 'usage-acknowledged', attemptIds: affected });
        checkUsageGuard();
        continueInference();
      } else if (command.type === 'continue-inference' && state.status === 'paused') {
        continueInference();
      } else if (command.type === 'set-intervention-schedule' && state.interventions && state.status === 'ready') {
        const requested = interventionScheduleSchema.parse(command.schedule);
        const retained = state.interventions.history.map(item => state.interventions!.schedule.events.find(event => event.id === item.id)!);
        if (requested.events.some(event => retained.some(previous => previous.id === event.id && !sameRecordData(previous, event)))) {
          throw new RangeError('A captured intervention cannot be replaced.');
        }
        const schedule = interventionScheduleSchema.parse({ ...requested, events: [
          ...retained, ...requested.events.filter(event => !retained.some(previous => previous.id === event.id)),
        ].sort(compareInterventions) });
        validateSchedule(schedule);
        if (!sameRecordData(schedule, state.interventions.schedule)) {
          state.interventions.schedule = schedule;
          record({ type: 'intervention-schedule-selected', schedule });
        }
      } else if (command.type === 'introduce-storm' && scenario.dustStorm && !state.stormIntroduced && state.status !== 'ended') {
        if (state.interventions) {
          if (state.interventions.schedule.events.some(event => event.kind === 'storm')) return;
          requestIntervention({ id: manualInterventionId(), atMs: state.elapsedMs, phase: state.status === 'ready' ? 'setup' : 'after-step', kind: 'storm', storm: scenario.dustStorm }, 'manual');
        } else introduceStorm(scenario.dustStorm);
      } else if (command.type === 'set-instructions' || (command.type === 'set-mission-preset' && state.mission)) {
        const preferences: MissionPreferences = command.type === 'set-instructions'
          ? { mode: 'free-text', instructions: command.instructions } : { mode: 'preset', preset: missionPreset(command.preset) };
        if (state.interventions && state.status !== 'ended'
          && !sameRecordData(preferences, state.mission!.requested.preferences)) {
          requestIntervention({ id: manualInterventionId(), atMs: state.elapsedMs, phase: state.status === 'ready' ? 'setup' : 'after-step', kind: 'mission', mission: preferences }, 'manual');
        } else changeMission(preferences);
      } else if (command.type === 'set-controller' && state.status === 'ready') {
        const next = replay ? recordedController(command.controller) : command.controller === 'baseline' ? baseline : options.typesafeController;
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
        applyScheduledInterventions('setup');
        state.status = 'running';
        record({ type: 'started' });
        requestReconsideration('start');
        applyScheduledInterventions();
        selectAction();
        if (!replay) applyScheduledInterventions('after-step');
      } else if (command.type === 'pause' && state.status === 'running') {
        state.status = 'paused';
        record({ type: 'paused' });
      } else if (command.type === 'retry-decision' && state.status === 'paused' && state.decisionFailure
        && !state.usagePause && controller.id === 'typesafe' && !inFlight
        && (state.inferenceLimits ? !checkUsageGuard() : state.inferenceAttempts < INFERENCE_LIMIT)) {
        resumeAfterDecisionFailure('retry');
      } else if (command.type === 'continue-with-baseline' && state.status === 'paused' && (state.decisionFailure || state.usagePause)
        && controller.id === 'typesafe' && !inFlight) {
        clearHeldChoice('invalidated');
        record({ type: 'controller-changed', from: controller.id, to: baseline.id,
          ...(state.decisionFailure ? { failure: state.decisionFailure } : {}), ...(state.usagePause ? { usagePause: state.usagePause } : {}) });
        if (state.inferenceLimits) state.usagePause = null;
        controller = baseline;
        state.controller = controller.id;
        state.controllerHistory.push({ controller: controller.id, atMs: state.elapsedMs, firstDecisionId: decisions.length + 1 });
        resumeAfterDecisionFailure('controller-changed');
      } else if (command.type === 'resume' && state.status === 'paused' && !viewingPause() && !state.decisionFailure && !state.usagePause && !checkUsageGuard()) {
        state.status = 'running';
        record({ type: 'resumed' });
        executeHeldChoice();
        selectAction();
      } else if (command.type === 'stop' && (state.status === 'running' || state.status === 'paused')) {
        finish('manual-stop');
      } else if (command.type === 'set-speed' && state.status !== 'ended' && state.speed !== command.speed) {
        state.speed = command.speed;
        record({ type: 'speed-changed', speed: command.speed });
      } else if (command.type === 'reset') {
        invalidateDecision();
        if (state.currentAction) record({ type: 'action-cancelled', action: state.currentAction, controller: actionController });
        if (benchmark) {
          objective = startingConditions.objective;
          mission = structuredClone(startingConditions.mission!);
          instructions = missionInstructions(mission);
        }
        expedition++;
        expeditionId = crypto.randomUUID();
        runStartingConditions = { ...startingConditions, ...(state.mission ? { mission: structuredClone(mission) } : {}), objective, instructions, controller: controller.id };
        decisions = [];
        pendingTriggers.clear();
        resourceThresholds.clear();
        storm = null;
        movementEnergyMultiplier = 1;
        state = initialState();
        completedInspectionId = null;
        pendingMs = 0;
        previousAction = null;
        actionController = controller.id;
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
      if (state.status !== 'running' || state.decisionPending || viewingPause()) return;
      pendingMs += deltaMs * state.speed;
      while (pendingMs + 1e-7 >= STEP_MS && state.status === 'running' && !state.decisionPending) {
        pendingMs -= STEP_MS;
        tick();
      }
    },
  };

  function consumeReplayEvents(stopAfterChoice = false): number | undefined {
    while (replay?.next && replay.next.atMs === state.elapsedMs) {
      const event = replay.next;
      switch (event.type) {
        case 'intervention-schedule-selected': session.dispatch({ type: 'set-intervention-schedule', schedule: event.schedule }); break;
        case 'intervention-requested':
          if (event.source === 'manual') requestIntervention(event.intervention, 'manual');
          else {
            const phase = interventionPhase(event.intervention);
            if (phase === 'before-choice') throw new Error('Cannot replay an intervention outside its scheduled boundary.');
            requestIntervention(event.intervention, 'scheduled');
          }
          break;
        case 'teaching-changed': session.dispatch({ type: 'set-teaching-mode', enabled: event.enabled }); break;
        case 'decision-inspected': session.dispatch({ type: 'inspect-decision', decisionId: event.decisionId }); break;
        case 'inspection-ended': session.dispatch({ type: 'end-inspection' }); break;
        case 'held-decision-cleared':
          if (event.reason !== 'invalidated') throw new Error('Cannot replay a held choice without continuation.');
          clearHeldChoice('invalidated'); break;
        case 'inference-limits-changed': session.dispatch({ type: 'set-inference-limits', limits: event.limits }); break;
        case 'usage-acknowledged': session.dispatch({ type: 'acknowledge-usage', attemptIds: event.attemptIds }); break;
        case 'usage-paused': checkUsageGuard(); break;
        case 'inference-continued': session.dispatch({ type: 'continue-inference' }); break;
        case 'started': session.dispatch({ type: 'start' }); break;
        case 'paused': session.dispatch({ type: 'pause' }); break;
        case 'resumed': session.dispatch({ type: state.decisionFailure ? 'retry-decision' : state.heldDecisionId ? 'continue-choice' : 'resume' }); break;
        case 'speed-changed': session.dispatch({ type: 'set-speed', speed: event.speed }); break;
        case 'objective-selected': session.dispatch({ type: 'set-objective', objective: event.objective }); break;
        case 'mission-changed':
          if (event.mission.preferences.mode !== 'preset') throw new Error('Cannot replay this mission change.');
          session.dispatch({ type: 'set-mission-preset', preset: event.mission.preferences.preset.id }); break;
        case 'mission-applied': applyMission(); break;
        case 'instructions-changed': session.dispatch({ type: 'set-instructions', instructions: event.instructions }); break;
        case 'storm-introduced': session.dispatch({ type: 'introduce-storm' }); break;
        case 'controller-selected':
          if (event.controller === 'scripted') throw new Error('Cannot replay this expedition: unsupported controller selection.');
          session.dispatch({ type: 'set-controller', controller: event.controller });
          break;
        case 'controller-changed': session.dispatch({ type: 'continue-with-baseline' }); break;
        case 'inference-accounted': accountAttempt(event.evidence); break;
        case 'inference-attempt':
          if (!inFlight || inFlight.decision.id !== event.decisionId) throw new Error('Cannot replay this expedition: missing recorded decision.');
          state.inferenceAttempts++;
          inFlight.decision.inferenceAttempts++;
          state.decisionRevision++;
          if (event.submission) inFlight.decision.accounting!.attempts.push({ submission: event.submission, evidence: null });
          if (state.usage) state.usage = summarizeUsage(decisions);
          record({ type: 'inference-attempt', decisionId: inFlight.decision.id, attempt: state.inferenceAttempts, controller: controller.id,
            ...(event.submission ? { submission: event.submission } : {}) });
          break;
        case 'decision-requested': selectAction(); break;
        case 'decision-invalid': {
          const decision = replay.source.decisions[event.decisionId - 1]!;
          applyDecision({ failure: decision.failure, probabilities: decision.probabilities, confidence: decision.confidence }, decision.latencyMs!);
          break;
        }
        case 'decision-settled': applyDecision(null, event.decision.latencyMs!); break;
        case 'decision-discarded': {
          // Instruction edits and manual stop cancel pending decisions before
          // recording the command itself. Re-execute that command as one unit.
          const commandEvent = replay.afterNext;
          if (commandEvent?.type === 'instructions-changed') session.dispatch({ type: 'set-instructions', instructions: commandEvent.instructions });
          else if (commandEvent?.type === 'mission-changed' && commandEvent.mission.preferences.mode === 'preset') {
            session.dispatch({ type: 'set-mission-preset', preset: commandEvent.mission.preferences.preset.id });
          } else session.dispatch({ type: 'stop' });
          break;
        }
        case 'action-cancelled':
        case 'ended': session.dispatch({ type: 'stop' }); break;
        case 'decision-made': applyDecision({ selectedCandidateId: event.selectedCandidateId,
          probabilities: event.probabilities, confidence: event.confidence, baseline: event.baseline }, event.latencyMs); break;
        default: throw new Error(`Cannot replay this expedition: unsupported ${event.type} event at ${event.atMs} ms.`);
      }
      if (replay.next === event) throw new Error(`Cannot replay this expedition: ${event.type} cannot execute at ${event.atMs} ms.`);
      if (stopAfterChoice && event.type === 'decision-made') return event.decisionId;
    }
    if (replay && !replay.next && (!sameRecordData(state, replay.source.results) || !sameRecordData(decisions, replay.source.decisions))) {
      throw new Error('Cannot replay this expedition: simulated results differ from the saved results.');
    }
  }

  return { session, consumeReplayEvents, advanceReplay(stopAfterChoice = false): number | undefined {
    const choice = consumeReplayEvents(stopAfterChoice);
    if (choice || !replay?.next) return choice;
    if (state.status !== 'running' || state.decisionPending || !state.currentAction) {
      throw new Error('Cannot replay this expedition: the recorded history cannot advance.');
    }
    session.advanceWallTime(STEP_MS / state.speed);
    return consumeReplayEvents(stopAfterChoice);
  } };
}

export type ExpeditionSession = ReturnType<typeof createExpedition>;

export function createMatchedBaseline(value: unknown): ExpeditionSession {
  const source = validateExpeditionRecord(value);
  // Verify execution without installing a live controller or changing the source.
  try { createReplay(source); }
  catch { throw new Error('Cannot run a matched baseline: the source simulation settings or history are not supported. The saved record remains available for inspection and export.'); }
  return createSimulation({ scenario: source.startingConditions.scenario, objective: source.results.objective,
    interventionSchedule: recordedSchedule(source) }, undefined, {
    start: source.startingConditions,
    provenance: { recordId: source.id, recordVersion: source.version,
      scheduleBasis: source.matchedFrom?.scheduleBasis ?? (source.results.interventions ? 'recorded' : 'reconstructed-legacy') },
  }).session;
}

export function createReplay(value: unknown): ExpeditionSession {
  const source = validateExpeditionRecord(value);
  // Verify execution as well as the JSON contract before exposing any playback.
  // This also bounds replay to the supported simulator settings and time budget.
  const verificationHistory = new ReplayHistory(source);
  const verification = createSimulation({}, verificationHistory);
  verification.consumeReplayEvents();
  while (verificationHistory.next) verification.advanceReplay();
  let history = new ReplayHistory(source);
  let simulation = createSimulation({}, history);
  let status: ExpeditionSnapshot['status'] = 'ready';
  let speed: PlaybackSpeed = 1;
  let pendingMs = 0;
  let stopped = false;
  let teachingMode: boolean | undefined;
  let heldDecisionId: number | null = null;
  let inspectionDecisionId: number | null = null;
  function afterAdvance(choice?: number) {
    if (choice) { heldDecisionId = choice; status = 'paused'; pendingMs = 0; }
    else if (!history.next) status = 'ended';
  }
  return {
    getSnapshot() {
      const snapshot = { ...simulation.session.getSnapshot(), status, speed };
      if (teachingMode !== undefined) { snapshot.teachingMode = teachingMode; snapshot.heldDecisionId = heldDecisionId; }
      if (snapshot.inspectionDecisionId !== undefined || inspectionDecisionId) snapshot.inspectionDecisionId = inspectionDecisionId;
      if (stopped) { snapshot.currentAction = null; snapshot.reconsiderationReason = null; snapshot.endingCondition = 'manual-stop'; }
      return snapshot;
    },
    getRecord: () => simulation.session.getRecord(),
    getDecisions: () => simulation.session.getDecisions(),
    getFullWorldView: () => simulation.session.getFullWorldView(),
    getCompletedRecords: () => [],
    onExpeditionCompleted: () => () => {},
    onDecisionSettled: () => () => {},
    onUsageUpdated: () => () => {},
    refreshInferenceUsage: async () => {},
    dispatch(command) {
      if (command.type === 'set-teaching-mode') teachingMode = command.enabled;
      else if (command.type === 'inspect-decision' && simulation.session.getDecisions().some(item => item.id === command.decisionId)) {
        inspectionDecisionId = command.decisionId;
        if (status !== 'ended') status = 'paused';
      } else if (command.type === 'end-inspection') inspectionDecisionId = null;
      else if (command.type === 'continue-choice' && status === 'paused' && heldDecisionId && !inspectionDecisionId) {
        heldDecisionId = null; status = 'running';
        afterAdvance(simulation.consumeReplayEvents(teachingMode));
      } else if (command.type === 'start' && status === 'ready') {
        status = 'running';
        afterAdvance(simulation.consumeReplayEvents(teachingMode));
      } else if (command.type === 'pause' && status === 'running') status = 'paused';
      else if (command.type === 'resume' && status === 'paused' && !inspectionDecisionId && !(teachingMode && heldDecisionId)) {
        heldDecisionId = null; status = 'running';
        afterAdvance(simulation.consumeReplayEvents(teachingMode));
      }
      else if (command.type === 'set-speed' && status !== 'ended') speed = command.speed;
      else if (command.type === 'stop' && (status === 'running' || status === 'paused')) { status = 'ended'; stopped = true; heldDecisionId = null; inspectionDecisionId = null; }
      else if (command.type === 'reset') {
        history = new ReplayHistory(source);
        simulation = createSimulation({}, history);
        status = 'ready'; speed = 1; pendingMs = 0; stopped = false;
        heldDecisionId = null; inspectionDecisionId = null;
      }
    },
    advanceWallTime(deltaMs) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Wall time must be finite and non-negative.');
      if (status !== 'running') return;
      pendingMs += deltaMs * speed;
      while (pendingMs + 1e-7 >= STEP_MS && status === 'running') {
        pendingMs -= STEP_MS;
        afterAdvance(simulation.advanceReplay(teachingMode));
      }
    },
  };
}
