import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import {
  createNativeCollectionSyncBatch,
  type NativeCollectionSyncUpdate,
} from '../../services/collectionSyncApi';
import { nativeCollectionCache } from '../../storage/nativeCollectionCache';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';

const FIXED_TIME = 1_777_000_000_000;

const retainedUpdate = (owner: string): NativeCollectionSyncUpdate => ({
  instance_id: `lifecycle-${owner}-pikachu`,
  variant_id: '0025-default',
  pokemon_id: 25,
  nickname: 'Offline Pikachu',
  cp: 500,
  level: 20,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 13,
  shiny: false,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: null,
  charged_move1_id: null,
  charged_move2_id: null,
  weight: null,
  height: null,
  gender: null,
  mega: false,
  mega_form: null,
  is_mega: false,
  dynamax: false,
  gigantamax: false,
  crown: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  is_fused: false,
  fusion: null,
  fusion_form: null,
  fused_with: null,
  is_traded: false,
  traded_date: null,
  original_trainer_id: null,
  original_trainer_name: null,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  most_wanted: false,
  caught_tags: [],
  trade_tags: [],
  wanted_tags: [],
  not_trade_list: null,
  not_wanted_list: null,
  trade_filters: null,
  wanted_filters: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: true,
  disabled: false,
  pokeball: null,
  location_card: null,
  location_caught: null,
  date_caught: null,
  date_added: '2026-08-28T00:00:00.000Z',
  last_update: FIXED_TIME,
});

type StoredState = {
  accepted: number;
  cacheSavedAt: number | null;
  error: string | null;
  pending: number;
};

const initialState: StoredState = {
  accepted: 0,
  cacheSavedAt: null,
  error: null,
  pending: 0,
};

const readStoredState = async (owner: string): Promise<StoredState> => {
  const [cache, entries] = await Promise.all([
    nativeCollectionCache.read(owner),
    nativeCollectionOutbox.list(owner),
  ]);
  return {
    cacheSavedAt: cache?.savedAt ?? null,
    pending: entries.filter((entry) => entry.state === 'pending').length,
    accepted: entries.filter((entry) => entry.state === 'acknowledged').length,
    error: entries.find((entry) => entry.lastError)?.lastError ?? null,
  };
};

export default function DeviceSmokePersistenceRoute() {
  const params = useLocalSearchParams<{ owner?: string | string[] }>();
  const ownerParam = Array.isArray(params.owner) ? params.owner[0] : params.owner;
  const owner = ownerParam === 'beta' ? 'beta' : 'alpha';
  const ownerLabel = owner === 'alpha' ? 'Alpha' : 'Beta';
  const light = useNativeColorScheme() === 'light';
  const [stored, setStored] = useState<StoredState>(initialState);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = loadedOwner !== owner;

  const refresh = useCallback(async () => {
    setStored(await readStoredState(owner));
    setLoadedOwner(owner);
  }, [owner]);

  useEffect(() => {
    let active = true;
    void readStoredState(owner).then((next) => {
      if (!active) return;
      setStored(next);
      setLoadedOwner(owner);
    });
    return () => { active = false; };
  }, [owner]);

  const batchId = useMemo(() => `lifecycle-${owner}`, [owner]);

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/native" />;

  const seedOfflineState = async () => {
    setNotice(null);
    await nativeCollectionCache.write(owner, { catalog: [], instances: {} }, FIXED_TIME);
    await nativeCollectionOutbox.queue(owner, createNativeCollectionSyncBatch({
      location: null,
      syncBatchId: batchId,
      updates: [retainedUpdate(owner)],
    }), FIXED_TIME);
    await nativeCollectionOutbox.markAttemptFailed(owner, batchId, 'offline', FIXED_TIME + 1);
    setNotice('Offline mutation retained in SQLite.');
    await refresh();
  };

  const acceptByReceiver = async () => {
    await nativeCollectionOutbox.markAcknowledged(owner, batchId, FIXED_TIME + 2);
    setNotice('Receiver accepted the retained mutation.');
    await refresh();
  };

  const confirmCanonicalSnapshot = async () => {
    const accepted = await nativeCollectionOutbox.list(owner, 'acknowledged');
    await nativeCollectionOutbox.removeAcknowledged(
      owner,
      accepted.map((entry) => entry.batch.sync_batch_id),
    );
    setNotice('Canonical snapshot confirmed the mutation.');
    await refresh();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={[styles.screen, light && styles.screenLight]}>
      <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>RELEASE LIFECYCLE</Text>
      <Text style={[styles.title, light && styles.titleLight]}>Offline storage proof</Text>
      <Text style={[styles.copy, light && styles.copyLight]}>
        This fixture reads the same account-scoped SQLite cache and mutation outbox used by native collection workflows.
      </Text>

      <View style={[styles.card, light && styles.cardLight]}>
        <Text style={[styles.owner, light && styles.titleLight]}>Account {ownerLabel}</Text>
        {loading ? <Text style={[styles.copy, light && styles.copyLight]}>Loading stored state…</Text> : (
          <>
            <Text style={[styles.value, light && styles.titleLight]}>{ownerLabel} cache: {stored.cacheSavedAt === null ? 'empty' : 'retained'}</Text>
            <Text style={[styles.value, light && styles.titleLight]}>{ownerLabel} outbox: {stored.pending} pending · {stored.accepted} accepted</Text>
            {stored.error ? <Text style={styles.error}>Last sync error: {stored.error}</Text> : null}
          </>
        )}
      </View>

      {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, light && styles.noticeLight]}>{notice}</Text> : null}

      <Pressable accessibilityRole="button" onPress={() => void seedOfflineState()} style={[styles.action, light && styles.actionLight]}>
        <Text style={[styles.actionText, light && styles.actionTextLight]}>Seed offline cache and mutation</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void acceptByReceiver()} style={[styles.action, light && styles.actionLight]}>
        <Text style={[styles.actionText, light && styles.actionTextLight]}>Accept by Receiver</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void confirmCanonicalSnapshot()} style={[styles.action, light && styles.actionLight]}>
        <Text style={[styles.actionText, light && styles.actionTextLight]}>Confirm canonical snapshot</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071012' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { flexGrow: 1, gap: 14, paddingHorizontal: 16, paddingTop: 42, paddingBottom: 48 },
  eyebrow: { color: '#45d6aa', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  eyebrowLight: { color: '#126e59' },
  title: { color: '#f7fbfa', fontSize: 28, fontWeight: '900' },
  titleLight: { color: '#13272c' },
  copy: { color: '#9bb0b5', fontSize: 14, lineHeight: 21 },
  copyLight: { color: '#52666b' },
  card: { gap: 8, borderWidth: 1, borderColor: '#355258', borderRadius: 14, padding: 16, backgroundColor: '#142225' },
  cardLight: { borderColor: '#a8b9bd', backgroundColor: '#ffffff' },
  owner: { color: '#f7fbfa', fontSize: 18, fontWeight: '900' },
  value: { color: '#e8f3f1', fontSize: 15, fontWeight: '800' },
  error: { color: '#ffbe8f', fontSize: 13, fontWeight: '800' },
  notice: { color: '#b9f3df', fontSize: 13, fontWeight: '800' },
  noticeLight: { color: '#17664f' },
  action: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3f6268', borderRadius: 12, backgroundColor: '#183034' },
  actionLight: { borderColor: '#9dafb3', backgroundColor: '#ffffff' },
  actionText: { color: '#f2fbf9', fontSize: 14, fontWeight: '900' },
  actionTextLight: { color: '#203237' },
});
