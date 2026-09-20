import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import type { NativeCollectionRow } from '../../features/collection/collectionModel';
import type { NativeTrainerProfileModel } from '../../features/social/nativeTrainerProfileModel';
import type { NativeTrainerProfileDraft } from '../../features/social/nativeTrainerProfileEditorModel';
import { NativeTrainerProfileScreen } from '../../screens/NativeTrainerProfileScreen';

const ASSET_BASE_URL = 'https://pokegonexus.com';
const PERFORMANCE_HIGHLIGHT_CANDIDATE_COUNT = 180;

const highlight = (
  id: string,
  pokemonId: number,
  name: string,
  image: string,
  maxKind: NativeCollectionRow['maxKind'] = null,
  cp = 3000,
): NativeCollectionRow => ({
  id,
  pokemonId,
  pokedexNumber: pokemonId,
  name,
  imageUri: `${ASSET_BASE_URL}${image}`,
  locationBackgroundUri: null,
  maxKind,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  source: 'instance',
  cp,
  favorite: true,
  mostWanted: false,
});

const MODEL: NativeTrainerProfileModel = {
  userId: 'user-1',
  username: 'NexusDemo',
  pokemonGoName: 'NexusDemo',
  avatarLabel: 'N',
  team: 'mystic',
  teamLabel: 'Mystic',
  trainerLevel: 50,
  totalXpLabel: 'XP not shared',
  memberSinceLabel: 'Dec 31, 2025',
  startedLabel: 'Not shared',
  locationLabel: 'Vancouver, British Columbia, Canada',
  trainerCodeLabel: '1234 5678 9012',
  titles: [
    { id: 'lucky-trader', label: 'Lucky Trader', description: 'Trading and Lucky Pokémon' },
    { id: 'pokedex-collector', label: 'Kanto Collector', description: 'Collecting Kanto Pokémon' },
  ],
  highlights: [],
  stats: [
    { key: 'registered', label: 'Registered', value: 846 },
    { key: 'caught', label: 'Caught', value: 2255 },
    { key: 'trade', label: 'For trade', value: 208 },
    { key: 'wanted', label: 'Wanted', value: 168 },
    { key: 'favorites', label: 'Favorites', value: 77 },
  ],
  relationship: 'self',
  friendshipId: null,
  canViewCollection: true,
};

const HIGHLIGHTS = [
  highlight('0006-default_demo-charizard', 6, 'League Ace', '/images/default/pokemon_6.png', null, 2844),
  highlight('0094-default_demo-gengar', 94, 'Night shift', '/images/default/pokemon_94.png', null, 2567),
  highlight('0150-default_demo-mewtwo', 150, 'Mewtwo', '/images/default/pokemon_150.png', null, 4188),
];

const CORE_HIGHLIGHT_CANDIDATES = [
  ...HIGHLIGHTS,
  highlight('0149-default_demo-dragonite', 149, 'Dragonite', '/images/default/pokemon_149.png', null, 3472),
  highlight('0003-default_demo-venusaur', 3, 'Garden lead', '/images/default/pokemon_3.png', null, 2411),
  highlight('suicune', 245, 'Shiny Suicune', '/images/shiny/shiny_pokemon_245.png'),
  highlight('metagross', 376, 'Shiny Metagross', '/images/shiny/shiny_pokemon_376.png'),
];

const HIGHLIGHT_CANDIDATES = [
  ...CORE_HIGHLIGHT_CANDIDATES,
  ...Array.from({ length: PERFORMANCE_HIGHLIGHT_CANDIDATE_COUNT - CORE_HIGHLIGHT_CANDIDATES.length }, (_, index) => {
    const pokemonId = (index % 1025) + 1;
    return highlight(
      `performance-candidate-${index + 1}`,
      pokemonId,
      `Performance candidate ${index + 1}`,
      `/images/default/pokemon_${pokemonId}.png`,
      null,
      1500 + index,
    );
  }),
];

const EDITOR_DRAFT: NativeTrainerProfileDraft = {
  trainerTitles: ['lucky-trader', 'pokedex-collector'],
  pokemonGoName: 'NexusDemo',
  trainerCode: '123456789012',
  team: 'Mystic',
  trainerLevel: '50',
  totalXp: '',
  startedOn: '',
  location: 'Vancouver, British Columbia, Canada',
  highlightInstanceIds: HIGHLIGHTS.map(({ id }) => id),
};

export default function DeviceSmokeProfileRoute() {
  const [draft, setDraft] = useState<NativeTrainerProfileDraft | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success'; text: string } | null>(null);
  const [model, setModel] = useState(MODEL);
  const [highlights, setHighlights] = useState(HIGHLIGHTS);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <NativeTrainerProfileScreen
        assetBaseUrl={ASSET_BASE_URL}
        editorDraft={draft}
        feedback={feedback}
        highlights={highlights}
        highlightCandidates={HIGHLIGHT_CANDIDATES}
        isOwner
        model={model}
        onBack={() => undefined}
        onBeginEdit={() => setDraft({ ...EDITOR_DRAFT })}
        onCancelEdit={() => setDraft(null)}
        onChangeEditorDraft={setDraft}
        onDismissFeedback={() => setFeedback(null)}
        onOpenCollection={() => undefined}
        onOpenFriends={() => undefined}
        onSaveProfile={() => {
          if (!draft) return;
          setModel((current) => ({
            ...current,
            pokemonGoName: draft.pokemonGoName || current.pokemonGoName,
            locationLabel: draft.location || current.locationLabel,
          }));
          const byId = new Map(HIGHLIGHT_CANDIDATES.map((row) => [row.id, row]));
          setHighlights(draft.highlightInstanceIds.flatMap((id) => {
            const row = byId.get(id);
            return row ? [row] : [];
          }));
          setDraft(null);
          setFeedback({ tone: 'success', text: 'Profile updated.' });
        }}
      />
      <NativeRouteActionMenu currentPath="/profile" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
