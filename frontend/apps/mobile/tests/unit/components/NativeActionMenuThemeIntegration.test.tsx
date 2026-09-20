import * as SecureStore from 'expo-secure-store';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance, Pressable, Text } from 'react-native';
import {
  NativeDevicePreferencesProvider,
  useNativeDevicePreferences,
} from '../../../src/features/settings/NativeDevicePreferencesProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);

const ThemeProbe = () => {
  const { colorTheme, toggleColorTheme } = useNativeDevicePreferences();
  return (
    <>
      <Text testID="active-native-theme">{colorTheme}</Text>
      <Pressable accessibilityLabel="Toggle app-owned theme" onPress={toggleColorTheme} />
    </>
  );
};

describe('NativeActionMenu theme integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockResolvedValue(undefined);
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('changes and persists the real app-owned theme used by the action-menu switch', async () => {
    render(
      <NativeDevicePreferencesProvider>
        <ThemeProbe />
      </NativeDevicePreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('active-native-theme').props.children).toBe('dark'));
    fireEvent.press(screen.getByLabelText('Toggle app-owned theme'));

    await waitFor(() => {
      expect(screen.getByTestId('active-native-theme').props.children).toBe('light');
    });
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('light');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'pokemongonexus.mobile.device-preferences.v1',
      JSON.stringify({ colorTheme: 'light', reduceMotion: false }),
    );
  });
});
