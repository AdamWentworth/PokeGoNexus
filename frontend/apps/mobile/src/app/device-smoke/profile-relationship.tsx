import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeConfirmationDialog } from '../../components/NativeConfirmationDialog';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import type { NativeTrainerProfileModel } from '../../features/social/nativeTrainerProfileModel';
import {
  NativeTrainerProfileScreen,
  type NativeTrainerProfileAction,
} from '../../screens/NativeTrainerProfileScreen';

const MODEL: NativeTrainerProfileModel = {
  userId: 'trainer-misty',
  username: 'Misty',
  pokemonGoName: 'CeruleanLeader',
  avatarLabel: 'M',
  team: 'mystic',
  teamLabel: 'Team Mystic',
  trainerLevel: 50,
  totalXpLabel: '98,765,432 XP',
  memberSinceLabel: 'Mar 4, 2026',
  startedLabel: 'Jul 6, 2016',
  locationLabel: 'Cerulean City',
  trainerCodeLabel: '1234 5678 9012',
  titles: [{ id: 'lucky-trader', label: 'Lucky Trader', description: 'Trading and Lucky Pokémon' }],
  highlights: [],
  stats: [
    { key: 'registered', label: 'Registered', value: 842 },
    { key: 'caught', label: 'Caught', value: 410 },
    { key: 'trade', label: 'For trade', value: 62 },
    { key: 'wanted', label: 'Wanted', value: 31 },
    { key: 'favorites', label: 'Favorites', value: 14 },
  ],
  relationship: 'outgoing',
  friendshipId: 'friendship-misty',
  canViewCollection: true,
};

const resultFor = (action: NativeTrainerProfileAction) => ({
  accept: { relationship: 'friend' as const, text: 'Friend request accepted.' },
  add: { relationship: 'outgoing' as const, text: 'Friend request sent.' },
  block: { relationship: 'blocked' as const, text: 'Trainer blocked.' },
  'cancel-request': { relationship: 'none' as const, text: 'Friend request canceled.' },
  'remove-friend': { relationship: 'none' as const, text: 'Friend removed.' },
})[action];

export default function DeviceSmokeProfileRelationshipRoute() {
  const [model, setModel] = useState(MODEL);
  const [feedback, setFeedback] = useState<{ tone: 'success'; text: string } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(true);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  const updateRelationship = (action: NativeTrainerProfileAction) => {
    const result = resultFor(action);
    setModel((current) => ({
      ...current,
      relationship: result.relationship,
      friendshipId: result.relationship === 'outgoing' ? 'friendship-misty' : null,
    }));
    setFeedback({ tone: 'success', text: result.text });
  };
  return (
    <View style={styles.screen}>
      <NativeTrainerProfileScreen
        assetBaseUrl="https://pokegonexus.com"
        feedback={feedback}
        isOwner={false}
        model={model}
        onDismissFeedback={() => setFeedback(null)}
        onOpenCollection={() => undefined}
        onOpenFriends={() => undefined}
        onRelationshipAction={updateRelationship}
      />
      <NativeConfirmationDialog
        body="Your pending request to Misty will be canceled."
        confirmLabel="Cancel request"
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={() => {
          setConfirmationOpen(false);
          updateRelationship('cancel-request');
        }}
        title="Cancel friend request?"
        visible={confirmationOpen}
      />
      <NativeRouteActionMenu currentPath="/profile/Misty" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
