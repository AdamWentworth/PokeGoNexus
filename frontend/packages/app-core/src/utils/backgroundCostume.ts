export type BackgroundCostumeReference = {
  costume_id?: number | string | null;
};

export type CostumeReference = {
  costume_id?: number | string | null;
  name: string;
};

export type ResolvedBackgroundCostume<TCostume extends CostumeReference> = {
  costume: TCostume | null;
  costumeId: number | null;
};

export const normalizeCostumeId = (value: unknown): number | null => {
  if (value == null || value === '') return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getVariantCostumeId = (variantType?: string): number | null => {
  const match = /(?:^|_)costume_(\d+)(?:_|$)/i.exec(variantType ?? '');
  return normalizeCostumeId(match?.[1]);
};

export const isFusionVariantType = (variantType?: string): boolean => {
  const normalizedVariantType = (variantType ?? '').toLowerCase();
  return (
    normalizedVariantType.startsWith('fusion_') ||
    normalizedVariantType.startsWith('shiny_fusion_')
  );
};

export const backgroundMatchesCostume = (
  background: BackgroundCostumeReference,
  costumeId: number | string | null | undefined,
): boolean => normalizeCostumeId(background.costume_id) === normalizeCostumeId(costumeId);

export const backgroundMatchesVariant = (
  background: BackgroundCostumeReference,
  variantType?: string,
): boolean =>
  isFusionVariantType(variantType) ||
  backgroundMatchesCostume(background, getVariantCostumeId(variantType));

export const resolveBackgroundCostume = <TCostume extends CostumeReference>(
  background: BackgroundCostumeReference,
  costumes: TCostume[],
): ResolvedBackgroundCostume<TCostume> | null => {
  const costumeId = normalizeCostumeId(background.costume_id);
  if (costumeId === null) {
    return { costume: null, costumeId: null };
  }

  const costume = costumes.find(
    (candidate) => normalizeCostumeId(candidate.costume_id) === costumeId,
  );
  return costume ? { costume, costumeId } : null;
};
