import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  TRAINER_TITLE_OPTIONS,
  TRAINER_TITLE_VISUALS,
} from '@pokemongonexus/shared-contracts/users';
import {
  NativeTrainerProfileScreen,
  resolveNativeProfileShowcaseDragTarget,
} from '../../../src/screens/NativeTrainerProfileScreen';
import type { NativeTrainerProfileModel } from '../../../src/features/social/nativeTrainerProfileModel';
import type { NativeTrainerProfileDraft } from '../../../src/features/social/nativeTrainerProfileEditorModel';
import type { NativeCollectionRow } from '../../../src/features/collection/collectionModel';

const model: NativeTrainerProfileModel = {
  userId: 'user-1',
  username: 'AdamZilla',
  pokemonGoName: 'AdamGo',
  avatarLabel: 'A',
  team: 'mystic',
  teamLabel: 'Team Mystic',
  trainerLevel: 50,
  totalXpLabel: '123,456 XP',
  memberSinceLabel: 'Jan 2, 2026',
  startedLabel: 'Jul 6, 2016',
  locationLabel: 'Burnaby, British Columbia, Canada',
  trainerCodeLabel: '1234 5678 9012',
  titles: [{ id: 'shiny-hunter', label: 'Shiny Hunter', description: 'Hunting shiny Pokémon' }],
  highlights: [],
  stats: [
    { key: 'registered', label: 'Registered', value: 800 },
    { key: 'caught', label: 'Caught', value: 100 },
    { key: 'trade', label: 'For trade', value: 20 },
    { key: 'wanted', label: 'Wanted', value: 30 },
    { key: 'favorites', label: 'Favorites', value: 10 },
  ],
  relationship: 'self',
  friendshipId: null,
  canViewCollection: true,
};

const highlight: NativeCollectionRow = {
  id: 'highlight-1',
  pokemonId: 6,
  pokedexNumber: 6,
  name: 'Shiny Gigantamax Charizard',
  imageUri: 'https://pokegonexus.com/images/shiny_gigantamax/shiny_gigantamax_6.png',
  locationBackgroundUri: null,
  maxKind: 'gigantamax',
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  cp: 3000,
  favorite: true,
  mostWanted: false,
};

const renderScreen = (props: Partial<React.ComponentProps<typeof NativeTrainerProfileScreen>> = {}) => render(
  <SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 412, height: 915 },
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  }}>
    <NativeTrainerProfileScreen
      assetBaseUrl="https://pokegonexus.com"
      highlights={[highlight]}
      isOwner
      model={model}
      onOpenCollection={jest.fn()}
      {...props}
    />
  </SafeAreaProvider>,
);

describe('NativeTrainerProfileScreen', () => {
  it('embeds the trainer card and Edit control without a second page header or workspace bar', () => {
    const onBeginEdit = jest.fn();
    const view = renderScreen({ embedded: true, onBeginEdit, onBack: jest.fn(), onOpenFriends: jest.fn() });
    expect(view.queryByText('YOUR TRAINER CARD')).toBeNull();
    expect(view.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(view.queryByTestId('native-trainer-workspace-nav')).toBeNull();
    expect(view.getByText('TRAINER CARD')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Edit' }));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });
  it('maps direct showcase drags to the same compact slot order as Vite', () => {
    expect(resolveNativeProfileShowcaseDragTarget({
      columns: 3,
      fromIndex: 0,
      selectedCount: 5,
      slotHeight: 150,
      slotWidth: 120,
      translationX: 245,
      translationY: 0,
    })).toBe(2);
    expect(resolveNativeProfileShowcaseDragTarget({
      columns: 3,
      fromIndex: 1,
      selectedCount: 5,
      slotHeight: 150,
      slotWidth: 120,
      translationX: 0,
      translationY: 160,
    })).toBe(4);
    expect(resolveNativeProfileShowcaseDragTarget({
      columns: 3,
      fromIndex: 4,
      selectedCount: 5,
      slotHeight: 150,
      slotWidth: 120,
      translationX: 300,
      translationY: 0,
    })).toBe(4);
  });

  it('renders the canonical trainer card hierarchy and showcase', () => {
    const view = renderScreen();
    expect(view.getByText('YOUR TRAINER CARD')).toBeTruthy();
    expect(view.getByText('AdamGo')).toBeTruthy();
    expect(view.getByText('@AdamZilla')).toBeTruthy();
    expect(view.getByText('Shiny Gigantamax Charizard')).toBeTruthy();
    expect(view.getByText('Shiny Hunter')).toBeTruthy();
    expect(view.getByText('1234 5678 9012')).toBeTruthy();
  });

  it('renders the exact shared Vite artwork for every trainer play style', () => {
    const allTitles = TRAINER_TITLE_OPTIONS.map(({ id, label, description }) => ({
      id,
      label,
      description,
    }));
    const view = renderScreen({ model: { ...model, titles: allTitles } });

    for (const title of TRAINER_TITLE_OPTIONS) {
      expect(view.getByTestId(
        `native-trainer-title-icon-${title.id}`,
        { includeHiddenElements: true },
      )).toBeTruthy();
      const visual = TRAINER_TITLE_VISUALS[title.id];
      if ('masks' in visual) {
        visual.masks.forEach((mask, index) => {
          const image = view.getByTestId(
            `native-trainer-title-image-${title.id}-${index}`,
            { includeHiddenElements: true },
          );
          expect(image.props.source).toEqual({ uri: `https://pokegonexus.com${mask}` });
          const imageStyle = StyleSheet.flatten(image.props.style);
          expect(imageStyle).toMatchObject({ height: 19, width: 19 });
          expect(['#5eb1f4', '#005bb5']).toContain(imageStyle.tintColor);
        });
      } else {
        expect(view.getByTestId(
          `native-trainer-title-fallback-${title.id}`,
          { includeHiddenElements: true },
        )).toBeTruthy();
      }
    }
  });

  it('opens the exact collection filter from a collection stat', () => {
    const onOpenCollection = jest.fn();
    const view = renderScreen({ onOpenCollection });
    fireEvent.press(view.getByText('For trade'));
    expect(onOpenCollection).toHaveBeenCalledWith('trade');
    fireEvent.press(view.getByRole('button', { name: 'View Pokémon' }));
    expect(onOpenCollection).toHaveBeenCalledWith();
  });

  it('keeps the signed-out public card readable without authenticated relationship commands', () => {
    const onOpenCollection = jest.fn();
    const view = renderScreen({
      isOwner: false,
      model: { ...model, relationship: 'none' },
      onOpenCollection,
      onRelationshipAction: undefined,
    });

    expect(view.getByText('TRAINER PROFILE')).toBeTruthy();
    expect(view.getByText('Shiny Gigantamax Charizard')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Add friend' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Block trainer' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Edit' })).toBeNull();

    fireEvent.press(view.getByRole('button', {
      name: "View AdamZilla's caught Pokémon",
    }));
    expect(onOpenCollection).toHaveBeenCalledWith('caught');
  });

  it('opens Friends from the shared trainer workspace navigation', () => {
    const onBack = jest.fn();
    const onOpenFriends = jest.fn();
    const view = renderScreen({ onBack, onOpenFriends });
    fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByRole('tab', { name: 'Friends' }));
    expect(onOpenFriends).toHaveBeenCalledTimes(1);
  });

  it('surfaces loading and retryable error states above the workflow', () => {
    const retry = jest.fn();
    const loading = renderScreen({ isLoading: true });
    expect(loading.getByText('Loading trainer profile')).toBeTruthy();
    loading.unmount();

    const failed = renderScreen({ error: 'Profile is private.', model: null, onRetry: retry });
    expect(failed.getByText('Profile is private.')).toBeTruthy();
    fireEvent.press(failed.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('offers the same first-profile setup action as Vite', () => {
    const onBeginEdit = jest.fn();
    const view = renderScreen({
      highlights: [],
      model: {
        ...model,
        locationLabel: 'Not shared',
        startedLabel: 'Not shared',
        team: 'neutral',
        teamLabel: 'Unaffiliated',
        titles: [],
        totalXpLabel: 'XP not shared',
        trainerCodeLabel: 'Not shared',
        trainerLevel: null,
      },
      onBeginEdit,
    });

    expect(view.getByText('Make this trainer profile yours')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Customize profile' }));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });

  it('runs direct friend actions and confirms destructive relationship changes', () => {
    const onRelationshipAction = jest.fn();
    const view = renderScreen({
      isOwner: false,
      model: { ...model, relationship: 'none' },
      onRelationshipAction,
    });
    fireEvent.press(view.getByRole('button', { name: 'Add friend' }));
    expect(onRelationshipAction).toHaveBeenCalledWith('add');

    view.rerender(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeTrainerProfileScreen
          assetBaseUrl="https://pokegonexus.com"
          highlights={[highlight]}
          isOwner={false}
          model={{ ...model, relationship: 'outgoing', friendshipId: 'friendship-1' }}
          onOpenCollection={jest.fn()}
          onRelationshipAction={onRelationshipAction}
        />
      </SafeAreaProvider>,
    );
    fireEvent.press(view.getByRole('button', { name: 'Request sent' }));
    expect(view.getByText('Cancel friend request?')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Cancel request' }));
    expect(onRelationshipAction).toHaveBeenCalledWith('cancel-request');
  });

  it('keeps command feedback visible and dismissible', () => {
    const onDismissFeedback = jest.fn();
    const view = renderScreen({
      feedback: { tone: 'error', text: 'Friend requests are disabled.' },
      onDismissFeedback,
    });
    expect(view.getByText('Friend requests are disabled.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Dismiss message' }));
    expect(onDismissFeedback).toHaveBeenCalledTimes(1);
  });

  it('opens the owner editor, updates canonical fields, and saves explicitly', () => {
    const onBeginEdit = jest.fn();
    const onCancelEdit = jest.fn();
    const onChangeEditorDraft = jest.fn();
    const onSaveProfile = jest.fn();
    const editorDraft = {
      trainerTitles: ['shiny-hunter' as const],
      pokemonGoName: 'AdamGo',
      trainerCode: '123456789012',
      team: 'Mystic',
      trainerLevel: '50',
      totalXp: '123456',
      startedOn: '2016-07-06',
      location: 'Burnaby, BC',
      highlightInstanceIds: ['highlight-1'],
    };
    const closed = renderScreen({ onBeginEdit });
    fireEvent.press(closed.getByRole('button', { name: 'Edit' }));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
    closed.unmount();

    const view = renderScreen({
      editorDraft,
      onBeginEdit,
      onCancelEdit,
      onChangeEditorDraft,
      onSaveProfile,
    });
    expect(view.getByLabelText('Pokemon GO name')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Pokemon GO name'), 'UpdatedAdam');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      pokemonGoName: 'UpdatedAdam',
    });
    fireEvent.changeText(view.getByLabelText('Trainer level'), '49');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      trainerLevel: '49',
    });
    fireEvent.changeText(view.getByLabelText('Total XP'), '654321');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      totalXp: '654321',
    });
    fireEvent.changeText(view.getByLabelText('Started playing'), '2017-01-02');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      startedOn: '2017-01-02',
    });
    fireEvent.changeText(view.getByLabelText('Location'), 'Vancouver, BC');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      location: 'Vancouver, BC',
    });
    fireEvent.changeText(view.getByLabelText('Trainer code'), '987654321098');
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      trainerCode: '987654321098',
    });
    fireEvent.press(view.getByRole('button', { name: 'Team, Mystic' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Valor' }));
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      team: 'Valor',
    });
    fireEvent.press(view.getByRole('button', { name: /Max Battler/ }));
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      trainerTitles: ['shiny-hunter', 'max-battler'],
    });
    fireEvent.press(view.getByRole('button', { name: 'Save profile' }));
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('edits and reorders the six-slot showcase from caught Pokémon only', () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onChangeEditorDraft = jest.fn();
    const editorDraft: NativeTrainerProfileDraft = {
      trainerTitles: [],
      pokemonGoName: 'AdamGo',
      trainerCode: '',
      team: 'Mystic',
      trainerLevel: '50',
      totalXp: '',
      startedOn: '',
      location: '',
      highlightInstanceIds: ['highlight-1', 'highlight-2'],
    };
    const secondHighlight = {
      ...highlight,
      id: 'highlight-2',
      name: 'Shiny Suicune',
      pokedexNumber: 245,
      pokemonId: 245,
    };
    const replacement = {
      ...highlight,
      id: 'highlight-3',
      name: 'Shiny Metagross',
      pokedexNumber: 376,
      pokemonId: 376,
    };
    const view = renderScreen({
      editorDraft: { ...editorDraft, trainerTitles: [] },
      highlightCandidates: [highlight, secondHighlight, replacement],
      highlights: [highlight, secondHighlight],
      onBeginEdit: jest.fn(),
      onCancelEdit: jest.fn(),
      onChangeEditorDraft,
      onSaveProfile: jest.fn(),
    });

    fireEvent.press(view.getByRole('button', {
      name: 'Shiny Gigantamax Charizard, edit showcase slot 1',
    }));
    expect(view.getByText('Choose a caught Pokémon')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Shiny Metagross' }));
    expect(dismissKeyboard).toHaveBeenCalledTimes(2);
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      trainerTitles: [],
      highlightInstanceIds: ['highlight-3', 'highlight-2', '', '', '', ''],
    });

    fireEvent.press(view.getByRole('button', { name: 'Move showcase slot 1 right' }));
    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      trainerTitles: [],
      highlightInstanceIds: ['highlight-2', 'highlight-1', '', '', '', ''],
    });
    dismissKeyboard.mockRestore();
  });

  it('compacts showcase slots immediately when the current slot is cleared', () => {
    const onChangeEditorDraft = jest.fn();
    const editorDraft: NativeTrainerProfileDraft = {
      trainerTitles: [],
      pokemonGoName: 'AdamGo',
      trainerCode: '',
      team: 'Mystic',
      trainerLevel: '50',
      totalXp: '',
      startedOn: '',
      location: '',
      highlightInstanceIds: ['highlight-1', 'highlight-2'],
    };
    const secondHighlight = {
      ...highlight,
      id: 'highlight-2',
      name: 'Shiny Suicune',
      pokedexNumber: 245,
      pokemonId: 245,
    };
    const view = renderScreen({
      editorDraft,
      highlightCandidates: [highlight, secondHighlight],
      highlights: [highlight, secondHighlight],
      onCancelEdit: jest.fn(),
      onChangeEditorDraft,
      onSaveProfile: jest.fn(),
    });

    fireEvent.press(view.getByRole('button', {
      name: 'Shiny Gigantamax Charizard, edit showcase slot 1',
    }));
    fireEvent.press(view.getByRole('button', { name: 'Clear slot' }));

    expect(onChangeEditorDraft).toHaveBeenCalledWith({
      ...editorDraft,
      highlightInstanceIds: ['highlight-2', '', '', '', '', ''],
    });
  });
});
