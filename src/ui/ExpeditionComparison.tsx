import type { ReactNode } from 'react';
import type { ExpeditionRecord, ExpeditionStartingConditions } from '../simulation/types';
import { sameRecordData } from '../records/history';
import { scientificObjectives } from '../simulation/science';
import { controllerLabels } from './controllerLabels';
import { formatTime } from './formatTime';

function simulationSettings(start: ExpeditionStartingConditions) {
  const { scenario, objective, rubric, instructions, controller, ...settings } = start;
  return settings;
}

function instructionHistory(record: ExpeditionRecord) {
  const started = record.events.find(event => event.type === 'started')!;
  return [
    { when: 'Initial', atMs: 0, instructions: record.startingConditions.instructions },
    ...record.events.filter(event => event.type === 'instructions-changed').map(event => ({
      when: event.sequence < started.sequence ? 'Before start' : 'During expedition',
      atMs: event.atMs, instructions: event.instructions,
    })),
  ];
}

function interventions(record: ExpeditionRecord) {
  const started = record.events.find(event => event.type === 'started')!;
  return record.events.filter(event => event.type === 'storm-introduced').map(event => ({
    when: event.sequence < started.sequence ? 'Before start' : 'During expedition',
    atMs: event.atMs, storm: event.storm,
  }));
}

function EnvironmentalInterventions({ record }: { record: ExpeditionRecord }) {
  const introductions = interventions(record);
  if (!introductions.length) return <>No storm introduced.</>;
  return <>{introductions.map(({ atMs, when, storm }, index) => {
    const detected = record.events.find(event => event.type === 'storm-detected' && event.storm.id === storm.id);
    return <div key={index}>
      <p>{when} · Dust storm at {formatTime(atMs)} ({atMs} ms), expires at {formatTime(storm.expiresAtMs)} ({storm.expiresAtMs} ms).</p>
      <p>Center ({storm.position.x}, {storm.position.z}), radius {storm.radius} cells; sensing {storm.sensorRange} cells; movement energy ×{storm.movementEnergyMultiplier}.</p>
      <p>{detected ? `Detected at ${formatTime(detected.atMs)} (${detected.atMs} ms).` : 'Never detected by the rover.'}</p>
    </div>;
  })}</>;
}

type ComparisonRow = { label: string; render: (record: ExpeditionRecord) => ReactNode; matches?: boolean };
function ComparisonTable({ title, records, rows }: {
  title: string; records: [ExpeditionRecord, ExpeditionRecord]; rows: ComparisonRow[];
}) {
  return <div className="comparison-table" tabIndex={0}><table>
    <caption>{title}</caption>
    <thead><tr><th scope="col">Measure</th>{records.map((record, index) => <th scope="col" key={record.id}>Expedition {index + 1}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.label}>
      <th scope="row">{row.label}{row.matches !== undefined && <span className={`comparison-match ${row.matches ? '' : 'different'}`}>{row.matches ? 'Match' : 'Different'}</span>}</th>
      {records.map(record => <td key={record.id}>{row.render(record)}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

function ScenarioConditions({ record }: { record: ExpeditionRecord }) {
  const scenario = record.startingConditions.scenario;
  return <><p>{scenario.name} · {scenario.id}</p>
    <p>{scenario.width} × {scenario.depth} cells · Base ({scenario.base.x}, {scenario.base.z}) · Sensor range {scenario.sensorRange} cells</p>
    <details><summary>Recorded terrain, samples, and storm configuration</summary>
      <p>Obstacles: {scenario.obstacles.map(cell => `(${cell.x}, ${cell.z})`).join(', ') || 'None'}</p>
      <p>Rough terrain: {scenario.roughTerrain.map(cell => `(${cell.x}, ${cell.z})`).join(', ') || 'None'}</p>
      {scenario.samples.map(sample => <p key={sample.id}>{sample.label} ({sample.position.x}, {sample.position.z}): {sample.properties.join('; ')}.
        {' '}Water: {sample.classifications['past-water']}; minerals: {sample.classifications['unusual-minerals']}.</p>)}
      {scenario.dustStorm ? <p>Storm center ({scenario.dustStorm.position.x}, {scenario.dustStorm.position.z}), radius {scenario.dustStorm.radius} cells;
        {' '}{scenario.dustStorm.durationMs / 1_000} seconds; sensing {scenario.dustStorm.sensorRange} cells; movement energy ×{scenario.dustStorm.movementEnergyMultiplier}.</p>
        : <p>No storm configured.</p>}
    </details>
  </>;
}

function SimulationSettings({ record }: { record: ExpeditionRecord }) {
  const start = record.startingConditions;
  return <><p>{formatTime(start.durationMs)} budget · {start.cargoCapacity} cargo slots · {start.initialBattery} / {start.batteryCapacity} initial battery</p>
    <details><summary>Timing and energy rates</summary>
      <p>Travel: {start.travelTimeMs.plain / 1_000}s plain / {start.travelTimeMs.rough / 1_000}s rough per cell.</p>
      <p>Movement energy: {start.movementEnergy.plain} plain / {start.movementEnergy.rough} rough per cell.</p>
      <p>Inspect {start.inspectMs / 1_000}s · Collect {start.collectMs / 1_000}s · Wait {start.waitMs / 1_000}s.</p>
      <p>Recharge {start.rechargePerSecond} units/s · Simulation step {start.fixedStepMs} ms.</p>
    </details>
  </>;
}

export function ExpeditionComparison({ records, onClose, onOpen }: {
  records: [ExpeditionRecord, ExpeditionRecord]; onClose: () => void; onOpen: (record: ExpeditionRecord) => void;
}) {
  const [left, right] = records;
  const scenarioMatches = sameRecordData(left.startingConditions.scenario, right.startingConditions.scenario);
  const settingsMatch = sameRecordData(simulationSettings(left.startingConditions), simulationSettings(right.startingConditions));
  // Pre-start objective selections are recorded as events; results carry the fixed objective actually used.
  const objectiveMatches = left.results.objective === right.results.objective;
  const rubricMatches = sameRecordData(left.results.rubric, right.results.rubric);
  const instructionsMatch = sameRecordData(instructionHistory(left), instructionHistory(right));
  const interventionsMatch = sameRecordData(interventions(left), interventions(right));
  const conditionsMatch = scenarioMatches && settingsMatch && objectiveMatches && rubricMatches && interventionsMatch;
  return <section className="expedition-comparison" aria-label="Expedition comparison">
    <p className="eyebrow">SAVED EXPEDITIONS · READ ONLY</p>
    <div className="record-toolbar"><h2>Compare expeditions</h2><button className="secondary" onClick={onClose}>Return to live expedition</button></div>
    <p role="status" className={`comparison-status ${conditionsMatch ? '' : 'different'}`}>{conditionsMatch
      ? 'Matching starting conditions, objective, rubric, and environmental interventions.'
      : 'Conditions differ. Interpret the results with the differences below.'}</p>
    <div className="comparison-records">{records.map((record, index) => <div key={record.id}>
      <h3>Expedition {index + 1}</h3><p>{new Date(record.completedAt).toLocaleString()}</p><small>{record.id}</small>
      <button className="secondary" onClick={() => onOpen(record)}>Inspect expedition {index + 1}</button>
    </div>)}</div>
    <ComparisonTable title="Comparison conditions" records={records} rows={[
      { label: 'Scientific objective', matches: objectiveMatches, render: record => scientificObjectives[record.results.objective] },
      { label: 'Delivery rubric', matches: rubricMatches, render: ({ results: { rubric } }) => `Unrelated ${rubric.unrelated} · Suggestive ${rubric.suggestive} · Strong evidence ${rubric['strong-evidence']}` },
      { label: 'Starting scenario', matches: scenarioMatches, render: record => <ScenarioConditions record={record} /> },
      { label: 'Simulation settings', matches: settingsMatch, render: record => <SimulationSettings record={record} /> },
      { label: 'Environmental interventions', matches: interventionsMatch, render: record => <EnvironmentalInterventions record={record} /> },
    ]} />
    <p>{instructionsMatch ? 'Mission instruction histories match.' : 'Mission instruction histories differ.'} Instructions and controllers are comparison variables.</p>
    <ComparisonTable title="Instructions and controllers" records={records} rows={[
      { label: 'Mission instructions', render: record => <ol className="instruction-history">{instructionHistory(record).map((entry, index) => <li key={index}>
        <strong>{entry.when} · {formatTime(entry.atMs)} ({entry.atMs} ms)</strong><p>{entry.instructions || 'None supplied.'}</p>
      </li>)}</ol> },
      { label: 'Controller history', render: record => <>{new Set(record.results.controllerHistory.map(entry => entry.controller)).size > 1 && <strong>Mixed-controller expedition</strong>}
        {record.results.controllerHistory.map((entry, index) => <p key={index}>{controllerLabels[entry.controller]} · {formatTime(entry.atMs)} ({entry.atMs} ms)</p>)}
      </> },
    ]} />
    <ComparisonTable title="Simulation results" records={records} rows={[
      { label: 'Science score', render: record => record.results.scienceScore },
      { label: 'Samples delivered', render: record => record.results.deliveredSamples.length },
      { label: 'Samples discovered', render: record => record.results.discoveryCount },
      { label: 'Terrain cells discovered', render: record => record.results.memory.filter(item => item.kind === 'terrain').length },
      { label: 'Samples inspected', render: record => record.results.inspectionCount },
      { label: 'Uncredited cargo', render: record => record.results.cargo.length },
      { label: 'Energy used', render: record => `${record.results.energyUsed.toFixed(2)} units` },
      { label: 'Battery remaining', render: record => `${record.results.battery.toFixed(2)} / ${record.results.batteryCapacity}` },
      { label: 'Expedition time', render: record => `${formatTime(record.results.elapsedMs)} (${record.results.elapsedMs / 1_000}s)` },
      { label: 'Ending condition', render: record => ({ timeout: 'Time budget reached', 'manual-stop': 'Stopped by mission control', stranded: 'Stranded rover' })[record.results.endingCondition!] },
    ]} />
    <ComparisonTable title="Inference metrics" records={records} rows={[
      { label: 'Inference attempts', render: record => record.results.inferenceAttempts },
      { label: 'Total request latency (wall time)', render: record => `${record.results.inferenceLatencyMs.toFixed(0)} ms` },
    ]} />
    <p>Inference latency does not consume expedition time. Inspect each expedition’s decision timeline for its returned probabilities; these are not science scores or a guarantee of correctness.</p>
  </section>;
}
