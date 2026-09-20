// src/features/variants/utils/createPokemonVariants.ts
import { determineVariantId } from '../../../utils/determineVariantId';
import { matchFormsAndVariantType } from '../../../utils/formMatcher';
import { getDisplayName } from '../../../utils/displayName';

import type { BasePokemon } from '../../../types/pokemonBase';
import type { PokemonVariant, VariantKind } from '../../../types/pokemonVariants';
import type { Costume, MegaEvolution, Fusion, MaxForm, RaidBoss } from '../../../types/pokemonSubTypes';

// Utility for constructing type icons
const getTypeIcon = (typeName?: string) =>
  typeName ? `/images/types/${typeName.toLowerCase()}.png` : '';

export const isCatalogEntryReleased = (
  dateAvailable?: string | null,
  now = Date.now(),
): boolean => {
  if (!dateAvailable) return true;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateAvailable);
  const releaseTime = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ).getTime()
    : Date.parse(dateAvailable);
  return Number.isNaN(releaseTime) || releaseTime <= now;
};

const createPokemonVariants = (pokemons: BasePokemon[]): PokemonVariant[] => {
  const generateVariants = (pokemon: BasePokemon): PokemonVariant[] => {
    const variants: PokemonVariant[] = [];
    const raidBosses = pokemon.raid_boss || [];

    // Finalize in one place to avoid duplicate transform work.
    const addVariant = (variant: PokemonVariant) => {
      variant.variant_id = determineVariantId(variant);
      variant.name = getDisplayName(variant);

      const shouldKeepRaidBoss = raidBosses.some((raidBoss: RaidBoss) =>
        matchFormsAndVariantType(variant.form, raidBoss.form, variant.variantType, {
          raidBossName: raidBoss.name,
          raidBossTier: raidBoss.tier,
          raidBossCostumeId: raidBoss.costume_id,
          variantName: variant.species_name || variant.name,
        }),
      );

      if (shouldKeepRaidBoss) {
        variants.push(variant);
      } else {
        const variantWithoutRaidBoss: PokemonVariant = { ...variant };
        delete variantWithoutRaidBoss.raid_boss;
        variants.push(variantWithoutRaidBoss);
      }
    };

    /* ---------- default variant ---------- */
    const defaultVariant: PokemonVariant = {
      ...pokemon,
      type_1_icon: pokemon.type_1_icon || '',
      type_2_icon: pokemon.type_2_icon || '',
      species_name: pokemon.name,
      currentImage: pokemon.image_url,
      variantType: 'default',
      variant_id: '',
    };
    addVariant(defaultVariant);

    /* ---------- shiny variant ---------- */
    if (pokemon.shiny_available) {
      const shinyVariant: PokemonVariant = {
        ...defaultVariant,
        currentImage: pokemon.image_url_shiny,
        variantType: 'shiny',
      };
      addVariant(shinyVariant);
    }

    /* ---------- shadow & shiny shadow variants ---------- */
    if (pokemon.date_shadow_available) {
      const shadowVariant: PokemonVariant = {
        ...defaultVariant,
        currentImage: pokemon.image_url_shadow || pokemon.image_url,
        variantType: 'shadow',
      };
      addVariant(shadowVariant);

      if (pokemon.date_shiny_shadow_available) {
        const shinyShadowVariant: PokemonVariant = {
          ...defaultVariant,
          currentImage: pokemon.image_url_shiny_shadow || pokemon.image_url_shiny,
          variantType: 'shiny_shadow',
        };
        addVariant(shinyShadowVariant);
      }
    }

    /* ---------- costume variants ---------- */
    pokemon.costumes?.forEach((costume: Costume) => {
      const costumeVariant: PokemonVariant = {
        ...defaultVariant,
        currentImage: costume.image_url,
        variantType: `costume_${costume.costume_id}` as VariantKind,
      };
      addVariant(costumeVariant);

      if (costume.shiny_available && costume.image_url_shiny) {
        const costumeShinyVariant: PokemonVariant = {
          ...defaultVariant,
          currentImage: costume.image_url_shiny,
          variantType: `costume_${costume.costume_id}_shiny` as VariantKind,
        };
        addVariant(costumeShinyVariant);
      }

      if (costume.shadow_costume && costume.shadow_costume.image_url_shadow_costume) {
        const shadowCostumeVariant: PokemonVariant = {
          ...defaultVariant,
          currentImage: costume.shadow_costume.image_url_shadow_costume,
          variantType: `shadow_costume_${costume.costume_id}` as VariantKind,
        };
        addVariant(shadowCostumeVariant);

        if (costume.shadow_costume.image_url_shiny_shadow_costume) {
          const shinyShadowCostumeVariant: PokemonVariant = {
            ...defaultVariant,
            currentImage:
              costume.shadow_costume.image_url_shiny_shadow_costume,
            variantType:
              `shiny_shadow_costume_${costume.costume_id}` as VariantKind,
          };
          addVariant(shinyShadowCostumeVariant);
        }
      }
    });

    /* ---------- max forms: Dynamax & Gigantamax ---------- */
    pokemon.max?.forEach((maxForm: MaxForm) => {
      if (maxForm.dynamax) {
        const dynamaxVariant: PokemonVariant = {
          ...defaultVariant,
          currentImage: defaultVariant.image_url,
          variantType: 'dynamax',
        };
        addVariant(dynamaxVariant);

        if (pokemon.shiny_available) {
          const shinyDynamaxVariant: PokemonVariant = {
            ...defaultVariant,
            currentImage: defaultVariant.image_url_shiny,
            variantType: 'shiny_dynamax',
          };
          addVariant(shinyDynamaxVariant);
        }
      }

      if (maxForm.gigantamax) {
        const gigantamaxVariant: PokemonVariant = {
          ...defaultVariant,
          currentImage: maxForm.gigantamax_image_url || defaultVariant.image_url,
          variantType: 'gigantamax',
        };
        addVariant(gigantamaxVariant);

        if (pokemon.shiny_available && maxForm.shiny_gigantamax_image_url) {
          const shinyGigantamaxVariant: PokemonVariant = {
            ...defaultVariant,
            currentImage: maxForm.shiny_gigantamax_image_url,
            variantType: 'shiny_gigantamax',
          };
          addVariant(shinyGigantamaxVariant);
        }
      }
    });

    /* ---------- mega / primal variants ---------- */
    pokemon.megaEvolutions?.forEach((mega: MegaEvolution) => {
      if (!isCatalogEntryReleased(mega.date_available)) return;

      const suffix = mega.form ? `_${mega.form.toLowerCase()}` : '';
      const base: PokemonVariant = {
        ...defaultVariant,
        attack: mega.attack ?? defaultVariant.attack,
        defense: mega.defense ?? defaultVariant.defense,
        stamina: mega.stamina ?? defaultVariant.stamina,
        image_url: mega.image_url ?? defaultVariant.image_url,
        image_url_shiny: mega.image_url_shiny ?? defaultVariant.image_url_shiny,
        sprite_url: mega.sprite_url ?? defaultVariant.sprite_url,
        primal: mega.primal ?? defaultVariant.primal,
        form: mega.form ?? defaultVariant.form,
        type_1_id: mega.type_1_id,
        type_2_id: mega.type_2_id ?? defaultVariant.type_2_id,
        type1_name: mega.type1_name,
        type2_name: mega.type2_name ?? '',
        type_1_icon: getTypeIcon(mega.type1_name),
        type_2_icon: getTypeIcon(mega.type2_name),
        currentImage: mega.image_url || defaultVariant.image_url,
        cp40: mega.cp40 ?? defaultVariant.cp40,
        cp50: mega.cp50 ?? defaultVariant.cp50,
        megaForm: mega.form ?? '',
        variantType: (mega.primal ? 'primal' : `mega${suffix}`) as VariantKind,
        variant_id: '',
        species_name: defaultVariant.species_name,
      };
      addVariant(base);

      if (mega.image_url_shiny && pokemon.shiny_available) {
        const shinyMegaVariant: PokemonVariant = {
          ...base,
          currentImage: mega.image_url_shiny,
          variantType: (mega.primal ? 'shiny_primal' : `shiny_mega${suffix}`) as VariantKind,
        };
        addVariant(shinyMegaVariant);
      }
    });

    /* ---------- fusion variants ---------- */
    pokemon.fusion?.forEach((fusion: Fusion) => {
      if (pokemon.pokemon_id !== fusion.base_pokemon_id1) return;
      const base: PokemonVariant = {
        ...defaultVariant,
        attack: fusion.attack ?? defaultVariant.attack,
        defense: fusion.defense ?? defaultVariant.defense,
        stamina: fusion.stamina ?? defaultVariant.stamina,
        type_1_id: fusion.type_1_id,
        type_2_id: fusion.type_2_id ?? defaultVariant.type_2_id,
        type_1_icon: getTypeIcon(fusion.type1_name),
        type_2_icon: getTypeIcon(fusion.type2_name),
        currentImage: fusion.image_url ?? defaultVariant.image_url,
        fusion_id: fusion.fusion_id,
        backgrounds: fusion.backgrounds ?? defaultVariant.backgrounds,
        variantType: `fusion_${fusion.fusion_id}` as VariantKind,
        species_name: fusion.name,
        variant_id: '',
      };
      addVariant(base);

      if (fusion.image_url_shiny) {
        const shinyFusionVariant: PokemonVariant = {
          ...base,
          currentImage: fusion.image_url_shiny,
          variantType: `shiny_fusion_${fusion.fusion_id}` as VariantKind,
          species_name: fusion.name,
        };
        addVariant(shinyFusionVariant);
      }
    });
    return variants;
  };

  return pokemons.flatMap(generateVariants);
};

export default createPokemonVariants;
