import { z } from 'zod';
import type { ControllerInput } from '../src/simulation/types';

export const DECISION_DEADLINE_MS = 5_000;
export const INFERENCE_LIMIT = 100;
const number = z.number().finite().nonnegative();
const text = z.string().max(20_000);
const identity = z.string().min(1).max(200);
const position = z.strictObject({ x: number, z: number });
const observed = { id: identity, position, observedAtMs: number };
const observation = z.discriminatedUnion('kind', [
  z.strictObject({ ...observed, kind: z.literal('terrain'), terrain: z.enum(['plain', 'rough']), blocked: z.boolean() }),
  z.strictObject({ ...observed, kind: z.literal('base') }),
  z.strictObject({ ...observed, kind: z.literal('sample'), sampleId: identity, label: text,
    status: z.enum(['available', 'cargo', 'delivered']), properties: z.array(text).optional(), inspectedAtMs: number.optional() }),
]);
const actionFields = {
  target: z.strictObject({ id: identity, label: text, position }),
  routeEstimate: z.strictObject({ distanceCells: number, durationMs: number, energy: number }),
};
const action = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('explore'), ...actionFields }),
  z.strictObject({ kind: z.literal('inspect'), ...actionFields }),
  z.strictObject({ kind: z.literal('collect'), ...actionFields }),
  z.strictObject({ kind: z.literal('return-to-base'), ...actionFields }),
  z.strictObject({ kind: z.literal('recharge'), durationMs: number.positive() }),
  z.strictObject({ kind: z.literal('wait'), durationMs: number.positive() }),
]);
const candidate = z.discriminatedUnion('kind', [
  action.options[0].extend({ id: identity }), action.options[1].extend({ id: identity }),
  action.options[2].extend({ id: identity }), action.options[3].extend({ id: identity }),
  action.options[4].extend({ id: identity }), action.options[5].extend({ id: identity }),
]);
export const controllerInputSchema: z.ZodType<ControllerInput> = z.strictObject({
  remainingMs: number, energyUsed: number, instructions: text, instructionsVersion: number.int(),
  battery: number, batteryCapacity: number.positive(), objective: z.enum(['past-water', 'unusual-minerals']),
  cargo: z.array(z.strictObject({ sampleId: identity, label: text })).max(2), cargoCapacity: number.int().positive(),
  atMs: number, position, sensorRange: number, observations: z.array(observation).max(10_000),
  memory: z.array(observation).max(10_000), candidates: z.array(candidate).min(1).max(10_000),
  previousAction: z.union([action, candidate]).nullable(),
}).refine(input => new Set(input.candidates.map(item => item.id)).size === input.candidates.length);

export const failureSchema = z.enum(['configuration', 'unavailable', 'deadline', 'invalid-output', 'invalid-request', 'budget', 'cancelled']);
export type DecisionFailure = z.infer<typeof failureSchema>;
export const failureMessages: Record<DecisionFailure, string> = {
  configuration: 'TypeSafe is not configured or rejected the server credential. Configure the server key before retrying.',
  unavailable: 'The TypeSafe service could not complete the decision.',
  deadline: 'The decision exceeded its five-second wall-clock deadline.',
  'invalid-output': 'TypeSafe returned an invalid decision. No action was executed.',
  'invalid-request': 'The decision request was invalid.',
  budget: 'The 100-attempt inference budget is exhausted.',
  cancelled: 'The obsolete decision was cancelled.',
};
export const choiceSchema = z.strictObject({
  type: z.literal('choice'), choice: identity, confidence: z.number().min(0).max(1),
  probabilities: z.record(identity, z.number().finite().min(0).max(1)),
});
export type ReturnedChoice = z.infer<typeof choiceSchema>;
export function validChoice(value: unknown, input: ControllerInput): ReturnedChoice | null {
  const parsed = choiceSchema.safeParse(value);
  if (!parsed.success) return null;
  const choice = parsed.data;
  const ids = input.candidates.map(candidate => candidate.id);
  if (!ids.includes(choice.choice) || Object.keys(choice.probabilities).length !== ids.length
    || ids.some(id => !Object.hasOwn(choice.probabilities, id))
    || Math.abs(Object.values(choice.probabilities).reduce((sum, p) => sum + p, 0) - 1) > 0.01) return null;
  return choice;
}
export const requestSchema = z.strictObject({ input: controllerInputSchema, expiresAt: number });
export const responseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), choice: choiceSchema }),
  z.strictObject({ ok: z.literal(false), failure: failureSchema, retryable: z.boolean() }),
]);
export type DecisionResponse = z.infer<typeof responseSchema>;
export type DecisionOutcome = { selectedCandidateId?: string; probabilities?: Record<string, number>; confidence?: number; failure?: DecisionFailure };
export type DecisionClock = { now(): number; after(ms: number, callback: () => void): () => void };
export const wallClock: DecisionClock = {
  now: () => Date.now(),
  after(ms, callback) { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
};
