import { BASELINE_VERSION, type BaselineEvidence, type BaselineRule } from '../../shared/baseline';
import { missionPreset } from '../../shared/mission';
import { knownStorm } from '../simulation/storm';
import type { ActionCandidate, ControllerInput, ScientificObjective } from '../simulation/types';

type TargetedCandidate = Extract<ActionCandidate, { target: unknown }>;
type Opportunity = BaselineEvidence['opportunities'][number];

// This is an English evidence heuristic, not the authored classification or rubric.
function assess(properties: string[] | undefined, objective: ScientificObjective): Pick<Opportunity, 'evidence' | 'matchedProperties'> {
  if (!properties) return { evidence: 'unknown', matchedProperties: [] };
  const strong = objective === 'past-water' ? /flowing water|rounded grains|hydrated minerals?/i : /(?:rare|unusual) mineral/i;
  const tentative = objective === 'past-water' ? /layered sediment|fluid alteration|clay/i : /uncommon mineral|crystalline inclusions/i;
  let level = 0;
  const matchedProperties = properties.filter(property => {
    // Negated clauses cannot establish positive evidence. This deliberately errs
    // toward missing evidence; it is not a general language interpreter.
    const clauses = property.split(/[.;]/).filter(clause => !/\b(no|not|without|absen(?:t|ce)|lacks?)\b/i.test(clause));
    let propertyLevel = 0;
    for (const clause of clauses) {
      const match = strong.test(clause) ? 2 : tentative.test(clause) ? 1 : 0;
      propertyLevel = Math.max(propertyLevel, /\b(possible|possibly|may|traces?|suggests?)\b/i.test(clause) ? Math.min(1, match) : match);
    }
    level = Math.max(level, propertyLevel);
    return propertyLevel > 0;
  });
  return { evidence: level === 2 ? 'supported' : level === 1 ? 'suggestive' : 'no-match', matchedProperties };
}

// Neutral ties use travel time, east then north, then stable candidate identity.
function tie(a: TargetedCandidate, b: TargetedCandidate) {
  return a.routeEstimate.durationMs - b.routeEstimate.durationMs
    || b.target.position.x - a.target.position.x || a.target.position.z - b.target.position.z
    || a.id.localeCompare(b.id);
}

export function chooseBaselineDecision(input: ControllerInput): { action: ActionCandidate; evidence: BaselineEvidence } {
  const { candidates, cargo, battery, remainingMs } = input;
  const preferences = input.mission?.preferences;
  const settings = preferences?.mode === 'preset' ? preferences.preset.settings : missionPreset('balanced').settings;
  const cost = (action: TargetedCandidate) => settings.energyWeight * action.routeEstimate.energy / 10 + action.routeEstimate.durationMs / 60_000;
  const returns = candidates.filter(action => action.kind === 'return-to-base');
  const returnToBase = returns.sort((a, b) => a.routeEstimate.energy - b.routeEstimate.energy || tie(a, b))[0];
  const atBase = input.memory.some(item => item.kind === 'base' && item.position.x === input.position.x && item.position.z === input.position.z);
  const returnKnown = atBase || !!returnToBase;
  const planDuration = (action: TargetedCandidate) => 2 * action.routeEstimate.durationMs
    + (returnToBase?.routeEstimate.durationMs ?? 0) + 10_000;
  const wait = candidates.find(action => action.kind === 'wait')!;
  const recharge = candidates.find(action => action.kind === 'recharge');
  const opportunities = candidates.filter(action => action.kind === 'inspect' || action.kind === 'collect' || action.kind === 'explore')
    .map(action => {
      const sample = input.memory.find(item => item.kind === 'sample' && item.sampleId === action.target.id);
      const assessment = action.kind === 'explore' ? { evidence: 'not-applicable' as const, matchedProperties: [] }
        : assess(sample?.kind === 'sample' ? sample.properties : undefined, input.objective);
      // Plan to retrace the outbound journey, then use the currently offered
      // return route. Ten seconds allows for science interactions. These are
      // conservative planning estimates, never simulation movement constraints.
      const plannedEnergy = returnKnown ? 2 * action.routeEstimate.energy + (returnToBase?.routeEstimate.energy ?? 0) + settings.returnReserveEnergy : null;
      const plannedDurationMs = returnKnown ? planDuration(action) : null;
      const exclusion: Opportunity['exclusion'] = action.kind === 'collect' && assessment.evidence === 'unknown' ? 'unknown-properties'
        : action.kind === 'collect' && assessment.evidence === 'no-match' ? 'no-relevant-evidence'
          : plannedEnergy === null ? 'return-unknown'
            : plannedEnergy > battery ? 'energy' : plannedDurationMs! >= remainingMs ? 'time' : null;
      const science = assessment.evidence === 'supported' ? 2 : assessment.evidence === 'suggestive' ? 1 : 0;
      const benefit = action.kind === 'explore' ? 1.5 * settings.explorationWeight
        : action.kind === 'inspect' ? 0.5 * settings.scienceWeight + settings.explorationWeight
          : science * settings.scienceWeight + settings.deliveryWeight / input.cargoCapacity;
      const evidence: Opportunity = { candidateId: action.id, ...assessment, plannedEnergy, plannedDurationMs,
        utility: benefit - cost(action), eligible: exclusion === null, exclusion };
      return { action, evidence };
    });
  const evidence: BaselineEvidence = { version: BASELINE_VERSION, rule: 'no-opportunity',
    preferenceSource: preferences?.mode === 'preset' ? 'shared-preset' : 'balanced-default',
    returnCandidateId: returnToBase?.id ?? null, opportunities: opportunities.map(item => item.evidence) };
  function select(action: ActionCandidate, rule: BaselineRule) {
    return { action, evidence: { ...evidence, rule } };
  }
  function travel(action: ActionCandidate, rule: BaselineRule) {
    const storm = knownStorm(input.memory);
    if ('target' in action && (action.routeEstimate.stormDistanceCells ?? 0) > 0 && storm
      && storm.remainingMs <= 10_000 && storm.remainingMs + planDuration(action) < remainingMs) return select(wait, 'storm-wait');
    return select(action, rule);
  }
  if (recharge && battery <= input.batteryCapacity * 0.9) return select(recharge, 'recharge');
  if (returnToBase && battery <= returnToBase.routeEstimate.energy + settings.returnReserveEnergy) return travel(returnToBase, 'return-reserve');
  if (returnToBase && cargo.length && remainingMs <= returnToBase.routeEstimate.durationMs + 15_000) return travel(returnToBase, 'return-time');
  if (returnToBase && cargo.length >= input.cargoCapacity) return travel(returnToBase, 'deliver-full');
  if (input.previousAction?.kind === 'explore') return select(wait, 'survey-pause');
  const eligible = opportunities.filter(item => item.evidence.eligible);
  const best = eligible.sort((a, b) => b.evidence.utility - a.evidence.utility || tie(a.action, b.action))[0];
  const deliveryUtility = returnToBase ? settings.deliveryWeight * cargo.length / input.cargoCapacity - cost(returnToBase) : -Infinity;
  if (returnToBase && cargo.length && (!best || deliveryUtility >= best.evidence.utility
    || (settings.deliveryWeight >= settings.explorationWeight && !eligible.some(item => item.action.kind !== 'explore')))) return travel(returnToBase, 'deliver-cargo');
  if (best) return travel(best.action, 'ranked-opportunity');
  return returnToBase ? travel(returnToBase, 'return-for-recharge') : select(wait, 'no-opportunity');
}

export function chooseBaselineAction(input: ControllerInput): ActionCandidate {
  return chooseBaselineDecision(input).action;
}
