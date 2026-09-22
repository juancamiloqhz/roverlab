import { missionInstructions, type MissionState } from '../../shared/mission';
import { inferenceGuard, type UsagePause } from '../../shared/limits';
import { canUpdateEvidence, sameAttempt } from '../../shared/inference';
import type { Action, ControllerHistoryEntry, Decision, ExpeditionRecord } from '../simulation/types';

// Compare JSON data independent of object-key order, including probability maps.
export function sameRecordData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => sameRecordData(value, right[index]));
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length
    && keys.every(key => Object.hasOwn(b, key) && sameRecordData(a[key], b[key]));
}

// Verify relationships between recorded facts; this never executes commands or
// re-simulates movement, perception, scoring, or controller decisions.
export function hasConsistentHistory(record: ExpeditionRecord): boolean {
  const { startingConditions: start, results: final } = record;
  let limits = start.inferenceLimits;
  const acknowledged: string[] = [];
  let usagePause: UsagePause | null = null;
  let controller = start.controller;
  let objective = start.objective;
  let instructions = start.instructions;
  let instructionsVersion = 0;
  const initialMission = start.mission ? { version: 0, preferences: start.mission } : undefined;
  const mission: MissionState | undefined = initialMission ? { requested: initialMission, effective: initialMission,
    history: [{ ...initialMission, requestedAtMs: 0, appliedAtMs: 0 }] } : undefined;
  let started = false;
  let ended = false;
  let attempts = 0;
  let pendingId: number | null = null;
  let activeAction: Action | null = null;
  let actionController = controller;
  let selectedAction: Action | null = null;
  const decisions = new Map<number, Decision>();
  const invalid = new Set<number>();
  const history: ControllerHistoryEntry[] = [];

  for (const event of record.events) {
    if (ended && event.type !== 'decision-settled' && !(record.version >= 3 && event.type === 'inference-accounted')) return false;
    switch (event.type) {
      case 'inference-limits-changed':
        if (!limits || pendingId !== null || (started && (!usagePause
          || event.limits.providerAttempts < limits.providerAttempts || event.limits.estimatedCost < limits.estimatedCost))) return false;
        limits = event.limits;
        break;
      case 'usage-acknowledged': {
        if (!limits || !usagePause || pendingId !== null) return false;
        const affected = inferenceGuard([...decisions.values()], limits, acknowledged).attemptIds;
        if (!sameRecordData(event.attemptIds, affected) || !affected.length) return false;
        acknowledged.push(...affected);
        break;
      }
      case 'usage-paused': {
        if (!started || !limits || controller !== 'typesafe' || pendingId !== null) return false;
        const guard = inferenceGuard([...decisions.values()], limits, acknowledged);
        if ((!usagePause && !guard.reasons.length) || sameRecordData(usagePause, guard) || !sameRecordData(event.pause, guard)) return false;
        usagePause = event.pause;
        break;
      }
      case 'inference-continued':
        if (!limits || !usagePause || pendingId !== null || inferenceGuard([...decisions.values()], limits, acknowledged).reasons.length) return false;
        usagePause = null;
        break;
      case 'started':
        if (started) return false;
        started = true;
        history.push({ controller, atMs: 0, firstDecisionId: 1 });
        break;
      case 'objective-selected':
        if (started) return false;
        objective = event.objective;
        break;
      case 'controller-selected':
        if (started) return false;
        controller = event.controller;
        break;
      case 'mission-changed':
      case 'instructions-changed': {
        const revision = event.type === 'mission-changed' ? event.mission
          : { version: event.version, preferences: { mode: 'free-text' as const, instructions: event.instructions } };
        if (revision.version !== ++instructionsVersion || (event.type === 'mission-changed' && revision.preferences.mode !== 'preset')) return false;
        if (pendingId !== null && decisions.get(pendingId)?.status !== 'discarded') return false;
        instructions = missionInstructions(revision.preferences);
        if (mission) {
          if (sameRecordData(mission.requested.preferences, revision.preferences)) return false;
          mission.requested = revision;
          mission.history.push({ ...revision, requestedAtMs: event.atMs, appliedAtMs: null });
        }
        break;
      }
      case 'mission-applied':
        if (!mission || activeAction || pendingId !== null || mission.requested.version !== event.version
          || mission.effective.version === event.version) return false;
        mission.effective = mission.requested;
        mission.history.at(-1)!.appliedAtMs = event.atMs;
        break;
      case 'controller-changed': {
        const previous = decisions.get(decisions.size);
        if (!started || controller !== 'typesafe' || event.from !== controller || event.to !== 'baseline'
          || pendingId !== null || (activeAction !== null && !event.usagePause)
          || (event.usagePause ? !sameRecordData(event.usagePause, usagePause) : !previous?.failure || previous.failure !== event.failure)
          || (event.failure !== undefined && previous?.failure !== event.failure)) return false;
        usagePause = null;
        controller = event.to;
        history.push({ controller, atMs: event.atMs, firstDecisionId: decisions.size + 1 });
        break;
      }
      case 'decision-requested': {
        const decision = event.decision;
        if (!started || pendingId !== null || activeAction || selectedAction || decision.id !== decisions.size + 1
          || decision.status !== 'pending' || decision.inferenceAttempts !== 0 || decision.controller !== controller
          || !sameRecordData(decision.input.mission, mission?.effective)
          || (mission && mission.requested.version !== mission.effective.version)
          || decision.input.objective !== objective || decision.input.instructions !== instructions
          || decision.input.instructionsVersion !== instructionsVersion || decision.input.atMs !== event.atMs || (decision.accounting && decision.accounting.attempts.length !== 0)) return false;
        pendingId = decision.id;
        decisions.set(decision.id, structuredClone(decision));
        break;
      }
      case 'inference-attempt': {
        const decision = decisions.get(event.decisionId);
        if (limits && inferenceGuard([...decisions.values()], limits, acknowledged).reasons.length) return false;
        if (!decision || pendingId !== decision.id || decision.status !== 'pending'
          || event.controller !== decision.controller || event.attempt !== ++attempts) return false;
        decision.inferenceAttempts++;
        if (record.version >= 2) {
          if (!event.submission || !decision.accounting || event.submission.identity.expeditionId !== record.id
            || event.submission.identity.decisionId !== decision.id) return false;
          decision.accounting.attempts.push({ submission: event.submission, evidence: null });
        }
        break;
      }
      case 'inference-accounted': {
        const decision = decisions.get(event.evidence.identity.decisionId);
        const attempt = decision?.accounting?.attempts.find(item => sameAttempt(item.submission.identity, event.evidence.identity));
        if (!decision || !attempt || !canUpdateEvidence(attempt.evidence, event.evidence)
          || (record.version < 3 && (pendingId !== decision.id || decision.status !== 'pending'))) return false;
        attempt.evidence = event.evidence;
        break;
      }
      case 'decision-made': {
        const decision = decisions.get(event.decisionId);
        if (!decision || pendingId !== decision.id || decision.status !== 'pending' || event.controller !== controller
          || !sameRecordData(event.input, decision.input) || event.inferenceAttempts !== decision.inferenceAttempts) return false;
        decisions.set(decision.id, { ...decision, status: 'applied', action: event.action, selectedCandidateId: event.selectedCandidateId,
          latencyMs: event.latencyMs, probabilities: event.probabilities, confidence: event.confidence });
        pendingId = null;
        selectedAction = event.action;
        break;
      }
      case 'decision-discarded': {
        const decision = decisions.get(event.decisionId);
        if (!decision || pendingId !== decision.id || decision.status !== 'pending') return false;
        decision.status = 'discarded';
        break;
      }
      case 'decision-invalid':
        if (pendingId !== event.decisionId || invalid.has(event.decisionId)) return false;
        invalid.add(event.decisionId);
        break;
      case 'decision-settled': {
        const settled = event.decision;
        const requested = decisions.get(settled.id);
        if (!requested || pendingId !== settled.id || settled.latencyMs === undefined
          || requested.controller !== settled.controller || requested.reason !== settled.reason
          || requested.inferenceAttempts !== settled.inferenceAttempts || !sameRecordData(requested.accounting, settled.accounting) || !sameRecordData(requested.input, settled.input)
          || (requested.status === 'discarded' ? settled.status !== 'discarded'
            : !invalid.has(settled.id) || !settled.failure || !['failed', 'invalid'].includes(settled.status))) return false;
        decisions.set(settled.id, structuredClone(settled));
        pendingId = null;
        break;
      }
      case 'action-started':
        if (activeAction || !selectedAction || event.controller !== controller || !sameRecordData(event.action, selectedAction)) return false;
        activeAction = event.action;
        actionController = event.controller;
        selectedAction = null;
        break;
      case 'action-completed':
      case 'action-cancelled':
        if (!activeAction || event.controller !== actionController || !sameRecordData(event.action, activeAction)) return false;
        activeAction = null;
        break;
      case 'ended':
        if (!started || activeAction || selectedAction) return false;
        ended = true;
        break;
    }
  }
  return (!limits || (sameRecordData(limits, final.inferenceLimits) && sameRecordData(acknowledged, final.acknowledgedAttemptIds)
    && sameRecordData(usagePause, final.usagePause))) && ended && pendingId === null && (final.elapsedMs === 0 || decisions.size > 0)
    && sameRecordData([...decisions.values()], record.decisions) && sameRecordData(history, final.controllerHistory)
    && controller === final.controller && objective === final.objective && attempts === final.inferenceAttempts
    && sameRecordData(mission, final.mission)
    && instructions === final.instructions && instructionsVersion === final.instructionsVersion;
}
