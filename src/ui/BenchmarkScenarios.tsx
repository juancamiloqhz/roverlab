import { benchmarkIds, benchmarkScenario, type BenchmarkId } from '../simulation/benchmarks';
import type { ExpeditionSnapshot } from '../simulation/types';

const choices = benchmarkIds.map(id => benchmarkScenario(id).benchmark);

export function BenchmarkScenarios({ snapshot, onSelect }: {
  snapshot: ExpeditionSnapshot; onSelect: (id: BenchmarkId | null) => void;
}) {
  return <section className="objective-block" aria-label="Benchmark scenario">
    <label className="field-label" htmlFor="benchmark-scenario">BENCHMARK SCENARIO</label>
    <select id="benchmark-scenario" disabled={snapshot.status !== 'ready'} value={snapshot.benchmark?.id ?? ''}
      onChange={event => onSelect(event.target.value ? event.target.value as BenchmarkId : null)}>
      <option value="">Free exploration</option>
      {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
    </select>
    {snapshot.benchmark ? <>
      <h3>{snapshot.benchmark.name} v{snapshot.benchmark.version}</h3>
      <p>{snapshot.benchmark.description}</p>
      <p>Ochre Basin · Three regions · 12 sites · Base 16 / 24 · 18 minutes.</p>
      <p>Start with 160 energy, empty cargo with two slots, and a sensor range of 3 cells. Inspection reveals properties; only delivery earns science.</p>
      <p>The objective, preset settings, and exact intervention schedule appear below. Both controllers receive the same preferences and external schedule.</p>
      <p>After completing or stopping, open the saved expedition and choose Run matched baseline, then Compare with source expedition.</p>
      <p>Selected starting benchmark. Later edits are recorded and may change comparison conditions. Reset restores a directly selected benchmark's objective, preferences, and schedule. After a matched baseline, Reset returns to free exploration.</p>
    </> : <p>Choose a benchmark before starting, or configure free exploration below.</p>}
    <p>Selection starts a fresh setup with default inference limits. Keyless baseline uses no provider calls. Scripted calibration does not establish live Jev quality or spending.</p>
  </section>;
}
