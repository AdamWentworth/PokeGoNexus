import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { useOptionalNativeDevicePreferences } from '../../../../src/features/settings/NativeDevicePreferencesProvider';
import { useNativeColorScheme } from '../../../../src/features/settings/useNativeColorScheme';

jest.mock('../../../../src/features/settings/NativeDevicePreferencesProvider', () => ({
  useOptionalNativeDevicePreferences: jest.fn(),
}));

const mockedPreferences = jest.mocked(useOptionalNativeDevicePreferences);

describe('useNativeColorScheme', () => {
  beforeEach(() => {
    mockedPreferences.mockReturnValue(null);
  });

  it('falls back to the operating-system scheme outside the native shell', () => {
    const expected = renderHook(() => useColorScheme()).result.current;
    expect(renderHook(() => useNativeColorScheme()).result.current).toBe(expected);
  });

  it('uses the app preference as the native shell source of truth', () => {
    mockedPreferences.mockReturnValue({ colorTheme: 'light' } as never);
    expect(renderHook(() => useNativeColorScheme()).result.current).toBe('light');
  });
});
