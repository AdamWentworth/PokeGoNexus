export type UserInstancesEnvelope<TInstances = Record<string, unknown>> = {
  username?: string;
  user?: {
    username?: string;
  };
  instances?: TInstances;
};

export interface InstanceSyncEnvelope<TInstance = Record<string, unknown>> {
  checkpoint: string;
  not_modified: boolean;
  instances?: Record<string, TInstance>;
}

export interface CollectionSummary {
  collection_total: number;
  caught: number;
  for_trade: number;
  wanted: number;
  favorite: number;
  most_wanted: number;
}

export interface UserOverviewUser {
  user_id: string;
  username: string;
  [key: string]: unknown;
}

export interface UserOverview<
  TPokemonInstance = Record<string, unknown>,
  TTrade = Record<string, unknown>,
  TRelatedInstance = TPokemonInstance,
  TRegistration = boolean,
> {
  user: UserOverviewUser;
  pokemon_instances: Record<string, TPokemonInstance>;
  trades: Record<string, TTrade>;
  related_instances: Record<string, TRelatedInstance>;
  registrations: Record<string, TRegistration>;
}

export type TrainerAutocompleteEntry = {
  username: string;
  pokemonGoName?: string | null;
  team?: string | null;
  trainer_level?: number | null;
};

export type ProfileVisibility = 'public' | 'friends' | 'private';
export type FriendRequestPermission = 'everyone' | 'nobody';
export type TrainerCodeVisibility = 'public' | 'friends' | 'private';
export type TradeCoordinationMethod = 'campfire' | 'discord' | 'other' | 'none';
export type TrainerRelationship =
  | 'none'
  | 'self'
  | 'friend'
  | 'incoming'
  | 'outgoing'
  | 'blocked';

export const TRAINER_TITLE_OPTIONS = [
  {
    id: 'raid-regular',
    label: 'Raid Regular',
    description: 'Legendary and Mega raids',
  },
  {
    id: 'shadow-raider',
    label: 'Shadow Raider',
    description: 'Shadow Raids and Rocket battles',
  },
  {
    id: 'super-mega-raider',
    label: 'Super Mega Raider',
    description: 'Coordinated Super Mega raids',
  },
  {
    id: 'max-battler',
    label: 'Max Battler',
    description: 'Dynamax and Gigantamax battles',
  },
  {
    id: 'battle-league-trainer',
    label: 'Battle League Trainer',
    description: 'Great, Ultra, and Master League',
  },
  {
    id: 'rocket-hunter',
    label: 'Rocket Hunter',
    description: 'Grunts, Leaders, and Giovanni',
  },
  {
    id: 'shiny-hunter',
    label: 'Shiny Hunter',
    description: 'Hunting shiny Pokemon',
  },
  {
    id: 'pokedex-collector',
    label: 'Pokedex Collector',
    description: 'Completing every registration',
  },
  {
    id: 'costume-collector',
    label: 'Costume Collector',
    description: 'Collecting event costumes',
  },
  {
    id: 'hundo-hunter',
    label: 'Hundo Hunter',
    description: 'Perfect-IV Pokemon',
  },
  {
    id: 'size-collector',
    label: 'Size Collector',
    description: 'XXS, XXL, and showcase catches',
  },
  {
    id: 'lucky-trader',
    label: 'Lucky Trader',
    description: 'Trading and Lucky Pokemon',
  },
  {
    id: 'egg-hatcher',
    label: 'Egg Hatcher',
    description: 'Walking and hatching Eggs',
  },
  {
    id: 'route-explorer',
    label: 'Route Explorer',
    description: 'Routes and exploration',
  },
  {
    id: 'showcase-star',
    label: 'Showcase Star',
    description: 'PokeStop Showcases',
  },
  {
    id: 'party-player',
    label: 'Party Player',
    description: 'Local group play',
  },
] as const;

export type TrainerTitle =
  (typeof TRAINER_TITLE_OPTIONS)[number]['id'];

/**
 * Canonical play-style artwork shared by the Vite and native trainer cards.
 *
 * Keeping the asset contract beside the title IDs prevents either frontend
 * from silently substituting a generic badge or drifting to different art.
 */
export const TRAINER_TITLE_VISUALS = {
  'raid-regular': { masks: ['/images/raid_face.png'] },
  'shadow-raider': { masks: ['/images/shadow_search.png'] },
  'super-mega-raider': { masks: ['/images/pokemon_details_cp_mega.png'] },
  'max-battler': { masks: ['/images/gigantamax_title_mask.png'] },
  'battle-league-trainer': { masks: ['/images/pvp_title_mask.png'] },
  'rocket-hunter': { masks: ['/images/teamrocket_r_full.png'] },
  'shiny-hunter': { masks: ['/images/shiny_search.png'] },
  'pokedex-collector': { masks: ['/images/kanto_search.png'] },
  'costume-collector': { masks: ['/images/costume_search.png'] },
  'hundo-hunter': { masks: ['/images/appraisal_04.png'] },
  'size-collector': { icon: 'ruler' },
  'lucky-trader': { masks: ['/images/lucky-icon.png'] },
  'egg-hatcher': { masks: ['/images/ic_egg_inv.png'] },
  'route-explorer': { masks: ['/images/route_icon.png'] },
  'showcase-star': { icon: 'medal' },
  'party-player': { icon: 'users' },
} as const satisfies Record<
  TrainerTitle,
  { readonly masks: readonly string[] } | { readonly icon: 'ruler' | 'medal' | 'users' }
>;

export interface TrainerPreferences {
  user_id: string;
  bio?: string | null;
  profile_visibility: ProfileVisibility;
  collection_visibility: ProfileVisibility;
  friend_request_permission: FriendRequestPermission;
  trainer_code_visibility: TrainerCodeVisibility;
  coordination_method: TradeCoordinationMethod;
  coordination_handle?: string | null;
  share_trade_contact: boolean;
  show_location: boolean;
  show_pokemon_go_name: boolean;
  updated_at?: string;
}

export interface TrainerProfileUser {
  user_id: string;
  username: string;
  pokemonGoName?: string | null;
  team?: string | null;
  trainer_level?: number | null;
  total_xp?: number | null;
  pogo_started_on?: string | null;
  app_joined_at: string;
}

export interface TrainerProfileStats {
  caught: number;
  for_trade: number;
  wanted: number;
  favorites: number;
  registered: number;
}

export interface TrainerProfile<TInstance = Record<string, unknown>> {
  user: TrainerProfileUser;
  trainer_titles: TrainerTitle[];
  location?: string | null;
  trainer_code?: string | null;
  stats: TrainerProfileStats;
  highlights: TInstance[];
  preferences?: TrainerPreferences;
  viewer: {
    relationship: TrainerRelationship;
    friendship_id?: string | null;
    can_view_profile: boolean;
    can_view_collection: boolean;
  };
}

export interface FriendSummary {
  user_id: string;
  username: string;
  pokemonGoName?: string | null;
  team?: string | null;
  trainer_level?: number | null;
  friendship_id: string;
  direction?: 'accepted' | 'incoming' | 'outgoing' | 'blocked';
}

export interface FriendsOverview {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
  blocked: FriendSummary[];
}

export interface UpdateTrainerProfileRequest {
  pokemonGoName?: string;
  trainer_code?: string;
  team?: string;
  trainer_level?: number;
  total_xp?: number;
  pogo_started_on?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  trainer_titles?: TrainerTitle[];
  highlight_instance_ids?: string[];
}

export type UpdateTrainerPreferencesRequest = Omit<
  TrainerPreferences,
  'user_id' | 'bio' | 'updated_at'
>;

export type ForeignInstancesFetchOutcome<
  TInstances = Record<string, unknown>,
> =
  | {
      type: 'success';
      username: string;
      instances: TInstances;
      etag: string | null;
    }
  | { type: 'notModified' }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'error'; status: number; statusText: string };

export type TrainerAutocompleteOutcome =
  | { type: 'success'; results: TrainerAutocompleteEntry[] }
  | { type: 'error'; message: string; status?: number };

export interface SecondaryUserUpdateRequest {
  username: string;
  latitude?: number;
  longitude?: number;
  pokemonGoName?: string;
}

export type CustomTagParent = 'caught' | 'wanted';
export type PokemonTagOrderKey = `system:${string}` | `custom:${string}`;

export interface PokemonTagOrders {
  caught: PokemonTagOrderKey[];
  wanted: PokemonTagOrderKey[];
}

export interface CustomTagDefinition {
  tag_id: string;
  parent: CustomTagParent;
  name: string;
  color: string;
  sort: number;
  created_at: string;
  updated_at?: string | null;
}

export interface CustomTagsEnvelope {
  tags: CustomTagDefinition[];
  orders: PokemonTagOrders;
}

export interface CreateCustomTagRequest {
  parent: CustomTagParent;
  name: string;
  color: string;
}

export interface UpdateCustomTagRequest {
  name?: string;
  color?: string;
}

export interface UpdatePokemonTagOrderRequest {
  parent: CustomTagParent;
  tag_keys: PokemonTagOrderKey[];
}

export interface PokemonTagOrderEnvelope {
  parent: CustomTagParent;
  tag_keys: PokemonTagOrderKey[];
}

export interface DeleteCustomTagResponse {
  tag_id: string;
  affected_instance_ids: string[];
}

export type ErrorEnvelope = {
  message?: string;
};

const toLower = (value: string) => value.toLowerCase();

export const usersContract = {
  endpoints: {
    instancesByUsername: (username: string) =>
      `/instances/by-username/${encodeURIComponent(toLower(username))}`,
    publicUserByUsername: (username: string) =>
      `/public/users/${encodeURIComponent(toLower(username))}`,
    profileByUsername: (username: string) =>
      `/profiles/${encodeURIComponent(toLower(username))}`,
    autocompleteTrainers: (query: string) =>
      `/autocomplete-trainers?q=${encodeURIComponent(query)}`,
    updateUser: (userId: string) =>
      `/update-user/${encodeURIComponent(userId)}`,
    deleteUser: (userId: string) =>
      `/${encodeURIComponent(userId)}`,
    userOverview: (userId: string) =>
      `/users/${encodeURIComponent(userId)}/overview`,
    instanceSync: '/instances/sync',
    collectionSummary: '/collection/summary',
    profile: '/profile',
    preferences: '/preferences',
    friends: '/friends',
    friendRequests: '/friends/requests',
    acceptFriendRequest: (friendshipId: string) =>
      `/friends/requests/${encodeURIComponent(friendshipId)}/accept`,
    friendRequest: (friendshipId: string) =>
      `/friends/requests/${encodeURIComponent(friendshipId)}`,
    friend: (userId: string) =>
      `/friends/${encodeURIComponent(userId)}`,
    friendBlocks: '/friends/blocks',
    friendBlock: (userId: string) =>
      `/friends/blocks/${encodeURIComponent(userId)}`,
    tags: '/tags',
    tagOrder: '/tags/order',
    tag: (tagId: string) => `/tags/${encodeURIComponent(tagId)}`,
  },
} as const;
