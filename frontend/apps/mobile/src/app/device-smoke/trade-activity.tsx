import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';
import type { NativeInstanceDetail } from '../../features/collection/collectionModel';
import { buildNativeTradeActivityModel } from '../../features/trades/nativeTradeActivityModel';
import type { NativeTradeActivityRow } from '../../features/trades/nativeTradeActivityRows';
import { NativeTradeActivityScreen } from '../../screens/NativeTradeActivityScreen';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { NativeTradeHubHeader } from '../../features/trades/NativeTradeHubHeader';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { StyleSheet, View } from 'react-native';

const ASSET_BASE_URL = 'https://pokegonexus.com';

const imagePaths: Record<string, string> = {
  'mine-incoming': '/images/gigantamax/gigantamax_6.png',
  'theirs-incoming': '/images/shiny/shiny_pokemon_150.png',
  'mine-sent': '/images/shiny/shiny_pokemon_483.png',
  'theirs-sent': '/images/shiny/shiny_pokemon_223.png',
  'mine-active': '/images/shiny/shiny_pokemon_1.png',
  'theirs-active': '/images/shiny/shiny_pokemon_7.png',
  'mine-completed': '/images/shiny/shiny_pokemon_250.png',
  'theirs-completed': '/images/shiny/shiny_pokemon_245.png',
  'mine-closed': '/images/shiny/shiny_pokemon_376.png',
  'theirs-closed': '/images/shiny/shiny_pokemon_248.png',
  'mine-incoming-deny': '/images/shiny/shiny_pokemon_6.png',
  'theirs-incoming-deny': '/images/shiny/shiny_pokemon_9.png',
  'mine-active-completable': '/images/shiny/shiny_pokemon_384.png',
  'theirs-active-completable': '/images/shiny/shiny_pokemon_382.png',
  'mine-completed-delete': '/images/shiny/shiny_pokemon_249.png',
  'theirs-completed-delete': '/images/shiny/shiny_pokemon_243.png',
  'mine-closed-delete': '/images/shiny/shiny_pokemon_448.png',
  'theirs-closed-delete': '/images/shiny/shiny_pokemon_475.png',
  '0025-party_hat_default_demo-trade': '/images/costumes/pokemon_25_party_default.png',
  '0150-default_demo-partner': '/images/default/pokemon_150.png',
};

const names: Record<string, string> = {
  'mine-incoming': 'Gigantamax Charizard',
  'theirs-incoming': 'Shiny Mewtwo',
  'mine-sent': 'Shiny Dialga',
  'theirs-sent': 'Shiny Remoraid',
  'mine-active': 'Shiny Bulbasaur',
  'theirs-active': 'Shiny Squirtle',
  'mine-completed': 'Shiny Ho-Oh',
  'theirs-completed': 'Shiny Suicune',
  'mine-closed': 'Shiny Metagross',
  'theirs-closed': 'Shiny Tyranitar',
  'mine-incoming-deny': 'Shiny Charizard',
  'theirs-incoming-deny': 'Shiny Blastoise',
  'mine-active-completable': 'Shiny Rayquaza',
  'theirs-active-completable': 'Shiny Kyogre',
  'mine-completed-delete': 'Shiny Lugia',
  'theirs-completed-delete': 'Shiny Raikou',
  'mine-closed-delete': 'Shiny Lucario',
  'theirs-closed-delete': 'Shiny Gallade',
  '0025-party_hat_default_demo-trade': 'Party Hat Pikachu',
  '0150-default_demo-partner': 'Mewtwo',
};

const detail = (id: string): NativeInstanceDetail => ({
  instance: {
    instance_id: id,
    variant_id: id,
    pokemon_id: 1,
    is_caught: true,
    is_for_trade: true,
  } as PokemonInstance,
  row: {
    id,
    pokemonId: 1,
    pokedexNumber: 1,
    name: names[id],
    imageUri: `${ASSET_BASE_URL}${imagePaths[id]}`,
    locationBackgroundUri: null,
    maxKind: id === 'mine-incoming' ? 'gigantamax' : null,
    purified: false,
    lucky: false,
    typeIconUris: id === 'mine-incoming'
      ? [`${ASSET_BASE_URL}/images/types/fire.png`, `${ASSET_BASE_URL}/images/types/flying.png`]
      : [],
    status: 'trade',
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  traits: [],
  stats: id === 'mine-incoming'
    ? [
        { label: 'Gender', value: 'Male' },
        { label: 'Weight', value: '114.8 kg' },
        { label: 'Height', value: '1.9 m' },
      ]
    : [],
  ivs: id === 'mine-incoming'
    ? [
        { label: 'Attack', value: 15 },
        { label: 'Defense', value: 14 },
        { label: 'HP', value: 15 },
      ]
    : [],
  moves: id === 'mine-incoming'
    ? [
        { label: 'Fast move', value: 'Fire Spin', typeName: 'Fire', typeIconUri: `${ASSET_BASE_URL}/images/types/fire.png` },
        { label: 'Charged move', value: 'Blast Burn', legacy: true, typeName: 'Fire', typeIconUri: `${ASSET_BASE_URL}/images/types/fire.png` },
      ]
    : [],
  provenance: id === 'mine-incoming'
    ? [
        { label: 'Caught near', value: 'Vancouver, BC' },
        { label: 'Caught on', value: '8/20/2026' },
      ]
    : [],
  preferences: [],
});

const initialTrades: TradeRecord[] = [
  {
    trade_id: 'incoming',
    trade_status: 'proposed',
    username_proposed: 'OtherTrainer',
    username_accepting: 'AdamZilla',
    pokemon_instance_id_user_proposed: 'theirs-incoming',
    pokemon_instance_id_user_accepting: 'mine-incoming',
    trade_friendship_level: 'Forever',
    trade_dust_cost: 40_000,
    is_lucky_trade: false,
    trade_proposal_date: '2026-08-24T10:00:00.000Z',
  },
  {
    trade_id: 'sent',
    trade_status: 'proposed',
    username_proposed: 'AdamZilla',
    username_accepting: 'OtherTrainer',
    pokemon_instance_id_user_proposed: 'mine-sent',
    pokemon_instance_id_user_accepting: 'theirs-sent',
    trade_friendship_level: 'Best',
    trade_dust_cost: 800,
    is_lucky_trade: true,
    trade_proposal_date: '2026-08-23T10:00:00.000Z',
  },
  {
    trade_id: 'incoming-deny',
    trade_status: 'proposed',
    username_proposed: 'CeruleanLeader',
    username_accepting: 'AdamZilla',
    pokemon_instance_id_user_proposed: 'theirs-incoming-deny',
    pokemon_instance_id_user_accepting: 'mine-incoming-deny',
    trade_friendship_level: 'Great',
    trade_dust_cost: 16_000,
    is_lucky_trade: false,
    trade_proposal_date: '2026-08-23T09:00:00.000Z',
  },
  {
    trade_id: 'active',
    trade_status: 'pending',
    username_proposed: 'AdamZilla',
    username_accepting: 'OtherTrainer',
    pokemon_instance_id_user_proposed: 'mine-active',
    pokemon_instance_id_user_accepting: 'theirs-active',
    trade_friendship_level: 'Forever',
    trade_dust_cost: 20_000,
    is_lucky_trade: true,
    trade_proposal_date: '2026-08-22T10:00:00.000Z',
    trade_accepted_date: '2026-08-22T12:00:00.000Z',
  },
  {
    trade_id: 'completed',
    trade_status: 'completed',
    username_proposed: 'OtherTrainer',
    username_accepting: 'AdamZilla',
    pokemon_instance_id_user_proposed: 'theirs-completed',
    pokemon_instance_id_user_accepting: 'mine-completed',
    trade_friendship_level: 'Ultra',
    trade_dust_cost: 1_600,
    is_lucky_trade: false,
    trade_completed_date: '2026-08-21T10:00:00.000Z',
  },
  {
    trade_id: 'active-completable',
    trade_status: 'pending',
    username_proposed: 'AdamZilla',
    username_accepting: 'PalletRival',
    pokemon_instance_id_user_proposed: 'mine-active-completable',
    pokemon_instance_id_user_accepting: 'theirs-active-completable',
    trade_friendship_level: 'Best',
    trade_dust_cost: 800,
    is_lucky_trade: false,
    user_accepting_completion_confirmed: true,
    trade_proposal_date: '2026-08-21T09:00:00.000Z',
    trade_accepted_date: '2026-08-21T09:30:00.000Z',
  },
  {
    trade_id: 'completed-delete',
    trade_status: 'completed',
    username_proposed: 'AdamZilla',
    username_accepting: 'JohtoTrainer',
    pokemon_instance_id_user_proposed: 'mine-completed-delete',
    pokemon_instance_id_user_accepting: 'theirs-completed-delete',
    trade_friendship_level: 'Ultra',
    trade_dust_cost: 1_600,
    is_lucky_trade: false,
    user_1_trade_satisfaction: true,
    trade_completed_date: '2026-08-20T12:00:00.000Z',
  },
  {
    trade_id: 'closed',
    trade_status: 'cancelled',
    username_proposed: 'AdamZilla',
    username_accepting: 'OtherTrainer',
    pokemon_instance_id_user_proposed: 'mine-closed',
    pokemon_instance_id_user_accepting: 'theirs-closed',
    trade_friendship_level: 'Good',
    trade_dust_cost: 1_000_000,
    is_lucky_trade: false,
    trade_cancelled_date: '2026-08-20T10:00:00.000Z',
  },
  {
    trade_id: 'closed-delete',
    trade_status: 'denied',
    username_proposed: 'AdamZilla',
    username_accepting: 'SinnohTrainer',
    pokemon_instance_id_user_proposed: 'mine-closed-delete',
    pokemon_instance_id_user_accepting: 'theirs-closed-delete',
    trade_friendship_level: 'Good',
    trade_dust_cost: 20_000,
    is_lucky_trade: false,
    trade_proposal_date: '2026-08-19T10:00:00.000Z',
    trade_cancelled_date: '2026-08-19T11:00:00.000Z',
  },
];

const canonicalTrades: TradeRecord[] = [{
  trade_id: 'trade-demo-pending',
  trade_status: 'pending',
  username_proposed: 'HarbourMew',
  username_accepting: 'NexusDemo',
  pokemon_instance_id_user_proposed: '0150-default_demo-partner',
  pokemon_instance_id_user_accepting: '0025-party_hat_default_demo-trade',
  user_proposed_completion_confirmed: false,
  user_accepting_completion_confirmed: false,
  trade_accepted_date: '2026-06-29T18:00:00.000Z',
  trade_completed_date: null,
  trade_cancelled_date: null,
  trade_cancelled_by: null,
  trade_deleted_date: null,
  trade_proposal_date: '2026-06-28T18:00:00.000Z',
  trade_friendship_level: 'Best',
  trade_dust_cost: 800,
  is_lucky_trade: true,
  user_1_trade_satisfaction: false,
  user_2_trade_satisfaction: false,
  last_update: Date.parse('2026-07-03T12:00:00.000Z'),
}];

export default function DeviceSmokeTradeActivityRoute() {
  const params = useLocalSearchParams<{ canonical?: string | string[] }>();
  const canonical = (Array.isArray(params.canonical) ? params.canonical[0] : params.canonical) === '1';
  const light = useNativeColorScheme() === 'light';
  const [trades, setTrades] = useState(() => canonical ? canonicalTrades : initialTrades);
  const rows = useMemo(() => trades.flatMap<NativeTradeActivityRow>((trade) => {
    const model = buildNativeTradeActivityModel(trade, canonical ? 'NexusDemo' : 'AdamZilla');
    if (!model) return [];
    return [{
      model,
      currentUserPokemon: detail(model.currentUserInstanceId),
      partnerPokemon: detail(model.partnerInstanceId),
    }];
  }), [canonical, trades]);

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  return (
    <View style={[styles.screen, light && styles.screenLight]}>
      <NativeTradeActivityScreen
        assetBaseUrl={ASSET_BASE_URL}
        error={null}
        isLoading={false}
        onAction={async (model, action) => {
          setTrades((current) => current.flatMap((trade) => {
            if (trade.trade_id !== model.tradeId) return [trade];
            if (action === 'cancel') return [{ ...trade, trade_status: 'cancelled' }];
            if (action === 'accept') return [{ ...trade, trade_status: 'pending' }];
            if (action === 'deny') return [{ ...trade, trade_status: 'denied' }];
            if (action === 'repropose') return [{ ...trade, trade_status: 'proposed' }];
            if (action === 'complete') {
              const proposerConfirmed = model.participantRole === 'proposer'
                ? true
                : trade.user_proposed_completion_confirmed;
              const accepterConfirmed = model.participantRole === 'accepter'
                ? true
                : trade.user_accepting_completion_confirmed;
              return [{
                ...trade,
                trade_status: proposerConfirmed && accepterConfirmed ? 'completed' : trade.trade_status,
                trade_completed_date: proposerConfirmed && accepterConfirmed
                  ? '2026-08-25T12:00:00.000Z'
                  : trade.trade_completed_date,
                user_proposed_completion_confirmed: proposerConfirmed,
                user_accepting_completion_confirmed: accepterConfirmed,
              }];
            }
            if (action === 'satisfy') return [{
              ...trade,
              user_1_trade_satisfaction: model.participantRole === 'proposer'
                ? true
                : trade.user_1_trade_satisfaction,
              user_2_trade_satisfaction: model.participantRole === 'accepter'
                ? true
                : trade.user_2_trade_satisfaction,
            }];
            return [trade];
          }));
        }}
        onOpenPreferences={() => undefined}
        onRetry={() => undefined}
        onRevealPartner={async () => ({
          sharingEnabled: true,
          trainerCode: '1234 5678 9012',
          pokemonGoName: 'OtherPogoName',
          coordinationMethod: 'campfire',
          coordinationHandle: 'OtherTrainer',
          location: 'Burnaby, British Columbia, Canada',
        })}
        pageHeader={(
          <NativeTradeHubHeader
            activeView="activity"
            assetBaseUrl={ASSET_BASE_URL}
            onOpenTradeBoard={() => undefined}
            onViewChange={() => undefined}
          />
        )}
        rows={rows}
        showModeTabs={false}
      />
      <NativeRouteActionMenu currentPath="/trades" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#071012' },
  screenLight: { backgroundColor: '#f8fff9' },
});
