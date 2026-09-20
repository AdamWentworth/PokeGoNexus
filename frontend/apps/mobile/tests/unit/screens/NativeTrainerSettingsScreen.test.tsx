import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeTrainerSettingsScreen } from '../../../src/screens/NativeTrainerSettingsScreen';
import type { NativeTrainerPreferencesDraft } from '../../../src/features/social/nativeTrainerPreferencesModel';

const draft: NativeTrainerPreferencesDraft = {
  collectionVisibility: 'friends',
  coordinationHandle: 'MistyTrades',
  coordinationMethod: 'discord',
  friendRequestPermission: 'everyone',
  profileVisibility: 'public',
  shareTradeContact: true,
  showLocation: false,
  showPokemonGoName: true,
  trainerCodeVisibility: 'friends',
};

const renderScreen = (props: Partial<React.ComponentProps<typeof NativeTrainerSettingsScreen>> = {}) => render(
  <NativeTrainerSettingsScreen
    colorTheme="dark"
    draft={draft}
    onBack={jest.fn()}
    onChange={jest.fn()}
    onChangeColorTheme={jest.fn()}
    onChangeReduceMotion={jest.fn()}
    onOpenAccount={jest.fn()}
    onRetry={jest.fn()}
    onRetrySync={jest.fn()}
    onSaveCoordination={jest.fn()}
    onSavePrivacy={jest.fn()}
    reduceMotion={false}
    syncSummary={{ canRetry: true, detail: 'No pending changes.', title: 'Up to date' }}
    {...props}
  />,
);

describe('NativeTrainerSettingsScreen', () => {
  it('exposes and updates every server-backed privacy control before saving', () => {
    const onChange = jest.fn();
    const onSavePrivacy = jest.fn();
    const view = renderScreen({ onChange, onSavePrivacy });

    fireEvent.press(view.getByRole('button', { name: 'Profile visibility, Everyone' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Friends only' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, profileVisibility: 'friends' });

    fireEvent.press(view.getByRole('button', { name: 'Pokémon visibility, Friends only' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Only me' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, collectionVisibility: 'private' });

    fireEvent.press(view.getByRole('button', { name: 'Friend requests, Allow requests' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Do not allow requests' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, friendRequestPermission: 'nobody' });

    fireEvent.press(view.getByRole('button', { name: 'Trainer code visibility, Friends only' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Only me' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, trainerCodeVisibility: 'private' });

    fireEvent.press(view.getByRole('switch', { name: 'Show Pokémon GO name' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, showPokemonGoName: false });
    fireEvent.press(view.getByRole('switch', { name: 'Show profile location' }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, showLocation: true });
    fireEvent.press(view.getByRole('button', { name: 'Save privacy' }));
    expect(onSavePrivacy).toHaveBeenCalledTimes(1);
  });

  it('keeps coordination state separate and disables sharing when no method is selected', () => {
    const onChange = jest.fn();
    const view = renderScreen({ onChange });

    expect(view.getByLabelText('Coordination handle')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Coordination handle'), 'UpdatedDiscord');
    expect(onChange).toHaveBeenCalledWith({ ...draft, coordinationHandle: 'UpdatedDiscord' });

    fireEvent.press(view.getByRole('button', { name: 'Preferred coordination method, Discord' }));
    fireEvent.press(view.getByRole('radio', { name: 'Select Do not share coordination details' }));
    expect(onChange).toHaveBeenCalledWith({
      ...draft,
      coordinationHandle: '',
      coordinationMethod: 'none',
      shareTradeContact: false,
    });
  });

  it('keeps device preferences and synchronization actions independent from server saves', () => {
    const onChangeReduceMotion = jest.fn();
    const onRetrySync = jest.fn();
    const view = renderScreen({ onChangeReduceMotion, onRetrySync });

    fireEvent.press(view.getByRole('switch', { name: 'Reduce motion' }));
    expect(onChangeReduceMotion).toHaveBeenCalledWith(true);
    expect(view.getByText('Up to date')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Retry now' }));
    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });

  it('uses the same immediate animated theme switch as Vite', () => {
    const onChangeColorTheme = jest.fn();
    const view = renderScreen({ colorTheme: 'dark', onChangeColorTheme });

    fireEvent.press(view.getByRole('switch', { name: 'Use light theme' }));

    expect(onChangeColorTheme).toHaveBeenCalledWith('light');
    expect(view.queryByRole('button', { name: 'Color theme, Dark' })).toBeNull();
  });

  it('clears text focus while scrolling and before saving coordination settings', () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onSaveCoordination = jest.fn();
    const view = renderScreen({ onSaveCoordination });

    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      Platform.OS === 'ios' ? 'padding' : 'height',
    );
    expect(view.getByTestId('native-trainer-settings-content').props.keyboardDismissMode).toBe('on-drag');

    fireEvent(view.getByTestId('native-trainer-settings-content'), 'scrollBeginDrag');
    fireEvent.press(view.getByRole('button', { name: 'Save coordination' }));

    expect(dismissKeyboard).toHaveBeenCalledTimes(2);
    expect(onSaveCoordination).toHaveBeenCalledTimes(1);
    dismissKeyboard.mockRestore();
  });
});
