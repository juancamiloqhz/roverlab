import { sameAttempt } from '../../shared/inference';
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
  let controller = start.controller;
  let objective = start.objective;
  let instructions = start.instructions;
  let instructionsVersion = 0;
  let started = false;
  let ended = false;
  let attempts = 0;
  let pendingId: number | null = null;
  let activeAction: Action | null = null;
  let selectedAction: Action | null = null;
  const decisions = new Map<number, Decision>();
  const invalid = new Set<number>();
  const history: ControllerHistoryEntry[] = [];

  for (const event of record.events) {
    if (ended && event.type !== 'decision-settled') return false;
    switch (event.type) {
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
      case 'instructions-changed':
        if (event.version !== ++instructionsVersion) return false;
        instructions = event.instructions;
        break;
      case 'controller-changed': {
        const previous = decisions.get(decisions.size);
        if (!started || controller !== 'typesafe' || event.from !== controller || event.to !== 'baseline'
          || !previous?.failure || previous.failure !== event.failure) return false;
        controller = event.to;
        history.push({ controller, atMs: event.atMs, firstDecisionId: decisions.size + 1 });
        break;
      }
      case 'decision-requested': {
        const decision = event.decision;
        if (!started || pendingId !== null || activeAction || selectedAction || decision.id !== decisions.size + 1
          || decision.status !== 'pending' || decision.inferenceAttempts !== 0 || decision.controller !== controller
          || decision.input.objective !== objective || decision.input.instructions !== instructions
          || decision.input.instructionsVersion !== instructionsVersion || decision.input.atMs !== event.atMs || (decision.accounting && decision.accounting.attempts.length !== 0)) return false;
        pendingId = decision.id;
        decisions.set(decision.id, structuredClone(decision));
        break;
      }
      case 'inference-attempt': {
        const decision = decisions.get(event.decisionId);
        if (!decision || pendingId !== decision.id || decision.status !== 'pending'
          || event.controller !== decision.controller || event.attempt !== ++attempts) return false;
        decision.inferenceAttempts++;
        if (record.version === 2) {
          if (!event.submission || !decision.accounting || event.submission.identity.expeditionId !== record.id
            || event.submission.identity.decisionId !== decision.id) return false;
          decision.accounting.attempts.push({ submission: event.submission, evidence: null });
        }
        break;
      }
      case 'inference-accounted': {
        const decision = decisions.get(event.evidence.identity.decisionId);
        const attempt = decision?.accounting?.attempts.find(item => sameAttempt(item.submission.identity, event.evidence.identity));
        if (!decision || pendingId !== decision.id || decision.status !== 'pending' || !attempt || attempt.evidence) return false;
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
        decisions.set(settled.id, settled);
        pendingId = null;
        break;
      }
      case 'action-started':
        if (activeAction || !selectedAction || event.controller !== controller || !sameRecordData(event.action, selectedAction)) return false;
        activeAction = event.action;
        selectedAction = null;
        break;
      case 'action-completed':
      case 'action-cancelled':
        if (!activeAction || event.controller !== controller || !sameRecordData(event.action, activeAction)) return false;
        activeAction = null;
        break;
      case 'ended':
        if (!started || activeAction || selectedAction) return false;
        ended = true;
        break;
    }
  }
  return ended && pendingId === null && (final.elapsedMs === 0 || decisions.size > 0)
    && sameRecordData([...decisions.values()], record.decisions) && sameRecordData(history, final.controllerHistory)
    && controller === final.controller && objective === final.objective && attempts === final.inferenceAttempts
    && instructions === final.instructions && instructionsVersion === final.instructionsVersion;
}
