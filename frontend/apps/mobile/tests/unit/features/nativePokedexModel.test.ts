import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { buildNativePokedexEntries, filterNativePokedexEntries, mergeNativePokedexSpecies, nativePokedexEntryIsRegistered } from '../../../src/features/tools/nativePokedexModel';

const base = {
  pokemon_id: 25, name: 'Pikachu', pokedex_number: 25, generation: 1,
  image_url: '/pikachu.png', image_url_shiny: '/pikachu-shiny.png',
  image_url_shadow: '/pikachu-shadow.png', image_url_shiny_shadow: '/pikachu-shiny-shadow.png',
  shiny_available: 1, date_shadow_available: '2020-01-01', date_shiny_shadow_available: '2021-01-01',
  costumes: [{ costume_id: 1, name: 'detective', date_available: '2020-01-01', date_shiny_available: '2024-01-01', shiny_available: true, image_url: '/detective.png', image_url_shiny: '/detective-shiny.png' }],
  max: [{ pokemon_id: 25, dynamax: true, gigantamax: false, dynamax_release_date: '2024-01-01', gigantamax_release_date: null }],
  megaEvolutions: [], fusion: [], crownForms: [], type_1_icon: '/electric.png', type_2_icon: '',
} as unknown as BasePokemon;

describe('native Pokédex model', () => {
  it('projects every canonical variant and registration state', () => {
    const entries = buildNativePokedexEntries([base], {
      caught: { instance_id: 'caught', pokemon_id: 25, variant_id: '0025-shiny', is_caught: true },
    } as never);
    expect(entries.find(({ id }) => id === '0025-shiny')?.registered).toBe(true);
    expect(entries.find(({ category }) => category === 'costume')?.releaseDate).toBe('2020-01-01');
    expect(entries.find(({ category }) => category === 'shiny costume')?.releaseDate).toBe('2024-01-01');
    expect(entries.some(({ category }) => category === 'dynamax')).toBe(true);
    expect(entries.find(({ id }) => id === '0025-shiny')?.registeredSpecies).toBe(true);
  });

  it('filters by region, exact variant category, name, and dex number', () => {
    const entries = buildNativePokedexEntries([base]);
    expect(filterNativePokedexEntries({ entries, category: 'shiny', generation: 1, query: '25' }).every(({ id }) => id.includes('shiny'))).toBe(true);
    expect(filterNativePokedexEntries({ entries, category: 'pokemon', generation: 2, query: '' })).toEqual([]);
    expect(filterNativePokedexEntries({ entries, category: 'shiny costume', generation: 1, query: '' }).map(({ name }) => name)).toEqual(['Shiny Detective Pikachu']);
  });

  it('keeps missing species visible while qualities change the registration state like the web Pokédex', () => {
    const entries = buildNativePokedexEntries([base], {
      caught: {
        instance_id: 'caught', pokemon_id: 25, variant_id: '0025-shiny', is_caught: true,
        attack_iv: 15, defense_iv: 15, stamina_iv: 15, gender: 'Female', lucky: true,
      },
    } as never);
    const visible = filterNativePokedexEntries({ entries, category: 'shiny', facets: ['lucky', 'perfect', 'female'], generation: 1, query: '' });
    const missingQuality = filterNativePokedexEntries({ entries, category: 'shiny', facets: ['male'], generation: 1, query: '' });
    expect(visible.map(({ id }) => id)).toEqual(['0025-shiny']);
    expect(nativePokedexEntryIsRegistered(visible[0]!, 'shiny', ['lucky', 'perfect', 'female'])).toBe(true);
    expect(missingQuality.map(({ id }) => id)).toEqual(['0025-shiny']);
    expect(nativePokedexEntryIsRegistered(missingQuality[0]!, 'shiny', ['male'])).toBe(false);
  });

  it('removes only species that cannot support the selected gender', () => {
    const femaleOnly = { ...base, gender_rate: '0M/100F' } as unknown as BasePokemon;
    const entries = buildNativePokedexEntries([femaleOnly]);
    expect(filterNativePokedexEntries({ entries, category: 'pokemon', facets: ['male'], generation: 1, query: '' })).toEqual([]);
    expect(filterNativePokedexEntries({ entries, category: 'pokemon', facets: ['female'], generation: 1, query: '' })).toHaveLength(1);
  });

  it('derives parent registrations from an exact collectible variant like Vite', () => {
    const collectible = buildNativePokedexEntries([base]).find(({ category }) => category === 'shiny costume');
    expect(collectible).toBeTruthy();
    const entries = buildNativePokedexEntries([base], {
      caught: {
        instance_id: 'caught-costume',
        pokemon_id: 25,
        variant_id: collectible!.id,
        is_caught: true,
        lucky: true,
        attack_iv: 15,
        defense_iv: 15,
        stamina_iv: 15,
      },
    } as never);
    const shiny = entries.find(({ category }) => category === 'shiny');

    expect(collectible?.id).toContain('shiny');
    expect(shiny).toMatchObject({
      registered: true,
      registeredCategory: true,
      registeredSpecies: true,
    });
    expect(filterNativePokedexEntries({
      entries,
      category: 'shiny',
      facets: ['lucky', 'perfect'],
      generation: 1,
      query: '',
    })).toHaveLength(1);
  });

  it('collapses species-level categories by Pokédex number like the web index', () => {
    const alternate = {
      ...base,
      pokemon_id: 1025,
      name: 'Pikachu Alternate Form',
      image_url: '/pikachu-alternate.png',
      image_url_shiny: '/pikachu-alternate-shiny.png',
    } as never;
    const entries = buildNativePokedexEntries([alternate, base]);

    expect(filterNativePokedexEntries({ entries, category: 'pokemon', generation: 1, query: '' }))
      .toHaveLength(1);
    expect(filterNativePokedexEntries({ entries, category: 'shiny', generation: 1, query: '' }))
      .toHaveLength(1);
    expect(filterNativePokedexEntries({ entries, category: 'costume', generation: 1, query: '' }).length)
      .toBeGreaterThan(1);
  });

  it('aggregates species registration across alternate records sharing a dex number', () => {
    const alternate = {
      ...base,
      pokemon_id: 1025,
      name: 'Pikachu Alternate Form',
    } as never;
    const entries = buildNativePokedexEntries([base, alternate], {
      caught: { instance_id: 'caught', pokemon_id: 1025, variant_id: '1025-default', is_caught: true },
    } as never);

    expect(entries.filter(({ pokedexNumber }) => pokedexNumber === 25))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ registeredSpecies: true }),
      ]));
    expect(entries.filter(({ pokedexNumber }) => pokedexNumber === 25).every(({ registeredSpecies }) => registeredSpecies))
      .toBe(true);
  });

  it('adds unreleased species from the canonical Pokédex chunk without duplicating released rows', () => {
    const releasedCatalog = [base];
    const speciesCatalog = [
      { pokemon_id: 25, pokedex_number: 25, name: 'Pikachu', generation: 1, form: null, gender_rate: 'M/F', image_url: '/pikachu.png', available: 1 },
      { pokemon_id: 10000, pokedex_number: 999, name: 'Futuremon', generation: 10, form: null, gender_rate: null, image_url: '/future.png', available: 0 },
    ];
    const merged = mergeNativePokedexSpecies(releasedCatalog, speciesCatalog);
    const entries = buildNativePokedexEntries(merged);
    expect(filterNativePokedexEntries({ entries, category: 'pokemon', generation: null, query: '' }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Futuremon', pokedexNumber: 999, released: false })]));
    expect(entries.find(({ name }) => name === 'Pikachu')?.released).toBe(true);
    expect(merged.filter(({ pokemon_id: pokemonId }) => pokemonId === 25)).toHaveLength(1);
    expect(mergeNativePokedexSpecies(releasedCatalog, speciesCatalog)).toBe(merged);
  });
});
