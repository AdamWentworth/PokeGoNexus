export interface TradeTargetsPanelListsState {
  wanted: Record<string, unknown>;
  [key: string]: unknown;
}

export type TradeTargetsPanelCopy = {
  eyebrow: string;
  title: string;
  description: string;
  listTitle: string;
};

export const normalizeTradeTargetEntries = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

export const normalizeListsState = (
  value: Record<string, Record<string, unknown>>,
): TradeTargetsPanelListsState => ({
  ...value,
  wanted: normalizeTradeTargetEntries(value.wanted),
});

export const resolveTradeTargetsPanelCopy = (isMirror: boolean): TradeTargetsPanelCopy =>
  isMirror
    ? {
        eyebrow: 'Mirror Trade',
        title: 'Mirror Match',
        description: 'Review the mirrored partner that matches this offer.',
        listTitle: 'Available Mirror',
      }
    : {
        eyebrow: 'Desired Return',
        title: 'Wanted Pokémon',
        description:
          'Choose the Pokémon you want in return for this For Trade listing.',
        listTitle: 'Wanted Pokémon',
      };
