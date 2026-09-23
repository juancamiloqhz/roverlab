import { missionPreset } from '../../shared/mission';
import { knownStorm } from '../simulation/storm';
import type { BaselineEvidence } from '../../shared/baseline';
import { sameRecordData } from './history';
import type { Action, ControllerInput, Decision } from '../simulation/types';

// Check the recorded rule's meaning without asking any controller to choose an
// action. These checks describe evidence-priorities-v1 and stay version-specific.
export function hasConsistentBaselineEvidence(decision: Decision): boolean {
  const evidence = decision.baseline;
  if (!evidence) return true;
  if (decision.controller !== 'baseline' || decision.status !== 'applied' || !decision.action) return false;
  return hasConsistentSelection(decision.input, decision.action, decision.selectedCandidateId, evidence);
}

export function hasConsistentBaselineAlternative(decision: Decision): boolean {
  const alternative = decision.baselineAlternative;
  if (!alternative) return true;
  const { action, evidence } = alternative;
  return decision.controller === 'typesafe'
    && sameRecordData(action, decision.input.candidates.find(candidate => candidate.id === action.id))
    && hasConsistentSelection(decision.input, action, action.id, evidence);
}

function hasConsistentSelection(input: ControllerInput, action: Action, selectedCandidateId: string | undefined, evidence: BaselineEvidence): boolean {
  const preferences = input.mission?.preferences;
  const settings = preferences?.mode === 'preset' ? preferences.preset.settings : missionPreset('balanced').settings;
  const opportunities = input.candidates.filter(candidate => ['inspect', 'collect', 'explore'].includes(candidate.kind));
  const returns = input.candidates.filter(candidate => candidate.kind === 'return-to-base');
  const returnToBase = returns.find(candidate => candidate.id === evidence.returnCandidateId);
  if (evidence.preferenceSource !== (preferences?.mode === 'preset' ? 'shared-preset' : 'balanced-default')
    || evidence.opportunities.length !== opportunities.length
    || (returns.length ? !returnToBase || returns.some(candidate => candidate.routeEstimate.energy < returnToBase.routeEstimate.energy) : evidence.returnCandidateId !== null)
    || !evidence.opportunities.every((item, index) => {
      const candidate = opportunities[index]!;
      const sample = 'target' in candidate && input.memory.find(observation => observation.kind === 'sample' && observation.sampleId === candidate.target.id);
      return item.candidateId === candidate.id && item.eligible === (item.exclusion === null)
        && item.matchedProperties.every(property => sample && sample.kind === 'sample' && sample.properties?.includes(property));
    })) return false;
  const eligible = evidence.opportunities.filter(item => item.eligible);
  const returning = action.kind === 'return-to-base' && selectedCandidateId === returnToBase?.id;
  switch (evidence.rule) {
    case 'recharge': return action.kind === 'recharge' && input.battery <= input.batteryCapacity * 0.9;
    case 'return-reserve': return returning && input.battery <= returnToBase!.routeEstimate.energy + settings.returnReserveEnergy;
    case 'return-time': return returning && input.cargo.length > 0 && input.remainingMs <= returnToBase!.routeEstimate.durationMs + 15_000;
    case 'deliver-full': return returning && input.cargo.length >= input.cargoCapacity;
    case 'survey-pause': return action.kind === 'wait' && input.previousAction?.kind === 'explore';
    case 'ranked-opportunity': {
      const selected = eligible.find(item => item.candidateId === selectedCandidateId);
      return !!selected && eligible.every(item => item.utility <= selected.utility);
    }
    case 'deliver-cargo': {
      if (!returning || !input.cargo.length) return false;
      const deliveryUtility = settings.deliveryWeight * input.cargo.length / input.cargoCapacity
        - (settings.energyWeight * returnToBase!.routeEstimate.energy / 10 + returnToBase!.routeEstimate.durationMs / 60_000);
      return eligible.every(item => item.utility <= deliveryUtility)
        || (settings.deliveryWeight >= settings.explorationWeight && eligible.every(item => input.candidates.find(candidate => candidate.id === item.candidateId)?.kind === 'explore'));
    }
    case 'return-for-recharge': return returning && eligible.length === 0;
    case 'storm-wait': {
      const storm = knownStorm(input.memory);
      return action.kind === 'wait' && !!storm && storm.remainingMs <= 10_000
        && input.candidates.some(candidate => 'target' in candidate && (candidate.routeEstimate.stormDistanceCells ?? 0) > 0
          && storm.remainingMs + 2 * candidate.routeEstimate.durationMs + (returnToBase?.routeEstimate.durationMs ?? 0) + 10_000 < input.remainingMs);
    }
    case 'no-opportunity': return action.kind === 'wait' && eligible.length === 0 && !returnToBase;
  }
}
