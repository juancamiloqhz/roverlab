import { baselineRules } from '../../shared/baseline';
import type { Decision } from '../simulation/types';

export function BaselineRuleEvidence({ decision }: { decision: Decision }) {
  if (decision.controller !== 'baseline') return null;
  const evidence = decision.baseline;
  if (!evidence) return <p>Baseline version and rule evidence are unavailable in this legacy record. Replay uses its recorded choices.</p>;
  return <div aria-label="Baseline code rule">
    <p>Baseline version: {evidence.version} · Code rule: {evidence.rule}</p>
    <p>{baselineRules[evidence.rule]} This is a code rule, not a prediction of success or a Jev reasoning transcript.</p>
    <p>{evidence.preferenceSource === 'shared-preset' ? 'Shared preset settings supplied in this decision.'
      : 'Balanced defaults. The baseline cannot interpret arbitrary free text. This is not a matched-priority benchmark.'}</p>
    <p>Planning assumes retracing each offered outbound route and then taking the known return route, plus the requested energy reserve and ten seconds for interactions. Known return candidate: {evidence.returnCandidateId ?? 'None offered'}.</p>
    <p>Utility ranks eligible opportunities using preset weights. It is not a science score, probability, or guarantee. Evidence describes recognized observed properties; unrecognized wording can be missed.</p>
    <div className="decision-table" tabIndex={0} role="region" aria-label="Scrollable baseline opportunity evidence">
      <table aria-label="Baseline opportunity evidence">
        <thead><tr><th>Candidate</th><th>Observed evidence</th><th>Plan including return</th><th>Utility</th><th>Eligibility</th></tr></thead>
        <tbody>{evidence.opportunities.map(item => <tr key={item.candidateId}>
          <td>{item.candidateId}</td>
          <td>{item.evidence} {item.matchedProperties.join(' · ')}</td>
          <td>{item.plannedEnergy === null ? 'Return unknown' : `${item.plannedEnergy.toFixed(2)} energy · ${(item.plannedDurationMs! / 1_000).toFixed(1)} s`}</td>
          <td>{item.utility.toFixed(3)}</td><td>{item.eligible ? 'Eligible' : item.exclusion}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
