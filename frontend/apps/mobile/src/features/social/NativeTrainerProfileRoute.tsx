import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import { runtimeConfig } from '../../config/runtimeConfig';
import { buildNativeCollectionRows } from '../collection/collectionModel';
import { useNativeCollectionSnapshotQuery } from '../collection/collectionQueries';
import { useNativeToolCatalogQuery } from '../tools/nativeToolQueries';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import {
  NativeTrainerProfileScreen,
  type NativeTrainerProfileAction,
} from '../../screens/NativeTrainerProfileScreen';
import { buildNativeTrainerProfileModel } from './nativeTrainerProfileModel';
import {
  createNativeTrainerProfileDraft,
  type NativeTrainerProfileDraft,
} from './nativeTrainerProfileEditorModel';
import {
  useNativeProfileRelationshipMutation,
  useNativeTrainerProfileQuery,
  useNativeTrainerProfileMutation,
  type NativeProfileRelationshipCommand,
} from './socialQueries';

type Props = { username?: string | null; embedded?: boolean };

const errorMessage = (error: unknown): string | null => (
  error instanceof Error ? error.message : error ? 'The request could not be completed.' : null
);

export const nativeProfileRelationshipCommand = (
  action: NativeTrainerProfileAction,
  profile: NonNullable<ReturnType<typeof buildNativeTrainerProfileModel>>,
): NativeProfileRelationshipCommand | null => {
  switch (action) {
    case 'add':
      return { action, username: profile.username };
    case 'accept':
    case 'cancel-request':
      return profile.friendshipId ? { action, friendshipId: profile.friendshipId } : null;
    case 'remove-friend':
    case 'block':
      return profile.userId ? { action, userId: profile.userId } : null;
  }
};

export const NativeTrainerProfileRoute = ({ username, embedded = false }: Props) => {
  const router = useRouter();
  const session = useNativeSession();
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [profileDraft, setProfileDraft] = useState<NativeTrainerProfileDraft | null>(null);
  const normalizedUsername = username?.trim() || null;
  const viewerId = session.user?.user_id ?? null;
  const isOwner = Boolean(session.user) && (
    !normalizedUsername
    || normalizedUsername.toLocaleLowerCase() === session.user?.username.toLocaleLowerCase()
  );
  const profileQuery = useNativeTrainerProfileQuery(viewerId, normalizedUsername);
  const relationshipMutation = useNativeProfileRelationshipMutation(
    viewerId ?? '',
    normalizedUsername ?? '',
  );
  const profileMutation = useNativeTrainerProfileMutation(profileQuery.data ?? null);
  // Public profiles only need the public catalog to resolve showcase artwork.
  // Loading the viewer's complete owned collection for another trainer delayed
  // the public card and made signed-out highlights impossible to render.
  const collectionQuery = useNativeCollectionSnapshotQuery(viewerId, isOwner);
  const catalogQuery = useNativeToolCatalogQuery(Boolean(profileQuery.data?.highlights.length));
  const model = useMemo(() => (
    profileQuery.data ? buildNativeTrainerProfileModel(profileQuery.data) : null
  ), [profileQuery.data]);
  const highlights = useMemo(() => {
    const catalog = catalogQuery.data ?? collectionQuery.data?.catalog;
    if (!profileQuery.data || !catalog) return [];
    const instances = Object.fromEntries(profileQuery.data.highlights.flatMap((instance, index) => {
      const key = instance.instance_id ?? `profile-highlight-${index}`;
      return [[key, instance] as [string, PokemonInstance]];
    }));
    const highlightedPokemonIds = new Set(
      profileQuery.data.highlights.map((instance) => instance.pokemon_id),
    );
    const highlightCatalog = catalog.filter((pokemon) => (
      highlightedPokemonIds.has(pokemon.pokemon_id)
    ));
    const rows = buildNativeCollectionRows(
      instances,
      highlightCatalog,
      runtimeConfig.api.frontendAppUrl,
    );
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return profileQuery.data.highlights.flatMap((instance, index) => {
      const key = instance.instance_id ?? `profile-highlight-${index}`;
      const row = rowById.get(key);
      return row ? [row] : [];
    });
  }, [catalogQuery.data, collectionQuery.data?.catalog, profileQuery.data]);
  const highlightCandidates = useMemo(() => {
    if (!collectionQuery.data) return [];
    const caughtInstances = Object.fromEntries(
      Object.entries(collectionQuery.data.instances).filter(([, instance]) => (
        instance.is_caught && !instance.disabled
      )),
    );
    return buildNativeCollectionRows(
      caughtInstances,
      collectionQuery.data.catalog,
      runtimeConfig.api.frontendAppUrl,
    );
  }, [collectionQuery.data]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening trainer profile…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  // `/profile/:username` is a public Vite route. Only the owner shortcut
  // `/profile` requires a session; public trainer cards remain readable to a
  // signed-out visitor and simply omit relationship commands.
  if ((session.status !== 'signed-in' || !session.user) && !normalizedUsername) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Fprofile" />;
  }

  const openCollection = (filter?: 'caught' | 'trade' | 'wanted' | 'favorites') => {
    if (isOwner) {
      router.push(filter ? {
        pathname: '/native/collection',
        params: { filter },
      } : '/native/collection');
      return;
    }
    router.push({
      pathname: '/native/collection/trainer/[username]',
      params: { username: model?.username ?? normalizedUsername ?? '', filter: filter ?? 'caught' },
    });
  };
  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path, '/profile');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };
  const updateRelationship = async (action: NativeTrainerProfileAction) => {
    if (!model) return;
    const command = nativeProfileRelationshipCommand(action, model);
    if (!command) {
      setFeedback({
        tone: 'error',
        text: 'This trainer relationship is missing required information. Refresh the profile and try again.',
      });
      return;
    }
    setFeedback(null);
    try {
      const message = await relationshipMutation.mutateAsync(command);
      await profileQuery.refetch();
      setFeedback({ tone: 'success', text: message });
    } catch (mutationError) {
      setFeedback({
        tone: 'error',
        text: errorMessage(mutationError) ?? 'The trainer action could not be completed.',
      });
    }
  };
  const error = errorMessage(profileQuery.error);
  const saveProfile = async () => {
    if (!profileDraft) return;
    setFeedback(null);
    try {
      await profileMutation.mutateAsync(profileDraft);
      await profileQuery.refetch();
      setProfileDraft(null);
      setFeedback({ tone: 'success', text: 'Profile updated.' });
    } catch (mutationError) {
      setFeedback({
        tone: 'error',
        text: errorMessage(mutationError) ?? 'The trainer profile could not be saved.',
      });
    }
  };

  return (
    <View style={styles.screen}>
      <NativeTrainerProfileScreen
        embedded={embedded}
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        error={error}
        highlights={highlights}
        highlightCandidates={highlightCandidates}
        isLoading={profileQuery.isPending}
        isOwner={isOwner}
        isProfileSaving={profileMutation.isPending}
        isRelationshipPending={relationshipMutation.isPending}
        model={model}
        feedback={feedback}
        editorDraft={profileDraft}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          if (normalizedUsername) {
            router.replace('/native');
            return;
          }
          router.replace('/native');
        }}
        onDismissFeedback={() => setFeedback(null)}
        onBeginEdit={isOwner && profileQuery.data
          ? () => setProfileDraft(createNativeTrainerProfileDraft(profileQuery.data))
          : undefined}
        onCancelEdit={() => setProfileDraft(null)}
        onChangeEditorDraft={setProfileDraft}
        onOpenCollection={openCollection}
        onOpenFriends={() => router.push('/native/friends')}
        onRelationshipAction={!session.user || isOwner
          ? undefined
          : (action) => void updateRelationship(action)}
        onSaveProfile={() => void saveProfile()}
        onRetry={() => {
          void profileQuery.refetch();
          if (profileQuery.data?.highlights.length) void catalogQuery.refetch();
          if (isOwner) void collectionQuery.refetch();
        }}
      />
      {!embedded ? <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={() => setActionMenuOpen(true)}
      /> : null}
      {!embedded && actionMenuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={navigateFromActionMenu}
          visible
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
