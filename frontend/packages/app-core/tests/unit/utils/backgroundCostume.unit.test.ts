import { describe, expect, it } from 'vitest';

import {
  backgroundMatchesCostume,
  backgroundMatchesVariant,
  getVariantCostumeId,
  normalizeCostumeId,
  resolveBackgroundCostume,
} from '@/utils/backgroundCostume';

describe('backgroundCostume', () => {
  it('normalizes only positive integer costume identifiers', () => {
    expect(normalizeCostumeId(null)).toBeNull();
    expect(normalizeCostumeId(undefined)).toBeNull();
    expect(normalizeCostumeId('')).toBeNull();
    expect(normalizeCostumeId(0)).toBeNull();
    expect(normalizeCostumeId('7')).toBe(7);
    expect(normalizeCostumeId(7)).toBe(7);
    expect(normalizeCostumeId(7.5)).toBeNull();
  });

  it('extracts costume identifiers from every supported variant prefix', () => {
    expect(getVariantCostumeId('costume_7')).toBe(7);
    expect(getVariantCostumeId('shiny_costume_7')).toBe(7);
    expect(getVariantCostumeId('shadow_costume_7')).toBe(7);
    expect(getVariantCostumeId('shiny_shadow_costume_7')).toBe(7);
    expect(getVariantCostumeId('default')).toBeNull();
  });

  it('matches backgrounds to the exact costume or exact lack of costume', () => {
    expect(backgroundMatchesCostume({ costume_id: null }, null)).toBe(true);
    expect(backgroundMatchesCostume({ costume_id: null }, 7)).toBe(false);
    expect(backgroundMatchesCostume({ costume_id: 7 }, null)).toBe(false);
    expect(backgroundMatchesCostume({ costume_id: 7 }, 7)).toBe(true);
    expect(backgroundMatchesCostume({ costume_id: 7 }, 8)).toBe(false);
  });

  it('uses exact costume matching for normal variants and preserves fusion pools', () => {
    expect(backgroundMatchesVariant({ costume_id: null }, 'default')).toBe(true);
    expect(backgroundMatchesVariant({ costume_id: 7 }, 'default')).toBe(false);
    expect(backgroundMatchesVariant({ costume_id: null }, 'costume_7')).toBe(false);
    expect(backgroundMatchesVariant({ costume_id: 7 }, 'shiny_shadow_costume_7')).toBe(true);
    expect(backgroundMatchesVariant({ costume_id: 7 }, 'fusion_dawn_wings')).toBe(true);
    expect(backgroundMatchesVariant({ costume_id: null }, 'shiny_fusion_dusk_mane')).toBe(true);
  });

  it('resolves a background to no costume or its one catalog costume', () => {
    const costumes = [
      { name: 'Party', costume_id: 7 },
      { name: 'Holiday', costume_id: 8 },
    ];

    expect(resolveBackgroundCostume({ costume_id: null }, costumes)).toEqual({
      costume: null,
      costumeId: null,
    });
    expect(resolveBackgroundCostume({ costume_id: 7 }, costumes)).toEqual({
      costume: costumes[0],
      costumeId: 7,
    });
    expect(resolveBackgroundCostume({ costume_id: 9 }, costumes)).toBeNull();
  });
});
