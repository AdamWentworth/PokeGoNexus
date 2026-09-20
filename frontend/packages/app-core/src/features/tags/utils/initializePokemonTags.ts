// src/features/tags/utils/initializePokemonTags.ts
import { determineImageUrl } from '@/utils/imageHelpers';
import { buildTagItem } from '@/features/tags/utils/tagHelpers';
import { getInstanceVariantResolver } from '@pokemongonexus/shared-domain/instance-variant';

import type { Instances } from '@/types/instances';
import type { TagBuckets } from '@/types/tags';
import type { PokemonVariant } from '@/types/pokemonVariants';

export const emptyTagBuckets = {
  caught: {}, wanted: {},
} as const;

function freshBuckets(): TagBuckets {
  return { caught: {}, wanted: {} };
}

export function initializePokemonTags(
  instances: Instances,
  variants: PokemonVariant[],
): TagBuckets {
  const tags = freshBuckets();

  const resolveVariant = getInstanceVariantResolver(variants);

  Object.entries(instances).forEach(([instanceId, inst]) => {
    if (inst.disabled) return;
    const variant = resolveVariant(inst);
    if (!variant) return; // silently ignore; no public "missing" bucket anymore

    let img: string | undefined = variant.currentImage;
    const { gender, is_mega, mega_form, is_fused, fusion_form, purified } = inst;

    if (
      (gender === 'Female' && variant.female_data) ||
      (is_mega && variant.megaEvolutions) ||
      (is_fused && variant.fusion) ||
      purified
    ) {
      img = determineImageUrl(
        gender === 'Female',
        variant,
        is_mega as boolean | undefined,
        (mega_form ?? undefined) as string | undefined,
        (is_fused ?? undefined) as boolean | undefined,
        (fusion_form ?? undefined) as string | undefined,
        !!purified,
      );
    }

    const item = buildTagItem(instanceId, inst, { ...variant, currentImage: img });

    if (inst.is_caught)     tags.caught[instanceId]  = item;
    if (inst.is_wanted)     tags.wanted[instanceId]  = item;
  });

  return tags;
}

export function updatePokemonTags(
  instances: Instances,
  variants: PokemonVariant[],
  cb: (tags: TagBuckets) => void,
): void {
  cb(initializePokemonTags(instances, variants));
}
