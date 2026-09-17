import { useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Position } from '../simulation/types';

export type CameraMode = 'orbit' | 'follow';

export function SceneCamera({ mode, position }: { mode: CameraMode; position: Position }) {
  const camera = useThree(state => state.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousMode = useRef<CameraMode>('orbit');
  const orbitView = useRef({ position: new Vector3(29, 27, 34), target: new Vector3(10, 0, 9) });
  const target = useRef(new Vector3());
  const shift = useRef(new Vector3());

  // Presentation frames remain active during manual and decision pauses.
  // Following translates the camera and its target together, retaining user zoom/rotation.
  useFrame(() => {
    const orbit = controls.current;
    if (!orbit) return;
    target.current.set(position.x, 0.65, position.z);
    if (previousMode.current !== mode) {
      if (mode === 'follow') {
        orbitView.current.position.copy(camera.position);
        orbitView.current.target.copy(orbit.target);
        camera.position.copy(target.current).add(new Vector3(4.5, 4, 6));
        orbit.target.copy(target.current);
      } else {
        camera.position.copy(orbitView.current.position);
        orbit.target.copy(orbitView.current.target);
      }
      previousMode.current = mode;
    }
    if (mode === 'follow') {
      shift.current.subVectors(target.current, orbit.target);
      camera.position.add(shift.current);
      orbit.target.copy(target.current);
    }
  }, -2);

  return <OrbitControls ref={controls} makeDefault target={[10, 0, 9]}
    minDistance={mode === 'follow' ? 2.6 : 8} maxDistance={mode === 'follow' ? 16 : 48}
    maxPolarAngle={Math.PI / 2.15} enablePan={mode === 'orbit'} enableDamping={false} />;
}
