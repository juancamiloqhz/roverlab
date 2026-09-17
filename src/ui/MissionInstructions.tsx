import { useState } from 'react';
import { MAX_MISSION_INSTRUCTIONS_LENGTH } from '../../shared/decisions';
import type { ExpeditionCommand, ExpeditionSnapshot } from '../simulation/types';

export function MissionInstructions({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch: (command: ExpeditionCommand) => void }) {
  const [draft, setDraft] = useState(snapshot.instructions);
  const tooLong = draft.length > MAX_MISSION_INSTRUCTIONS_LENGTH;
  return <form className="instructions-block" onSubmit={event => {
    event.preventDefault();
    if (tooLong) return;
    dispatch({ type: 'set-instructions', instructions: draft });
  }}>
    <label className="field-label" htmlFor="mission-instructions">Mission instructions</label>
    <textarea id="mission-instructions" rows={4} aria-describedby="instructions-limit" aria-invalid={tooLong} value={draft} disabled={snapshot.status === 'ended'} onChange={event => setDraft(event.target.value)} placeholder="Describe your expedition priorities…" />
    <button className="secondary" type="submit" disabled={snapshot.status === 'ended' || tooLong || draft === snapshot.instructions}>Apply instructions</button>
    <p id="instructions-limit" className="memory-note" aria-live="polite">{tooLong
      ? 'Mission instructions must be 20,000 characters or fewer before applying.'
      : `${draft.length.toLocaleString()} / ${MAX_MISSION_INSTRUCTIONS_LENGTH.toLocaleString()} characters.`}</p>
    <p className="memory-note" aria-label="Instruction status">{snapshot.reconsiderationReason === 'instructions-changed' && snapshot.status !== 'ready'
      ? 'Instructions saved. Reconsidering at the next safe waypoint; short interactions finish first.'
      : `Instructions saved · Version ${snapshot.instructionsVersion}.`}</p>
    <p className="memory-note">{snapshot.controller === 'typesafe' ? 'TypeSafe uses your instructions when choosing its next action.' : 'The baseline receives your instructions and reconsiders using its fixed rules; it does not interpret free-form preferences.'} The scientific objective stays fixed.</p>
  </form>;
}
