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
    <group ref={body} position={[rover.position.x, 0.02, rover.position.z]}>
      <group position={[0, 0.16 + Math.sin(rover.distance * 9) * 0.02, 0]} rotation={[Math.sin(rover.distance * 5) * 0.025, 0, Math.sin(rover.distance * 7) * 0.025]}>
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
      </group>
      {/* Distance drives only visual articulation; stationary and frozen expeditions hold their pose. */}
      {[-1, 1].map(side => <group key={side}>
        <mesh castShadow position={[side * 0.44, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} /><meshStandardMaterial color="#b2a58c" metalness={0.5} />
        </mesh>
        {[-0.55, 0, 0.55].map((z, index) => {
          const phase = index * 1.7 + side;
          const wheelY = 0.22 + (Math.sin(rover.distance * 8 + phase) - Math.sin(phase)) * 0.025;
          const armLength = Math.hypot(z, wheelY - 0.48);
          return <group key={z}>
            <mesh castShadow position={[side * 0.51, (0.48 + wheelY) / 2, z / 2]} rotation={[Math.atan2(z, wheelY - 0.48), 0, 0]}>
              <boxGeometry args={[0.07, armLength, 0.07]} /><meshStandardMaterial color="#d4b783" metalness={0.45} roughness={0.55} />
            </mesh>
            <group position={[side * 0.6, wheelY, z]} rotation={[rover.distance / 0.22, 0, 0]}>
              <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.22, 0.22, 0.2, 16]} /><meshStandardMaterial color="#293238" roughness={1} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.11, 0.11, 0.215, 12]} /><meshStandardMaterial color="#b2a58c" metalness={0.5} />
              </mesh>
              {[0, Math.PI / 3, Math.PI * 2 / 3].map(angle => <mesh key={angle} position={[side * 0.112, 0, 0]} rotation={[angle, 0, 0]}>
                <boxGeometry args={[0.025, 0.32, 0.035]} /><meshStandardMaterial color="#d7ccb3" />
              </mesh>)}
              {Array.from({ length: 10 }, (_, tread) => {
                const angle = tread * Math.PI / 5;
                return <mesh key={tread} position={[0, Math.cos(angle) * 0.22, Math.sin(angle) * 0.22]} rotation={[angle, 0, 0]}>
                  <boxGeometry args={[0.21, 0.022, 0.055]} /><meshStandardMaterial color="#697373" roughness={0.9} />
                </mesh>;
              })}
            </group>
          </group>;
        })}
      </group>)}
      <Html position={[0, 1.8, 0]} center zIndexRange={[10, 0]}>
        <span className="scene-label rover-label">Rover · 01</span>
      </Html>
    </group>
  );
}
