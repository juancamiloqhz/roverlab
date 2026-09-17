import type { DustStorm, Position, StormObservation, Observation } from './types';

// Fraction of a straight movement segment inside the circular region while active.
export function stormExposure(start: Position, end: Position, durationMs: number, atMs: number, storm?: DustStorm | null): number {
  if (!storm || atMs >= storm.expiresAtMs) return 0;
  const dx = end.x - start.x, dz = end.z - start.z;
  const x = start.x - storm.position.x, z = start.z - storm.position.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return 0;
  const projection = x * dx + z * dz;
  const discriminant = projection * projection - lengthSquared * (x * x + z * z - storm.radius * storm.radius);
  if (discriminant <= 0) return 0;
  const entry = Math.max(0, (-projection - Math.sqrt(discriminant)) / lengthSquared);
  const exit = Math.min(1, (storm.expiresAtMs - atMs) / durationMs, (-projection + Math.sqrt(discriminant)) / lengthSquared);
  return Math.max(0, exit - entry);
}

export function knownStorm(memory: Observation[]): StormObservation | undefined {
  return memory.find((item): item is StormObservation => item.kind === 'dust-storm' && item.remainingMs > 0);
}
