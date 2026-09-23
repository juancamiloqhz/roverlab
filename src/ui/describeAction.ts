import type { Action, ExpeditionSnapshot } from '../simulation/types';

export function describeAction(action: Action | null, status: ExpeditionSnapshot['status']) {
  switch (action?.kind) {
    case 'explore': return {
      label: `Explore · ${action.target.label}`, description: 'Following a grid route to the next target.',
    };
    case 'inspect': return {
      label: `Inspect · ${action.target.label}`, description: 'Travel to the sample, then examine it for six seconds to reveal its properties.',
    };
    case 'collect': return {
      label: `Collect · ${action.target.label}`, description: 'Travel to the sample, then spend four seconds collecting it into cargo.',
    };
    case 'return-to-base': return {
      label: 'Return to base', description: 'Travel to base. Cargo unloads automatically; recharging is a separate action.',
    };
    case 'recharge': return {
      label: 'Recharge at base', description: 'Replenishing the battery. Expedition time continues; accumulated energy use is preserved.',
    };
    case 'wait': return {
      label: `Wait · ${action.durationMs / 1_000} seconds`, description: 'A bounded pause. Expedition time continues.',
    };
    default: return status === 'ended'
      ? { label: 'Expedition ended', description: 'Reset to explore the same starting area again.' }
      : { label: 'Awaiting start', description: 'Start when you are ready. The baseline needs no API key.' };
  }
}
