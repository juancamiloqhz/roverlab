import { createExpedition } from '../../src/simulation/expedition';
import { firstPlayableScenario } from './first-playable-scenario';

// Preserve the original regression scenarios when the playable default changes.
export function createFirstPlayableExpedition(options: Parameters<typeof createExpedition>[0] = {}) {
  return createExpedition({ ...options, scenario: options.scenario ?? firstPlayableScenario });
}
