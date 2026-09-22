import type { MissionPreferences as Preferences, MissionRevision } from '../../shared/mission';
import type { ExpeditionSnapshot } from '../simulation/types';

export const preferenceLabel = (preferences: Preferences) => preferences.mode === 'preset'
  ? `Preset priorities · ${preferences.preset.label}` : 'Free-text experiment';

export function MissionEvidence({ mission }: { mission: MissionRevision }) {
  const preferences = mission.preferences;
  if (preferences.mode === 'free-text') return <div>
    <p>Free-text experiment · Mission version {mission.version}</p>
    <blockquote>{preferences.instructions || 'No mission instructions supplied.'}</blockquote>
  </div>;
  const { preset } = preferences;
  const settings = preset.settings;
  return <div>
    <p>{preferenceLabel(preferences)} · Mission version {mission.version} · Preset definition version {preset.version}</p>
    <p>Science weight: {settings.scienceWeight} · Delivery weight: {settings.deliveryWeight} · Energy weight: {settings.energyWeight} · Exploration weight: {settings.explorationWeight}</p>
    <p>Return reserve: {settings.returnReserveEnergy} energy units above the known return-route estimate.</p>
    <details><summary>Preset settings and adherence definitions</summary>
      <p>Weights express relative emphasis in dimensionless units. Science favors observed evidence relevant to the objective; delivery favors bringing cargo to base; energy favors preserving battery and lower route costs; exploration favors acquiring knowledge. The reserve is a preference, not a movement constraint or safety guarantee.</p>
      <p>Adherence definitions version {preset.adherence.version}. Report these measures separately. They do not form an overall AI score.</p>
      <dl>{preset.adherence.measures.map(measure => <div key={measure.id}>
        <dt>{measure.id} · {measure.unit}</dt><dd>{measure.definition} {measure.limitation}</dd>
      </div>)}</dl>
    </details>
  </div>;
}

export function MissionPreferences({ snapshot }: { snapshot: ExpeditionSnapshot }) {
  const mission = snapshot.mission;
  if (!mission) return <div><p>Free-text experiment · Legacy instructions version {snapshot.instructionsVersion}</p>
    <blockquote>{snapshot.instructions || 'No mission instructions supplied.'}</blockquote>
    <p>The baseline cannot interpret arbitrary free text. This is not a matched-priority benchmark.</p></div>;
  const pending = mission.requested.version !== mission.effective.version;
  return <div>
    <h3>Mission preferences</h3>
    <p>Active: {preferenceLabel(mission.effective.preferences)} · Effective version {mission.effective.version}</p>
    {pending && <p>Requested version {mission.requested.version}: {preferenceLabel(mission.requested.preferences)}. {snapshot.status === 'ended'
      ? 'Not applied before expedition ended.' : 'Waiting for a safe action boundary. Short interactions finish first.'}</p>}
    <MissionEvidence mission={mission.requested} />
    {mission.requested.preferences.mode === 'free-text'
      ? <p>The baseline cannot interpret arbitrary free text. This is not a matched-priority benchmark.</p>
      : <p>Both controllers receive the same preset settings. Inspect the baseline version and its use of those settings in the decision timeline. Older records may lack rule evidence.</p>}
    <p>The scientific objective and delivery rubric stay fixed during the expedition.</p>
    <details><summary>Mission preference history</summary>
      <ol>{mission.history.map((entry, index) => <li key={entry.version}>
        <p>Version {entry.version} · {preferenceLabel(entry.preferences)} · Requested at {entry.requestedAtMs} ms</p>
        <p>{entry.appliedAtMs !== null ? `Applied at ${entry.appliedAtMs} ms`
          : index < mission.history.length - 1 ? 'Superseded before application'
            : snapshot.status === 'ended' ? 'Not applied before expedition ended' : 'Waiting for a safe action boundary'}</p>
        <MissionEvidence mission={entry} />
      </li>)}</ol>
    </details>
  </div>;
}
