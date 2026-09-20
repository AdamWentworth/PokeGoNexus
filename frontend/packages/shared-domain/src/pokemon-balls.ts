export const BALL_OPTIONS = [
  { value: 'poke_ball', label: 'POKE BALL' },
  { value: 'great_ball', label: 'GREAT BALL' },
  { value: 'ultra_ball', label: 'ULTRA BALL' },
  { value: 'premier_ball', label: 'PREMIER BALL' },
  { value: 'master_ball', label: 'MASTER BALL' },
  { value: 'safari_ball', label: 'SAFARI BALL' },
  { value: 'beast_ball', label: 'BEAST BALL' },
] as const;

export type BallValue = (typeof BALL_OPTIONS)[number]['value'];

const BALL_FILE_BY_ALIAS: Record<string, string> = {
  poke_ball: 'pokeball.png',
  pokeball: 'pokeball.png',
  poke: 'pokeball.png',
  great_ball: 'greatball.png',
  greatball: 'greatball.png',
  great: 'greatball.png',
  ultra_ball: 'ultraball.png',
  ultraball: 'ultraball.png',
  ultra: 'ultraball.png',
  premier_ball: 'premierball.png',
  premierball: 'premierball.png',
  premier: 'premierball.png',
  master_ball: 'masterball.png',
  masterball: 'masterball.png',
  master: 'masterball.png',
  safari_ball: 'safariball.png',
  safariball: 'safariball.png',
  safari: 'safariball.png',
  beast_ball: 'beastball.png',
  beastball: 'beastball.png',
  beast: 'beastball.png',
};

const normalizeBallAlias = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const getBallImageFileName = (value: string): string => {
  const canonical = BALL_FILE_BY_ALIAS[value];
  if (canonical) return canonical;

  const normalized = normalizeBallAlias(value);
  return BALL_FILE_BY_ALIAS[normalized] ?? `${normalized || 'poke'}ball.png`;
};

export const getBallLabel = (value: string | null): string => {
  if (!value) return 'UNKNOWN';
  const found = BALL_OPTIONS.find((option) => option.value === value);
  if (found) return found.label;
  return value.replace(/_/g, ' ').toUpperCase();
};

