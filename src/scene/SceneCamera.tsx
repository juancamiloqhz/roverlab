import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Position } from '../simulation/types';

export type CameraMode = 'orbit' | 'follow';

export function SceneCamera({ mode, position, area }: { mode: CameraMode; position: Position; area: { width: number; depth: number } }) {
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);
  const center = useMemo(() => [(area.width - 1) / 2, 0, (area.depth - 1) / 2] as [number, number, number], [area.width, area.depth]);
  const halfFov = camera instanceof PerspectiveCamera ? camera.fov * Math.PI / 360 : Math.PI / 8;
  const limitingAngle = Math.atan(Math.tan(halfFov) * Math.min(1, size.width / size.height));
  const distance = Math.hypot(area.width, area.depth) / 2 / Math.sin(limitingAngle) * 1.08;
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousMode = useRef<CameraMode>('orbit');
  const orbitView = useRef({ position: new Vector3(), target: new Vector3(...center) });
  const target = useRef(new Vector3());
  const shift = useRef(new Vector3());

  useLayoutEffect(() => {
    const target = new Vector3(...center);
    orbitView.current = { target, position: new Vector3(19, 27, 25).normalize().multiplyScalar(distance).add(target) };
    if (previousMode.current === 'orbit') {
      camera.position.copy(orbitView.current.position);
      controls.current?.target.copy(target);
      controls.current?.update();
    }
  }, [camera, center, distance]);

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

  return <OrbitControls ref={controls} makeDefault target={center}
    minDistance={mode === 'follow' ? 2.6 : 8} maxDistance={mode === 'follow' ? 16 : distance * 1.8}
    maxPolarAngle={Math.PI / 2.15} enablePan={mode === 'orbit'} enableDamping={false} />;
}
