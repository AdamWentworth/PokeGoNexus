// transitionMessages.ts

import { PokemonInstance } from '@/types/pokemonInstance';
import type { InstanceStatus } from '@/types/instances';

// Canonical statuses used app-wide
type Canonical = 'Caught' | 'Trade' | 'Wanted' | 'Missing' | 'Unknown';

function normalizeStatus(status: string | InstanceStatus): Canonical {
  const s = String(status || '').trim().toLowerCase();
  switch (s) {
    case 'caught':
      return 'Caught';
    case 'trade':
      return 'Trade';
    case 'wanted':
      return 'Wanted';
    case 'missing':
      return 'Missing';
    default:
      return 'Unknown';
  }
}

// 1) Derive status from instance flags, using canonical names.
export function getStatusFromInstance(instance: PokemonInstance): InstanceStatus {
  if (instance.is_for_trade) return 'Trade' as InstanceStatus;
  if (instance.is_caught) return 'Caught' as InstanceStatus;
  if (instance.is_wanted) return 'Wanted' as InstanceStatus;
  return 'Missing' as InstanceStatus;
}

// 2) Transition copy per (from → to)
type TransitionFunction = (name: string) => string;

type TransitionMessageMap = {
  [from in Canonical]?: {
    [to in Canonical]?: TransitionFunction;
  };
};

const MESSAGES: TransitionMessageMap = {
  Caught: {
    Trade: (name) => `List ${name} for Trade?`,
    Wanted: (name) => `Create a duplicate ${name} for your Wanted list?`,
    // Key line: show transfer/release language when going from Caught → Missing
    Missing: (name) => `Transfer ${name}?`,
  },
  Trade: {
    Caught: (name) => `Remove ${name} from Trade Listing?`,
    Wanted: (name) => `Create a duplicate ${name} for your Wanted list?`,
    Missing: (name) => `Transfer ${name}?`,
  },
  Wanted: {
    Caught: (name) => `Caught ${name}?`,
    Trade: (name) => `Caught ${name} and list for Trade?`,
    Missing: (name) => `Remove ${name} from your Wanted list?`,
  },
  Missing: {
    Caught: (name) => `Caught ${name}?`,
    Trade: (name) => `Caught ${name} and list for Trade?`,
    Wanted: (name) => `List ${name} as Wanted?`,
  },
};

// 3) Return custom transition message or a fallback (with normalized labels)
export function getTransitionMessage(
  fromStatus: InstanceStatus,
  toStatus: InstanceStatus,
  displayName: string
): string {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);

  const fromMap = MESSAGES[from];
  const transitionFn = fromMap?.[to];

  if (transitionFn) return transitionFn(displayName);
  return `Move ${displayName} from ${from} to ${to}`;
}
