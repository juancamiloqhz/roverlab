import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { authoredScenario } from '../simulation/scenario';
import type { ExpeditionSnapshot } from '../simulation/types';
import { Rover } from './Rover';

function PlanetaryArea() {
  const { base, obstacles } = authoredScenario;
  return (
    <group>
      <mesh receiveShadow position={[10, -0.42, 9]}>
        <boxGeometry args={[23, 0.8, 21]} /><meshStandardMaterial color="#ad7450" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[10, 0, 9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[23, 21]} /><meshStandardMaterial color="#c89970" roughness={1} />
      </mesh>
      <gridHelper args={[22, 22, '#a17e60', '#a17e60']} position={[10, 0.015, 9]} material-transparent material-opacity={0.22} />
      {obstacles.map(({ x, z }, index) => (
        <mesh key={`${x}-${z}`} castShadow receiveShadow position={[x, 0.28, z]} rotation={[0.1, index * 1.7, 0.13]} scale={[0.72, 0.65 + index % 3 * 0.18, 0.75]}>
          <dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color={index % 2 ? '#8e6853' : '#a37a61'} flatShading roughness={1} />
        </mesh>
      ))}
      <group position={[base.x, 0.02, base.z]}>
        <mesh receiveShadow><cylinderGeometry args={[1.15, 1.2, 0.07, 32]} /><meshStandardMaterial color="#727c70" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.95, 1, 32]} /><meshBasicMaterial color="#d9e4bc" />
        </mesh>
        <mesh castShadow position={[-1.5, 0.5, 0]}><boxGeometry args={[0.75, 1, 0.8]} /><meshStandardMaterial color="#d4cdbc" /></mesh>
        <mesh castShadow position={[-1.5, 1.45, 0]}><cylinderGeometry args={[0.03, 0.03, 1.3, 8]} /><meshStandardMaterial color="#4f5a57" /></mesh>
        <mesh position={[-1.5, 2.12, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#8ee9cc" emissive="#60bf9e" emissiveIntensity={2} /></mesh>
        <mesh castShadow position={[-1.5, 1.04, 0.25]} rotation={[-0.2, 0, 0]}><boxGeometry args={[1.3, 0.06, 0.75]} /><meshStandardMaterial color="#3d5256" metalness={0.4} /></mesh>
        <Html position={[-1.7, 2.65, 0]} center zIndexRange={[10, 0]}><span className="scene-label">Base · 01</span></Html>
      </group>
    </group>
  );
}

export function ExpeditionScene({ snapshot }: { snapshot: ExpeditionSnapshot }) {
  return (
    <section className="scene" aria-label="Planetary scene">
      <div className="scene-top"><span className="map-tag">OB–01 <span>Authored area</span></span><span className="map-north">N ↑</span></div>
      <Canvas shadows camera={{ position: [29, 27, 34], fov: 43 }} dpr={[1, 2]} fallback={<p className="webgl-fallback">A WebGL-capable browser is needed to display the planetary scene.</p>}>
        <color attach="background" args={['#bc9675']} />
        <ambientLight intensity={1.3} />
        <hemisphereLight args={['#ffedcd', '#79634f', 1.7]} />
        <directionalLight castShadow position={[-5, 22, 4]} intensity={3} shadow-mapSize={[2048, 2048]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-normalBias={0.04} />
        <PlanetaryArea />
        {authoredScenario.explorationTargets.map((target, index) => {
          const reached = snapshot.exploredTargetIds.includes(target.id);
          const active = snapshot.currentAction?.kind === 'explore' && snapshot.currentAction.target.id === target.id;
          return (
            <group key={target.id} position={[target.position.x, 0.045, target.position.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.44, 32]} /><meshBasicMaterial color={active ? '#fff0c7' : reached ? '#426d65' : '#816c52'} /></mesh>
              <Html position={[0, 0.45, 0]} center zIndexRange={[9, 0]}><span className={`target-label ${active ? 'active' : ''}`}>{String(index + 1).padStart(2, '0')} · {target.label}</span></Html>
            </group>
          );
        })}
        <Rover rover={snapshot.rover} />
        <OrbitControls makeDefault target={[10, 0, 9]} minDistance={8} maxDistance={48} maxPolarAngle={Math.PI / 2.15} enableDamping />
      </Canvas>
      <div className="scene-bottom"><span><i className="legend-dot" /> Rover <i className="legend-square" /> Base <i className="legend-ring" /> Exploration target</span><span>Drag to orbit · Scroll to zoom</span></div>
    </section>
  );
}
