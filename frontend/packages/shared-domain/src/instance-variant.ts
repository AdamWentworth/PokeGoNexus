import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';

type InstanceIdentity = Pick<PokemonInstance, 'variant_id' | 'pokemon_id' | 'costume_id' | 'shiny' | 'shadow' | 'purified'>;
type Resolver = (instance: InstanceIdentity) => PokemonVariant | undefined;
const resolvers = new WeakMap<PokemonVariant[], Resolver>();

/** Resolve legacy display identities without changing any saved instance. */
export const getInstanceVariantResolver = (variants: PokemonVariant[]): Resolver => {
  const cached = resolvers.get(variants);
  if (cached) return cached;
  const byId = new Map(variants.map((variant) => [variant.variant_id, variant]));
  const byKind = new Map(variants.map((variant) => [`${variant.pokemon_id}:${variant.variantType}`, variant]));
  const resolve: Resolver = (instance) => {
    const exact = instance.variant_id ? byId.get(instance.variant_id) : undefined;
    if (exact) return exact;
    const shadow = instance.shadow && !instance.purified;
    if (instance.costume_id != null) {
      // Costume names in old IDs can contain damaged Unicode. The numeric
      // costume identity and recorded qualities remain unambiguous.
      const kind = shadow
        ? `${instance.shiny ? 'shiny_' : ''}shadow_costume_${instance.costume_id}`
        : `costume_${instance.costume_id}${instance.shiny ? '_shiny' : ''}`;
      return byKind.get(`${instance.pokemon_id}:${kind}`);
    }
    if (instance.variant_id) return undefined;
    const kind = shadow ? `${instance.shiny ? 'shiny_' : ''}shadow` : instance.shiny ? 'shiny' : 'default';
    return byKind.get(`${instance.pokemon_id}:${kind}`);
  };
  resolvers.set(variants, resolve);
  return resolve;
};
