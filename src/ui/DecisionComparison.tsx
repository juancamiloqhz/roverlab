import { sameRecordData } from '../records/history';
import type { Action, ControllerInput, Decision } from '../simulation/types';
import { BaselineRuleEvidence } from './BaselineRuleEvidence';

function choiceLabel(action: Action, input: ControllerInput) {
  if ('target' in action) return `${action.kind} · ${action.target.label} at ${action.target.position.x}, ${action.target.position.z} · ${action.routeMode === 'avoid-storm' ? 'Storm detour' : 'Direct route'} · ${action.routeEstimate.durationMs / 1000} s · ${action.routeEstimate.energy.toFixed(2)} energy`;
  const position = action.kind === 'recharge' ? input.memory.find(item => item.kind === 'base')?.position : input.position;
  return `${action.kind} · ${action.kind === 'recharge' ? 'Base' : 'Rover'}${position ? ` at ${position.x}, ${position.z}` : ' location unavailable'} · ${action.durationMs / 1000} s · No travel`;
}

export function DecisionComparison({ decision, compact = false }: { decision: Decision; compact?: boolean }) {
  if (decision.controller !== 'typesafe') return null;
  const alternative = decision.baselineAlternative;
  if (!alternative) return <p>Baseline alternative unavailable in this legacy record. No comparison was recorded.</p>;
  const hasChoice = decision.status === 'applied' && !!decision.action;
  const verdict = hasChoice ? sameRecordData(decision.action, alternative.action) ? 'Same complete action' : 'Different choices'
    : decision.status === 'pending' ? 'Jev pending · No accepted choice'
      : decision.status === 'discarded' ? 'Jev result obsolete · No accepted choice' : 'Jev failed · No accepted choice';
  if (compact) return <p className="decision-comparison-summary">Decision comparison · {verdict}</p>;
  const number = (id: string | undefined) => decision.input.candidates.findIndex(item => item.id === id) + 1;
  return <section className="decision-comparison" aria-label="Decision comparison">
    <h4>Decision comparison · {verdict}</h4>
    <p>{hasChoice ? `◆ Jev selected #${number(decision.selectedCandidateId)}: ${choiceLabel(decision.action!, decision.input)}` : verdict}.</p>
    <p>◇ Baseline alternative #{number(alternative.action.id)}: {choiceLabel(alternative.action, decision.input)}.</p>
    <p>Both choices use this decision's recorded mission, knowledge, resources, and offered routes. Map numbers identify their targets.</p>
    <p>The baseline alternative is a code suggestion. It does not execute or change the controller. This comparison does not establish a better expedition outcome.</p>
    <p>Jev's returned probabilities are model output for the offered choices, not science value or predicted success. A selected action may still be held or cancelled before execution.</p>
    <BaselineRuleEvidence evidence={alternative.evidence} />
  </section>;
}
