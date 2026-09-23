import { Html } from '@react-three/drei';
import type { Decision, Position } from '../simulation/types';

export function DecisionTargets({ decision, onInspect }: { decision: Decision; onInspect?: (id: number) => void }) {
  const groups = new Map<string, { position: Position; candidates: { index: number; label: string; selected: boolean }[] }>();
  decision.input.candidates.forEach((candidate, index) => {
    const position = 'target' in candidate ? candidate.target.position : candidate.kind === 'recharge'
      ? decision.input.memory.find(item => item.kind === 'base')?.position : decision.input.position;
    if (!position) return;
    const label = 'target' in candidate ? `${candidate.kind} · ${candidate.target.label}` : candidate.kind === 'wait' ? 'wait · Rover' : 'recharge · Base';
    const key = `${position.x},${position.z}`;
    const group = groups.get(key) ?? { position, candidates: [] };
    group.candidates.push({ index, label, selected: candidate.id === decision.selectedCandidateId });
    groups.set(key, group);
  });
  return <group>{[...groups].map(([key, { position, candidates }]) => {
    const selected = candidates.some(item => item.selected);
    return <group key={key} position={[position.x, 0.1, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, selected ? Math.PI / 4 : 0]}>
        <ringGeometry args={[selected ? 0.52 : 0.32, selected ? 0.65 : 0.39, selected ? 4 : 32]} />
        <meshBasicMaterial color={selected ? '#fff3ba' : '#9fe5e6'} depthTest={false} />
      </mesh>
      <Html position={[0, 1.2, 0]} center zIndexRange={[14, 11]}><div className="decision-target-group">
        {candidates.map(item => <button key={item.index} className={`decision-target${item.selected ? ' selected' : ''}`}
          aria-label={`Inspect decision ${decision.id} target ${item.index + 1}: ${item.selected ? 'Selected' : 'Offered'} ${item.label}`}
          title={`Decision ${decision.id} · ${item.label}`}
          onClick={() => onInspect?.(decision.id)}>
          #{item.index + 1} {item.selected ? '◆ Selected' : '○'}{item.label.includes('Rover') || item.label.includes('Base') ? ` · ${item.label}` : ''}
        </button>)}
      </div></Html>
    </group>;
  })}</group>;
}
