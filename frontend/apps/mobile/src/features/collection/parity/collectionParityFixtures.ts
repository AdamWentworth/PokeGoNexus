export type CollectionParityTheme = 'dark' | 'light';

export type CollectionParityCardFixture = {
  id: string;
  cp: number | null;
  dexNumber: number;
  name: string;
  imagePath: string;
  interaction?: 'select' | 'view';
  typeIconPaths: string[];
  favorite?: boolean;
  mostWanted?: boolean;
  lucky?: boolean;
  locationBackgroundPath?: string;
  maxKind?: 'dynamax' | 'gigantamax';
  ownership?: 'caught' | 'trade' | 'wanted';
  purified?: boolean;
};

export const COLLECTION_PARITY_FIXTURES: CollectionParityCardFixture[] = [
  {
    id: 'shiny-shadow-venusaur',
    cp: 2510,
    dexNumber: 3,
    name: 'Shiny Shadow Venusaur',
    imagePath: '/images/shiny_shadow/shiny_shadow_pokemon_3.png',
    typeIconPaths: ['/images/types/grass.png', '/images/types/poison.png'],
    favorite: true,
  },
  {
    id: 'shiny-gigantamax-venusaur',
    cp: 2700,
    dexNumber: 3,
    name: 'Shiny Gigantamax Venusaur',
    imagePath: '/images/shiny_gigantamax/shiny_gigantamax_3.png',
    typeIconPaths: ['/images/types/grass.png', '/images/types/poison.png'],
    favorite: true,
    maxKind: 'gigantamax',
    lucky: true,
  },
  {
    id: 'shiny-venusaur-location',
    cp: 2499,
    dexNumber: 3,
    name: 'Shiny Venusaur',
    imagePath: '/images/shiny/shiny_pokemon_3.png',
    typeIconPaths: ['/images/types/grass.png', '/images/types/poison.png'],
    locationBackgroundPath: '/images/backgrounds/Location_Card_London.png',
    favorite: true,
  },
  {
    id: 'shiny-charizard',
    cp: 2889,
    dexNumber: 6,
    name: 'Shiny Charizard',
    imagePath: '/images/shiny/shiny_pokemon_6.png',
    typeIconPaths: ['/images/types/fire.png', '/images/types/flying.png'],
    favorite: true,
  },
  {
    id: 'shiny-shadow-charizard',
    cp: 2844,
    dexNumber: 6,
    name: 'Shiny Shadow Charizard',
    imagePath: '/images/shiny_shadow/shiny_shadow_pokemon_6.png',
    typeIconPaths: ['/images/types/fire.png', '/images/types/flying.png'],
    favorite: true,
  },
  {
    id: 'shiny-gigantamax-charizard',
    cp: 2626,
    dexNumber: 6,
    name: 'Shiny Gigantamax Charizard',
    imagePath: '/images/shiny_gigantamax/shiny_gigantamax_6.png',
    typeIconPaths: ['/images/types/fire.png', '/images/types/flying.png'],
    favorite: true,
    maxKind: 'gigantamax',
  },
  {
    id: 'shiny-mewtwo',
    cp: 3978,
    dexNumber: 150,
    name: 'Shiny Mewtwo',
    imagePath: '/images/shiny/shiny_pokemon_150.png',
    typeIconPaths: ['/images/types/psychic.png'],
    favorite: true,
  },
  {
    id: 'shiny-suicune',
    cp: 3324,
    dexNumber: 245,
    name: 'Shiny Suicune',
    imagePath: '/images/shiny/shiny_pokemon_245.png',
    typeIconPaths: ['/images/types/water.png'],
    favorite: true,
  },
  {
    id: 'shiny-metagross',
    cp: 3653,
    dexNumber: 376,
    name: 'Shiny Metagross',
    imagePath: '/images/shiny/shiny_pokemon_376.png',
    typeIconPaths: ['/images/types/steel.png', '/images/types/psychic.png'],
    favorite: true,
  },
];
