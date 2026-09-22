import { z } from 'zod';

export const DECISION_CADENCE = 'meaningful-boundaries-v1';
export const decisionTriggerSchema = z.enum([
  'start', 'action-completed', 'instructions-changed', 'mission-changed',
  'sample-discovered', 'sample-inspected', 'storm-detected', 'storm-expired', 'storm-effects-changed',
  'battery-reserve', 'return-time', 'cargo-full', 'retry', 'controller-changed',
]);
export type DecisionTrigger = z.infer<typeof decisionTriggerSchema>;
export const decisionBoundarySchema = z.strictObject({
  version: z.literal(DECISION_CADENCE),
  triggers: z.array(decisionTriggerSchema).min(1).max(decisionTriggerSchema.options.length)
    .refine(triggers => new Set(triggers).size === triggers.length),
});
export type DecisionBoundary = z.infer<typeof decisionBoundarySchema>;
