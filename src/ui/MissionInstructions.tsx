import { useState } from 'react';
import { MAX_MISSION_INSTRUCTIONS_LENGTH, missionPreset, presetIdSchema } from '../../shared/mission';
import type { ExpeditionCommand, ExpeditionSnapshot } from '../simulation/types';
import { MissionPreferences } from './MissionPreferences';

export function MissionInstructions({ snapshot, dispatch }: { snapshot: ExpeditionSnapshot; dispatch: (command: ExpeditionCommand) => void }) {
  const [draft, setDraft] = useState(snapshot.instructions);
  const preferences = snapshot.mission?.requested.preferences;
  const mode = preferences?.mode ?? 'free-text';
  const tooLong = draft.length > MAX_MISSION_INSTRUCTIONS_LENGTH;
  const ended = snapshot.status === 'ended';
  return <section className="instructions-block" aria-label="Mission preferences">
    <label className="field-label" htmlFor="mission-mode">Mission mode</label>
    <select id="mission-mode" value={mode} disabled={ended} onChange={event => {
      if (event.target.value === 'preset') dispatch({ type: 'set-mission-preset', preset: 'balanced' });
      else dispatch({ type: 'set-instructions', instructions: tooLong ? '' : draft });
    }}>
      <option value="free-text">Free-text experiment</option>
      <option value="preset">Preset priorities</option>
    </select>
    {preferences?.mode === 'preset' ? <>
      <label className="field-label" htmlFor="mission-preset">Mission priority preset</label>
      <select id="mission-preset" value={preferences.preset.id} disabled={ended}
        onChange={event => dispatch({ type: 'set-mission-preset', preset: presetIdSchema.parse(event.target.value) })}>
        {presetIdSchema.options.map(id => <option key={id} value={id}>{missionPreset(id).label}</option>)}
      </select>
    </> : <form onSubmit={event => {
      event.preventDefault();
      if (!tooLong) dispatch({ type: 'set-instructions', instructions: draft });
    }}>
      <label className="field-label" htmlFor="mission-instructions">Mission instructions</label>
      <textarea id="mission-instructions" rows={4} aria-describedby="instructions-limit" aria-invalid={tooLong} value={draft} disabled={ended} onChange={event => setDraft(event.target.value)} placeholder="Describe your expedition priorities…" />
      <button className="secondary" type="submit" disabled={ended || tooLong || draft === snapshot.instructions}>Apply instructions</button>
      <p id="instructions-limit" className="memory-note" aria-live="polite">{tooLong
        ? 'Mission instructions must be 20,000 characters or fewer before applying.'
        : `${draft.length.toLocaleString()} / ${MAX_MISSION_INSTRUCTIONS_LENGTH.toLocaleString()} characters.`}</p>
      <p className="memory-note" aria-label="Instruction status">{snapshot.mission && snapshot.mission.requested.version !== snapshot.mission.effective.version && !ended
        ? 'Instructions saved. Reconsidering at the next safe waypoint; short interactions finish first.'
        : `Instructions saved · Version ${snapshot.instructionsVersion}.`}</p>
      <p className="memory-note">{snapshot.controller === 'typesafe' ? 'TypeSafe uses your instructions when choosing its next action.' : 'The baseline receives your instructions and reconsiders using its fixed rules; it does not interpret free-form preferences.'}</p>
    </form>}
    <MissionPreferences snapshot={snapshot} />
  </section>;
}
