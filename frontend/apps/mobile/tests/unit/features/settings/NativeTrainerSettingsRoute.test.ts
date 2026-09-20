import type { NativeTrainerPreferencesDraft } from '../../../../src/features/social/nativeTrainerPreferencesModel';
import { mergeNativeTrainerPreferenceGroup } from '../../../../src/features/settings/NativeTrainerSettingsRoute';

const base: NativeTrainerPreferencesDraft = {
  collectionVisibility: 'private',
  coordinationHandle: 'OldHandle',
  coordinationMethod: 'discord',
  friendRequestPermission: 'nobody',
  profileVisibility: 'private',
  shareTradeContact: false,
  showLocation: false,
  showPokemonGoName: false,
  trainerCodeVisibility: 'private',
};

const draft: NativeTrainerPreferencesDraft = {
  collectionVisibility: 'friends',
  coordinationHandle: 'NewHandle',
  coordinationMethod: 'campfire',
  friendRequestPermission: 'everyone',
  profileVisibility: 'public',
  shareTradeContact: true,
  showLocation: true,
  showPokemonGoName: true,
  trainerCodeVisibility: 'friends',
};

describe('mergeNativeTrainerPreferenceGroup', () => {
  it('saves privacy without silently committing unsaved coordination edits', () => {
    expect(mergeNativeTrainerPreferenceGroup({ base, draft, group: 'privacy' })).toEqual({
      ...draft,
      coordinationHandle: base.coordinationHandle,
      coordinationMethod: base.coordinationMethod,
      shareTradeContact: base.shareTradeContact,
    });
  });

  it('saves coordination without silently committing unsaved privacy edits', () => {
    expect(mergeNativeTrainerPreferenceGroup({ base, draft, group: 'coordination' })).toEqual({
      ...base,
      coordinationHandle: draft.coordinationHandle,
      coordinationMethod: draft.coordinationMethod,
      shareTradeContact: draft.shareTradeContact,
    });
  });
});

