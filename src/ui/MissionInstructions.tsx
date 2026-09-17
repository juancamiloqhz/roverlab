import { useState } from 'react';
import type { ExpeditionCommand, ExpeditionSnapshot } from '../simulation/types';

export function MissionInstructions({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch: (command: ExpeditionCommand) => void }) {
  const [draft, setDraft] = useState(snapshot.instructions);
  return <form className="instructions-block" onSubmit={event => {
    event.preventDefault();
    dispatch({ type: 'set-instructions', instructions: draft });
  }}>
    <label className="field-label" htmlFor="mission-instructions">Mission instructions</label>
    <textarea id="mission-instructions" rows={4} value={draft} disabled={snapshot.status === 'ended'} onChange={event => setDraft(event.target.value)} placeholder="Describe your expedition priorities…" />
    <button className="secondary" type="submit" disabled={snapshot.status === 'ended' || draft === snapshot.instructions}>Apply instructions</button>
    <p className="memory-note" aria-label="Instruction status">{snapshot.reconsiderationReason === 'instructions-changed' && snapshot.status !== 'ready'
      ? 'Instructions saved. Reconsidering at the next safe waypoint; short interactions finish first.'
      : `Instructions saved · Version ${snapshot.instructionsVersion}.`}</p>
    <p className="memory-note">The baseline receives your instructions and reconsiders using its fixed rules; it does not interpret free-form preferences. The scientific objective stays fixed.</p>
  </form>;
}
