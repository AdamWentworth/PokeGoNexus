import type { PokemonInstance } from './instances';

export const receiverContract = {
  endpoints: {
    batchedUpdates: '/batchedUpdates',
  },
} as const;

export type ReceiverPokemonUpdate = Omit<Partial<PokemonInstance>, 'variant_id'> & {
  instance_id: string;
  variant_id?: string;
};

export interface ReceiverBatchedUpdatesPayload<
  TPokemonUpdate = ReceiverPokemonUpdate,
> {
  sync_batch_id: string;
  location: unknown | null;
  pokemonUpdates: TPokemonUpdate[];
}

export interface ReceiverBatchedUpdatesResponse {
  message: string;
}
