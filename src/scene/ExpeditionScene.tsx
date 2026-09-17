import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { ExpeditionSnapshot, FullWorldView, StormObservation } from '../simulation/types';
import { Rover } from './Rover';
import { SceneCamera, type CameraMode } from './SceneCamera';

function PlanetaryArea({ snapshot, fullWorld }: { snapshot: ExpeditionSnapshot; fullWorld: FullWorldView | null }) {
  const currentIds = new Set(snapshot.observations.map(item => item.id));
  const terrain = fullWorld?.terrain ?? snapshot.memory.filter(item => item.kind === 'terrain');
  const samples = fullWorld?.samples ?? snapshot.memory.filter(item => item.kind === 'sample').filter(sample => sample.status === 'available');
  const storm = fullWorld ? fullWorld.storm : snapshot.memory.find((item): item is StormObservation => item.kind === 'dust-storm' && item.remainingMs > 0);
  const base = fullWorld ? { id: 'base', position: fullWorld.base } : snapshot.memory.find(item => item.kind === 'base');
  const rememberedIds = new Set(snapshot.memory.map(item => item.id));
  const knowledgeLabel = (id: string) => currentIds.has(id) ? 'In range' : rememberedIds.has(id) ? 'Remembered' : 'Hidden from rover';
  return (
    <group>
      <mesh position={[(snapshot.area.width - 1) / 2, -0.22, (snapshot.area.depth - 1) / 2]}>
        <boxGeometry args={[snapshot.area.width + 1, 0.4, snapshot.area.depth + 1]} /><meshStandardMaterial color="#394a4b" roughness={1} />
      </mesh>
      {terrain.map(cell => {
        const current = !!fullWorld || currentIds.has(cell.id);
        const { x, z } = cell.position;
        const rough = cell.terrain === 'rough';
        return <group key={cell.id} position={[x, 0, z]}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.98, 0.98]} /><meshStandardMaterial color={current ? rough ? '#ac8058' : '#d8b085' : rough ? '#716851' : '#8b8572'} roughness={1} />
          </mesh>
          {rough && <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}><planeGeometry args={[0.38, 0.38]} /><meshStandardMaterial color={current ? '#856043' : '#5d5949'} /></mesh>}
          {cell.blocked && <mesh castShadow receiveShadow position={[0, 0.28, 0]} rotation={[0.1, x + z, 0.13]} scale={[0.72, 0.75, 0.75]}>
            <dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color={current ? '#a37a61' : '#68645a'} flatShading roughness={1} />
          </mesh>}
        </group>;
      })}
      {samples.map(sample => {
        const current = !!fullWorld || currentIds.has(sample.id);
        return <group key={sample.id} position={[sample.position.x, 0.18, sample.position.z]}>
          <mesh castShadow><octahedronGeometry args={[0.25, 0]} /><meshStandardMaterial color={current ? '#aee9d6' : '#687f77'} roughness={0.7} /></mesh>
          <Html position={[0, 0.7, 0]} center zIndexRange={[9, 0]}><span className={`scene-label sample-label ${current ? '' : 'remembered'}`}>{sample.label} · {knowledgeLabel(sample.id)}</span></Html>
        </group>;
      })}
      {storm && <group position={[storm.position.x, 0, storm.position.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]}>
          <ringGeometry args={[storm.radius - 0.06, storm.radius, 64]} /><meshBasicMaterial color="#e8b869" transparent opacity={(fullWorld || currentIds.has(storm.id)) ? 0.9 : 0.45} />
        </mesh>
        <group rotation={[0, snapshot.elapsedMs / 6_000, 0]}>
          {Array.from({ length: 12 }, (_, index) => {
            const angle = index * Math.PI / 6;
            return <mesh key={index} position={[Math.cos(angle) * storm.radius * 0.6, 0.6 + index % 3 * 0.3, Math.sin(angle) * storm.radius * 0.6]} scale={[1.4, 0.4, 0.8]}>
              <sphereGeometry args={[storm.radius * 0.35, 12, 8]} /><meshStandardMaterial color="#d3a56b" transparent opacity={(fullWorld || currentIds.has(storm.id)) ? 0.14 : 0.05} depthWrite={false} roughness={1} />
            </mesh>;
          })}
        </group>
        <Html position={[0, 2.2, 0]} center zIndexRange={[8, 0]}><span className={`scene-label storm-label ${(fullWorld || currentIds.has(storm.id)) ? '' : 'remembered'}`}>Dust storm · {knowledgeLabel(storm.id)}</span></Html>
      </group>}
      {base && <group position={[base.position.x, 0.02, base.position.z]}>
        <mesh receiveShadow><cylinderGeometry args={[1.15, 1.2, 0.07, 32]} /><meshStandardMaterial color="#727c70" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.95, 1, 32]} /><meshBasicMaterial color="#d9e4bc" />
        </mesh>
        <mesh castShadow position={[-1.5, 0.5, 0]}><boxGeometry args={[0.75, 1, 0.8]} /><meshStandardMaterial color="#d4cdbc" /></mesh>
        <mesh castShadow position={[-1.5, 1.45, 0]}><cylinderGeometry args={[0.03, 0.03, 1.3, 8]} /><meshStandardMaterial color="#4f5a57" /></mesh>
        <mesh position={[-1.5, 2.12, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#8ee9cc" emissive="#60bf9e" emissiveIntensity={2} /></mesh>
        <mesh castShadow position={[-1.5, 1.04, 0.25]} rotation={[-0.2, 0, 0]}><boxGeometry args={[1.3, 0.06, 0.75]} /><meshStandardMaterial color="#3d5256" metalness={0.4} /></mesh>
        <Html position={[-1.7, 2.65, 0]} center zIndexRange={[10, 0]}><span className={`scene-label ${currentIds.has(base.id) ? '' : 'remembered'}`}>Base · 01{currentIds.has(base.id) ? '' : ' · Remembered'}</span></Html>
      </group>}
    </group>
  );
}

export function ExpeditionScene({ snapshot, getFullWorldView }: {
  snapshot: ExpeditionSnapshot; getFullWorldView(): FullWorldView;
}) {
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [showCoverage, setShowCoverage] = useState(true);
  const [showFullWorld, setShowFullWorld] = useState(false);
  const fullWorld = showFullWorld ? getFullWorldView() : null;
  return (
    <section className="scene" aria-label="Planetary scene">
      <div className="scene-top"><span className="map-tag">OB–01 <span>{showFullWorld ? 'Full-world view · DEBUG' : 'Rover knowledge'}</span></span><span className="map-north">N ↑</span></div>
      <div className="scene-controls" role="group" aria-label="Observation controls">
        <div className="camera-controls" role="group" aria-label="Camera perspective">
          <button aria-pressed={cameraMode === 'orbit'} onClick={() => setCameraMode('orbit')}>Orbit camera</button>
          <button aria-pressed={cameraMode === 'follow'} onClick={() => setCameraMode('follow')}>Follow rover</button>
        </div>
        <label><input type="checkbox" checked={showCoverage} onChange={event => setShowCoverage(event.target.checked)} />Sensor coverage</label>
        <label><input type="checkbox" checked={showFullWorld} onChange={event => setShowFullWorld(event.target.checked)} />Full-world debugging view</label>
      </div>
      {showFullWorld && <p className="debug-notice">Hidden terrain and objects revealed. Rover knowledge is unchanged.</p>}
      {showCoverage && <div className="sensor-legend">Sensor radius · <strong aria-label="Sensor coverage radius">{snapshot.sensorRange} cells</strong></div>}
      <Canvas shadows camera={{ position: [29, 27, 34], fov: 43 }} dpr={[1, 2]} fallback={<p className="webgl-fallback">A WebGL-capable browser is needed to display the planetary scene.</p>}>
        <color attach="background" args={['#bc9675']} />
        <ambientLight intensity={1.3} />
        <hemisphereLight args={['#ffedcd', '#79634f', 1.7]} />
        <directionalLight castShadow position={[-5, 22, 4]} intensity={3} shadow-mapSize={[2048, 2048]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-normalBias={0.04} />
        <PlanetaryArea snapshot={snapshot} fullWorld={fullWorld} />
        {showCoverage && <group position={[snapshot.rover.position.x, 0.075, snapshot.rover.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh><circleGeometry args={[snapshot.sensorRange, 96]} /><meshBasicMaterial color="#9aeae6" transparent opacity={0.12} depthWrite={false} /></mesh>
          <mesh position={[0, 0, 0.002]}><ringGeometry args={[Math.max(0, snapshot.sensorRange - 0.04), snapshot.sensorRange, 96]} /><meshBasicMaterial color="#c5ffff" transparent opacity={0.85} depthWrite={false} /></mesh>
        </group>}
        {snapshot.currentAction && 'target' in snapshot.currentAction && <group position={[snapshot.currentAction.target.position.x, 0.045, snapshot.currentAction.target.position.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.44, 32]} /><meshBasicMaterial color="#fff0c7" /></mesh>
          <Html position={[0, 0.45, 0]} center zIndexRange={[9, 0]}><span className="target-label active">{snapshot.currentAction.target.label}</span></Html>
        </group>}
        <Rover rover={snapshot.rover} />
        <SceneCamera mode={cameraMode} position={snapshot.rover.position} />
      </Canvas>
      <div className="scene-bottom"><span>{showFullWorld ? 'DEBUG · Full world visible' : 'Bright: in range · Dim: remembered · Dark: unknown'}</span><span>{cameraMode === 'follow' ? 'Following rover · Drag to look around' : 'Drag to orbit'} · Scroll to zoom</span></div>
    </section>
  );
}
