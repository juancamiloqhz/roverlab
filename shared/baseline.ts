import { z } from 'zod';

export const BASELINE_VERSION = 'evidence-priorities-v1';
export const baselineRules = {
  recharge: 'Recharge at base when at least 10% of battery capacity is missing.',
  'return-reserve': 'Return because the known route leaves at most the requested energy reserve.',
  'return-time': 'Return with cargo before the known journey and a 15-second planning margin use the remaining time.',
  'deliver-full': 'Deliver because both cargo slots are occupied.',
  'survey-pause': 'Wait one bounded interval after completing a frontier survey.',
  'ranked-opportunity': 'Choose the eligible opportunity with the highest weighted evidence, knowledge, and delivery benefit after known energy and travel costs.',
  'deliver-cargo': 'Deliver because delivery preferences favor returning with cargo over the remaining opportunities.',
  'return-for-recharge': 'Return because no further opportunity fits the known energy and time plan.',
  'storm-wait': 'Wait for a detected storm due to expire within ten seconds before following an exposed route.',
  'no-opportunity': 'Wait because no opportunity fits the evidence and resource rules.',
} as const;
export type BaselineRule = keyof typeof baselineRules;
const number = z.number().finite().nonnegative();
const identity = z.string().min(1).max(200);
export const baselineEvidenceSchema = z.strictObject({
  version: z.literal(BASELINE_VERSION),
  rule: z.enum(Object.keys(baselineRules) as [BaselineRule, ...BaselineRule[]]),
  preferenceSource: z.enum(['shared-preset', 'balanced-default']),
  returnCandidateId: identity.nullable(),
  opportunities: z.array(z.strictObject({
    candidateId: identity,
    evidence: z.enum(['unknown', 'no-match', 'suggestive', 'supported', 'not-applicable']),
    matchedProperties: z.array(z.string().max(20_000)).max(100),
    plannedEnergy: number.nullable(), plannedDurationMs: number.nullable(),
    utility: z.number().finite(), eligible: z.boolean(),
    exclusion: z.enum(['unknown-properties', 'no-relevant-evidence', 'return-unknown', 'energy', 'time']).nullable(),
  })).max(10_000),
});
export type BaselineEvidence = z.infer<typeof baselineEvidenceSchema>;
