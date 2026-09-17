import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, MathUtils } from 'three';
import type { ExpeditionSnapshot } from '../simulation/types';

export function Rover({ rover }: { rover: ExpeditionSnapshot['rover'] }) {
  const body = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!body.current) return;
    const group = body.current;
    group.position.x = MathUtils.damp(group.position.x, rover.position.x, 16, delta);
    group.position.z = MathUtils.damp(group.position.z, rover.position.z, 16, delta);
    const turn = Math.atan2(Math.sin(rover.heading - group.rotation.y), Math.cos(rover.heading - group.rotation.y));
    group.rotation.y += turn * (1 - Math.exp(-10 * delta));
  });

  return (
    <group ref={body} position={[rover.position.x, 0.18, rover.position.z]}>
      <group position={[0, Math.sin(rover.distance * 12) * 0.015, 0]}>
        <mesh castShadow position={[0, 0.4, 0]}>
          <boxGeometry args={[0.8, 0.35, 1.05]} />
          <meshStandardMaterial color="#e9dfcc" roughness={0.65} />
        </mesh>
        <mesh castShadow position={[0, 0.61, -0.12]}>
          <boxGeometry args={[0.74, 0.09, 0.7]} />
          <meshStandardMaterial color="#324851" metalness={0.55} roughness={0.32} />
        </mesh>
        {[-0.23, 0, 0.23].map(x => (
          <mesh key={x} position={[x, 0.659, -0.12]}>
            <boxGeometry args={[0.014, 0.006, 0.68]} /><meshStandardMaterial color="#a2bac0" />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.9, 0.3]}>
          <cylinderGeometry args={[0.035, 0.035, 0.65, 8]} /><meshStandardMaterial color="#ded7c5" />
        </mesh>
        <mesh castShadow position={[0, 1.2, 0.32]}>
          <boxGeometry args={[0.36, 0.18, 0.22]} /><meshStandardMaterial color="#d9a655" />
        </mesh>
        {[-0.1, 0.1].map(x => (
          <mesh key={x} position={[x, 1.2, 0.437]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.02, 12]} /><meshStandardMaterial color="#17272a" />
          </mesh>
        ))}
        {[-0.51, 0.51].flatMap(x => [-0.4, 0, 0.4].map(z => (
          <group key={`${x}-${z}`} position={[x, 0.18, z]} rotation={[rover.distance / 0.2, 0, 0]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, 0.18, 12]} /><meshStandardMaterial color="#293238" roughness={1} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.09, 0.09, 0.19, 8]} /><meshStandardMaterial color="#b2a58c" />
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <boxGeometry args={[0.19, 0.04, 0.05]} /><meshStandardMaterial color="#7b817d" />
            </mesh>
          </group>
        )))}
      </group>
      <Html position={[0, 1.8, 0]} center zIndexRange={[10, 0]}>
        <span className="scene-label rover-label">Rover · 01</span>
      </Html>
    </group>
  );
}
