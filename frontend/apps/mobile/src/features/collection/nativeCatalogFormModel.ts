import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon, Fusion, MegaEvolution } from '@pokemongonexus/shared-contracts/pokemon';

export type NativeCatalogCopyChoice = { kind: 'new' } | { kind: 'existing'; instanceId: string };
export type NativeCatalogFormChoice =
  | { kind: 'mega'; base: NativeCatalogCopyChoice }
  | { kind: 'fusion'; base: NativeCatalogCopyChoice; partner: NativeCatalogCopyChoice };

type FormBase = { variantId: string; pokemon: BasePokemon; shiny: boolean };
export type NativeCatalogForm =
  | (FormBase & { kind: 'mega'; mega: MegaEvolution })
  | (FormBase & { kind: 'fusion'; fusion: Fusion; partner: BasePokemon });

export const isNativeCatalogFormVariant = (variantId: string): boolean =>
  /^\d+-(?:shiny_)?(?:mega(?:_[^_]+)?|primal|fusion_\d+)$/.test(variantId);

export const resolveNativeCatalogForm = (
  catalog: BasePokemon[],
  variantId: string,
): NativeCatalogForm | null => {
  if (!isNativeCatalogFormVariant(variantId)) return null;
  const pokemon = catalog.find((candidate) => candidate.pokemon_id === Number(variantId.split('-')[0]));
  if (!pokemon) throw new Error('This Pokémon is no longer in the catalog.');
  const shiny = variantId.includes('-shiny_');
  const suffix = variantId.slice(variantId.indexOf('-') + 1).replace(/^shiny_/, '');
  if (suffix.startsWith('fusion_')) {
    const fusion = pokemon.fusion?.find((candidate) => candidate.fusion_id === Number(suffix.slice(7))
      && candidate.base_pokemon_id1 === pokemon.pokemon_id);
    const partner = catalog.find((candidate) => candidate.pokemon_id === fusion?.base_pokemon_id2);
    if (!fusion || !partner) throw new Error('The Pokémon required for this fusion are unavailable.');
    return { kind: 'fusion', pokemon, partner, fusion, shiny, variantId };
  }
  const mega = pokemon.megaEvolutions?.find((candidate) => candidate.primal
    ? suffix === 'primal'
    : suffix === `mega${candidate.form?.trim() ? `_${candidate.form.trim().toLowerCase()}` : ''}`);
  if (!mega) throw new Error('This Mega or Primal form is no longer available.');
  return { kind: 'mega', pokemon, mega, shiny, variantId };
};

export const isNativeCatalogFormCandidate = (
  instance: PokemonInstance,
  form: NativeCatalogForm,
  side: 'base' | 'partner',
): boolean => {
  const pokemonId = side === 'partner' && form.kind === 'fusion'
    ? form.partner.pokemon_id : form.pokemon.pokemon_id;
  return instance.pokemon_id === pokemonId
    && Boolean(instance.is_caught)
    && !instance.is_wanted && !instance.is_for_trade && !instance.disabled
    && !instance.is_fused && !instance.fused_with && !instance.is_mega && !instance.crown
    && !instance.shadow && !(form.kind === 'fusion' && instance.purified)
    && !instance.variant_id?.toLowerCase().includes('clone')
    // The fusion's appearance follows the base; either partner appearance works.
    && (side === 'partner' || Boolean(instance.shiny) === form.shiny);
};

export const nativeCatalogChoiceIds = (choice: NativeCatalogFormChoice): string[] =>
  [choice.base, ...(choice.kind === 'fusion' ? [choice.partner] : [])]
    .flatMap((copy) => copy.kind === 'existing' ? [copy.instanceId] : []);
