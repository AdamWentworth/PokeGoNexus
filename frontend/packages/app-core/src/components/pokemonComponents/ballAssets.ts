import { resolveAssetUrl } from '@/utils/assetUrl';
import { getBallImageFileName } from '@pokemongonexus/shared-domain/pokemon-balls';
export { BALL_OPTIONS, getBallLabel, type BallValue } from '@pokemongonexus/shared-domain/pokemon-balls';

export const getBallImageUrl = (value: string | null): string => {
  const fileName = getBallImageFileName(value ?? 'poke_ball');
  return resolveAssetUrl(`/media/images/balls/${fileName}`);
};

export const getBallImageClassName = (value: string | null): string => {
  const fileName = getBallImageFileName(value ?? 'poke_ball');
  return `meta-ball-${fileName.replace('.png', '')}`;
};
