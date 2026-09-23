import type { BenchmarkReference } from '../simulation/benchmarks';
import type { ExpeditionRecord } from '../simulation/types';
import { presetAdherence } from '../records/matching';
import { formatInferenceCost } from './InferenceUsage';

export function CompletionEvidence({ record }: { record: ExpeditionRecord }) {
  const { results } = record;
  const base = record.startingConditions.scenario.base;
  const atBase = results.rover.position.x === base.x && results.rover.position.z === base.z;
  const failures = record.decisions.filter(decision => decision.failure || decision.status === 'discarded').length;
  return <>
    <p>{results.endingCondition === 'stranded' ? 'Stranded rover. Safe completion failed.'
      : results.endingCondition === 'manual-stop' ? 'Stopped by mission control. Full expedition unfinished.'
        : atBase && !results.cargo.length ? 'Time budget reached at base with no undelivered cargo.'
          : 'Time budget reached. Safe return with all cargo was not completed.'}</p>
    <p>{atBase ? 'At base' : 'Away from base'} · {results.cargo.length} undelivered samples.</p>
    <p>{failures} failed or cancelled decision requests · {record.events.filter(event => event.type === 'usage-paused').length} usage pauses.</p>
  </>;
}

export function PresetAdherence({ record }: { record: ExpeditionRecord }) {
  const measured = presetAdherence(record);
  const presets = [...new Map(record.results.mission?.history.flatMap(entry => entry.preferences.mode === 'preset'
    ? [[`${entry.preferences.preset.id}-${entry.preferences.preset.version}`, entry.preferences.preset] as const] : [])).values()];
  if (!presets.length) return <p>Unavailable: no recorded preset adherence definitions. Free-text instructions have no numerical adherence score.</p>;
  const available = measured.returnMargins.filter(item => item.margin !== null);
  return <>
    <p>Whole-expedition energy used: {record.results.energyUsed.toFixed(2)} units. Delivered science: {record.results.scienceScore} points.</p>
    <p>Knowledge rate: {measured.knowledgeRate === null ? 'Unavailable at zero elapsed time' : `${measured.knowledgeRate.toFixed(2)} new terrain cells per simulated minute`}.</p>
    <p>Delivery fraction: {measured.deliveryFraction === null ? 'Unavailable before collection' : measured.deliveryFraction.toFixed(3)}.</p>
    <p>Return margin meets the recorded reserve at {available.filter(item => item.margin! >= item.required).length} of {available.length} decisions with a known return route. Unavailable at {measured.returnMargins.length - available.length} preset decisions.</p>
    <details><summary>Return margin at each preset decision</summary>
      {measured.returnMargins.map(item => <p key={item.decisionId}>Decision {item.decisionId} at {item.atMs} ms · {item.preset.label} v{item.preset.version}:
        {' '}{item.margin === null ? 'Unavailable without a known return route' : `${item.margin.toFixed(2)} energy units`} · Required reserve {item.required}.</p>)}
    </details>
    <p>Totals include the entire run, including free-text intervals and early termination. Return margins use only decisions with effective preset preferences.</p>
    {presets.map(preset => <details key={`${preset.id}-${preset.version}`}><summary>{preset.label} v{preset.version}, recorded adherence definitions v{preset.adherence.version}</summary>
      <dl>{preset.adherence.measures.map(measure => <div key={measure.id}><dt>{measure.id} · {measure.unit}</dt><dd>{measure.definition} {measure.limitation}</dd></div>)}</dl>
    </details>)}
  </>;
}

export function ControllerProvenance({ record }: { record: ExpeditionRecord }) {
  const baseline = record.decisions.filter(decision => decision.controller === 'baseline');
  const jev = record.decisions.filter(decision => decision.controller === 'typesafe');
  return <>
    <BenchmarkProvenance benchmark={record.startingConditions.benchmark} />
    <p>Record version {record.version} · Simulation {record.startingConditions.simulationVersion ?? 'legacy grid rules'} · Cadence {record.startingConditions.decisionCadence ?? 'legacy observation boundaries'}.</p>
    <p>Baseline decision versions: {[...new Set(baseline.map(decision => decision.baseline?.version ?? 'Unavailable'))].join(', ') || 'No baseline decisions'}.</p>
    <details><summary>Controller versions by decision and submission</summary>
      {baseline.map(decision => <p key={decision.id}>Decision {decision.id} · Baseline {decision.baseline?.version ?? 'Unavailable'} · {decision.status}</p>)}
      {jev.map(decision => <div key={decision.id}>
        <p>Decision {decision.id} at {decision.input.atMs} ms · Jev · {decision.status} · Wall-time latency {decision.latencyMs ?? 'Unavailable'} ms.</p>
        {!decision.accounting?.attempts.length && <p>Prompt, resolved model, and pricing metadata unavailable for this decision.</p>}
        {decision.accounting?.attempts.map(({ submission, evidence }) => <div key={submission.identity.attemptId}>
          <p>Submission {submission.identity.attemptId} · Prompt {evidence?.promptVersion ?? 'Unavailable'} · Requested model {evidence?.requestedModel ?? 'Unavailable'} · Resolved model {evidence?.resolvedModel ?? 'Unavailable'}.</p>
          {evidence?.pricing ? <p>Recorded pricing for {evidence.pricing.model}: {formatInferenceCost(evidence.pricing.inputPerMillion)} per million input tokens;
            {' '}{formatInferenceCost(evidence.pricing.outputPerMillion)} per million output tokens. Captured {evidence.pricing.capturedAt}, verified {evidence.pricing.verifiedAt}. <a href={evidence.pricing.source} target="_blank" rel="noreferrer">Pricing source</a></p>
            : <p>Recorded pricing: Unavailable.</p>}
        </div>)}
      </div>)}
    </details>
    {record.matchedFrom && <p>Matching source: {record.matchedFrom.recordId} · Record version {record.matchedFrom.recordVersion} · {record.matchedFrom.scheduleBasis} schedule.</p>}
    <p>Manual requests in this run: {record.results.interventions?.history.filter(item => item.source === 'manual').length ?? 'Unavailable in legacy record'}. Inspect the schedule for requested and delivered events.</p>
  </>;
}

export function BenchmarkProvenance({ benchmark }: { benchmark?: BenchmarkReference }) {
  return <>
    <p>Selected benchmark: {benchmark ? `${benchmark.name} v${benchmark.version} · ${benchmark.id}` : 'No benchmark recorded'}.</p>
    {benchmark && <p>{benchmark.description} Later edits remain in the mission history and schedule.</p>}
  </>;
}
