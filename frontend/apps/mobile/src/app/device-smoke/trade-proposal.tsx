import { Redirect } from 'expo-router';
import { View } from 'react-native';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeInstanceDetail } from '../../features/collection/collectionModel';
import { NativeTradeProposalSheet } from '../../features/trades/NativeTradeProposalSheet';
import type { NativeTradeProposalSelection } from '../../features/trades/nativeTradeProposalModel';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';

const ASSET_BASE_URL = 'https://pokegonexus.com';

const mine = {
  instance_id: 'smoke-mine-charizard',
  variant_id: '0006-gigantamax',
  pokemon_id: 6,
  is_caught: true,
  is_for_trade: true,
  is_wanted: false,
  registered: false,
  gigantamax: true,
} as PokemonInstance;

const theirs = {
  instance_id: 'smoke-theirs-mewtwo',
  variant_id: '0150-shiny',
  pokemon_id: 150,
  is_caught: true,
  is_for_trade: true,
  is_wanted: false,
  registered: false,
  shiny: true,
} as PokemonInstance;

const detail = ({
  instance,
  name,
  imagePath,
  maxKind = null,
}: {
  instance: PokemonInstance;
  name: string;
  imagePath: string;
  maxKind?: NativeInstanceDetail['row']['maxKind'];
}): NativeInstanceDetail => ({
  instance,
  row: {
    id: instance.instance_id ?? '',
    pokemonId: instance.pokemon_id,
    pokedexNumber: instance.pokemon_id,
    name,
    imageUri: `${ASSET_BASE_URL}${imagePath}`,
    locationBackgroundUri: null,
    maxKind,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'trade',
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  traits: [],
  stats: [],
  ivs: [],
  moves: [],
  provenance: [],
  preferences: [],
  rarity: instance.pokemon_id === 150 ? 'Legendary' : 'Common',
});

const mineDetail = detail({
  instance: mine,
  name: 'Gigantamax Charizard',
  imagePath: '/images/gigantamax/gigantamax_6.png',
  maxKind: 'gigantamax',
});
const theirsDetail = detail({
  instance: theirs,
  name: 'Shiny Mewtwo',
  imagePath: '/images/shiny/shiny_pokemon_150.png',
});
const selection: NativeTradeProposalSelection = {
  kind: 'proposalReady',
  acceptingInstanceId: theirs.instance_id ?? '',
  candidateVariantId: mine.variant_id ?? '',
  friendshipLevel: 5,
  luckyRequested: false,
  partnerPokemon: theirsDetail,
  offeredInstances: [mine],
};

export default function DeviceSmokeTradeProposalRoute() {
  const light = useNativeColorScheme() === 'light';
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: light ? '#f4f7f8' : '#061217' }}>
      <NativeTradeProposalSheet
        assetBaseUrl={ASSET_BASE_URL}
        caughtDetails={[]}
        currentTrainerInstances={{ [mine.instance_id ?? 'mine']: mine }}
        isMarkingForTrade={false}
        onClose={() => undefined}
        onMarkForTrade={async () => undefined}
        onSubmit={async () => ({
          trade: {
            trade_id: 'smoke-committed-trade',
            trade_status: 'proposed',
          },
          affected_instances: {},
        })}
        offeredDetails={[mineDetail]}
        partnerInstances={{ [theirs.instance_id ?? 'theirs']: theirs }}
        partnerUsername="OtherTrainer"
        selection={selection}
      />
    </View>
  );
}
