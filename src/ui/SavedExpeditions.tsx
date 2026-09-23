import { MissionPreferences } from './MissionPreferences';
import { InferenceLimitHistory } from './InferenceLimits';
import { useEffect, useRef, useState } from 'react';
import type { ExpeditionRecord } from '../simulation/types';
import { scientificObjectives } from '../simulation/science';
import { exportExpeditionRecord, importExpeditionRecord, MAX_RECORD_BYTES } from '../records/contract';
import { loadExpeditionRecords, saveExpeditionRecord } from '../records/storage';
import { DecisionTimeline, ObservationTable } from './DecisionTimeline';
import { ExpeditionResults } from './ExpeditionResults';
import { controllerLabels } from './controllerLabels';
import { createReplay, type ExpeditionSession } from '../simulation/expedition';
import { ExpeditionReplay } from './ExpeditionReplay';
import { ExpeditionScene } from '../scene/ExpeditionScene';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Expedition records are unavailable. Please try again.';
const mergeRecords = (existing: ExpeditionRecord[], added: ExpeditionRecord[]) =>
  [...new Map([...existing, ...added].map(record => [record.id, record])).values()]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

export function SavedExpeditions({ completedRecords, onOpen, onCompare, refreshInferenceUsage, refreshingUsage, usageRefreshMessage }: {
  refreshInferenceUsage: () => Promise<void>; refreshingUsage: boolean; usageRefreshMessage: string;
  completedRecords: ExpeditionRecord[]; onOpen: (record: ExpeditionRecord) => void;
  onCompare: (records: [ExpeditionRecord, ExpeditionRecord]) => void;
}) {
  const [records, setRecords] = useState<ExpeditionRecord[]>([]);
  const [savedIds, setSavedIds] = useState(new Set<string>());
  const [storageError, setStorageError] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const attempted = useRef(new Map<string, ExpeditionRecord>());
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadExpeditionRecords().then(loaded => {
      if (!active) return;
      setRecords(records => mergeRecords(loaded, records));
      setSavedIds(ids => new Set([...ids, ...loaded.map(record => record.id)]));
    }).catch(error => { if (active) setStorageError(errorMessage(error)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    for (const record of completedRecords) {
      const previous = attempted.current.get(record.id);
      if (previous?.events.length === record.events.length) continue;
      attempted.current.set(record.id, record);
      // Keep an in-memory copy available for export even if durable storage fails.
      setRecords(records => mergeRecords(records, [record]));
      setSavedIds(ids => { const next = new Set(ids); next.delete(record.id); return next; });
      saveQueue.current = saveQueue.current.then(() => saveExpeditionRecord(record, previous))
        .then(() => {
          if (attempted.current.get(record.id) === record) setSavedIds(ids => new Set([...ids, record.id]));
        }).catch(error => setStorageError(errorMessage(error)));
    }
  }, [completedRecords]);

  async function importFile(file: File) {
    setImporting(true);
    setImportError('');
    try {
      if (file.size > MAX_RECORD_BYTES) throw new Error('This expedition record is too large. The limit is 32 MB.');
      const record = importExpeditionRecord(await file.text());
      await saveExpeditionRecord(record);
      setRecords(records => mergeRecords(records, [record]));
      setSavedIds(ids => new Set([...ids, record.id]));
      onOpen(record);
    } catch (error) { setImportError(errorMessage(error)); }
    finally { setImporting(false); }
  }

  return <section id="saved-expeditions" className="record-library" aria-label="Saved expeditions">
    <div className="record-toolbar"><h3>Saved expeditions <span>{records.length}</span></h3>
      <label className="record-import">{importing ? 'Importing…' : 'Import expedition JSON'}
        <input type="file" aria-label="Import expedition JSON" accept=".json,application/json" disabled={importing} onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importFile(file);
        }} />
      </label>
    </div>
    <p className="memory-note">Completed expeditions save automatically in this browser. Open one to inspect its history; an active expedition will pause.</p>
    <div className="record-toolbar">
      <button className="secondary" disabled={refreshingUsage} onClick={() => void refreshInferenceUsage()}>
        {refreshingUsage ? 'Refreshing accounting…' : 'Refresh inference accounting'}
      </button>
      <p className="memory-note">Check for later evidence from submissions made on this page, including stopped expeditions. This sends no new Jev requests. Reopen a saved expedition to inspect updated accounting.</p>
    </div>
    {usageRefreshMessage && <p role="status">{usageRefreshMessage}</p>}
    <div className="record-toolbar comparison-selection">
      <p>Select two expeditions to compare their conditions and results. Comparing pauses an active expedition.</p>
      <button className="secondary" disabled={comparisonIds.length !== 2} onClick={() => {
        const left = records.find(record => record.id === comparisonIds[0]);
        const right = records.find(record => record.id === comparisonIds[1]);
        if (left && right) onCompare([left, right]);
      }}>Compare selected expeditions</button>
      {comparisonIds.length > 0 && <button className="secondary" onClick={() => setComparisonIds([])}>Clear selection</button>}
    </div>
    {storageError && <p role="alert">{storageError}</p>}
    {importError && <p role="alert">{importError}</p>}
    {records.length === 0 ? <p className="memory-note">No saved expeditions yet.</p> : <ul>
      {records.map(record => <li key={record.id}>
        <input type="checkbox" aria-label={`Compare expedition ${record.id}`} checked={comparisonIds.includes(record.id)}
          disabled={comparisonIds.length === 2 && !comparisonIds.includes(record.id)} onChange={event => {
            setComparisonIds(ids => event.target.checked ? [...ids, record.id] : ids.filter(id => id !== record.id));
          }} />
        <div><strong>{scientificObjectives[record.results.objective]} · {record.results.scienceScore} science points</strong>
          <small>{new Date(record.completedAt).toLocaleString()} · {record.results.controllerHistory.map(entry => controllerLabels[entry.controller]).join(' → ')}</small>
          <small>{savedIds.has(record.id) ? 'Saved in this browser' : 'Not saved yet · Open to export a copy'}</small>
        </div>
        <button className="secondary" onClick={() => onOpen(record)} aria-label={`Open expedition ${record.id}`}>Open expedition</button>
      </li>)}
    </ul>}
  </section>;
}

export function SavedExpeditionView({ record, onClose }: { record: ExpeditionRecord; onClose: () => void }) {
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  const selectedDecision = record.decisions.find(item => item.id === selectedDecisionId);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState<ExpeditionSession | null>(null);
  function startReplay() {
    setError('');
    try {
      const session = createReplay(record);
      session.dispatch({ type: 'start' });
      setReplay(session);
    } catch (error) { setError(errorMessage(error)); }
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportExpeditionRecord(record)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `roverlab-${record.id}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) { setError(errorMessage(error)); }
  }
  return <section className="saved-expedition" aria-label="Saved expedition">
    <p className="eyebrow">SAVED EXPEDITION · READ ONLY</p>
    <h2>{record.results.area.name}</h2>
    <p>Scenario {record.startingConditions.scenario.id} · Simulation {record.startingConditions.simulationVersion ?? 'Legacy grid rules'} · {record.startingConditions.durationMs / 60_000}-minute budget</p>
    <p>Completed {new Date(record.completedAt).toLocaleString()}. Inspecting this history requires no API key.</p>
    <div className="record-toolbar">
      <button className="secondary" onClick={onClose}>Return to live expedition</button>
      {replay ? <button className="secondary" onClick={() => setReplay(null)}>Back to saved record</button>
        : <button className="primary" onClick={startReplay}>Replay expedition</button>}
      <button className="primary" onClick={download}>Export expedition JSON</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {replay && <ExpeditionReplay session={replay} />}
    {replay && <h3>Recorded final results</h3>}
    <ExpeditionResults snapshot={record.results} />
    <InferenceLimitHistory record={record} />
    <MissionPreferences snapshot={record.results} />
    <p>Final mission instructions: {record.results.instructions || 'None supplied.'} · Version {record.results.instructionsVersion}</p>
    <p>Delivery rubric: unrelated {record.results.rubric.unrelated}, suggestive {record.results.rubric.suggestive}, strong evidence {record.results.rubric['strong-evidence']}.</p>
    {!replay && <>
      {selectedDecision && <ExpeditionScene snapshot={record.results} decision={selectedDecision} historical onInspect={setSelectedDecisionId} />}
      <DecisionTimeline decisions={record.decisions} controllerHistory={record.results.controllerHistory} selectedDecisionId={selectedDecisionId} onSelect={setSelectedDecisionId} />
      <ObservationTable title="Final observations" observations={record.results.observations} />
      <ObservationTable title="Final rover memory" observations={record.results.memory} />
    </>}
  </section>;
}
