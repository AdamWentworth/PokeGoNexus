import { fireEvent, render, screen } from '@testing-library/react-native';
import NativePvpRoute from '../../../../src/app/native/pvp';
import { useNativeMovesDataQuery, useNativeToolCatalogQuery } from '../../../../src/features/tools/nativeToolQueries';
import { useNativeCollectionSnapshotQuery } from '../../../../src/features/collection/collectionQueries';

jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: jest.fn() }) }));
jest.mock('../../../../src/auth/NativeSessionContext', () => ({ useNativeSession: () => ({ user: { user_id: 'trainer' } }) }));
jest.mock('../../../../src/config/runtimeConfig', () => ({ runtimeConfig: { api: { frontendAppUrl: 'https://pokegonexus.com' } } }));
jest.mock('../../../../src/features/tools/nativeToolQueries', () => ({
  useNativeToolCatalogQuery: jest.fn(() => ({ data: [], isPending: false })),
  useNativeMovesDataQuery: jest.fn(() => ({ data: [], isPending: false })),
  useNativePvpDataQuery: jest.fn(() => ({ data: null, isPending: false })),
}));
jest.mock('../../../../src/features/collection/collectionQueries', () => ({ useNativeCollectionSnapshotQuery: jest.fn(() => ({ data: null, isPending: false })) }));
jest.mock('../../../../src/components/NativeActionMenu', () => ({ NativeActionMenu: () => null }));
jest.mock('../../../../src/components/NativeActionMenuAnchor', () => ({ NativeActionMenuAnchor: () => null }));
jest.mock('../../../../src/screens/NativePvpScreen', () => {
  const { Button, View } = jest.requireActual('react-native');
  return { NativePvpScreen: ({ onCatalogNeeded, onOwnedDataNeeded }: { onCatalogNeeded: () => void; onOwnedDataNeeded: () => void }) => <View>
    <Button title="Open public tools" onPress={onCatalogNeeded} />
    <Button title="Use my Pokémon" onPress={onOwnedDataNeeded} />
  </View> };
});

test('loads move mechanics with public tools even when no other route has warmed the cache', () => {
  render(<NativePvpRoute />);
  expect(useNativeToolCatalogQuery).toHaveBeenLastCalledWith(false);
  expect(useNativeMovesDataQuery).toHaveBeenLastCalledWith(false);
  fireEvent.press(screen.getByText('Open public tools'));
  expect(useNativeToolCatalogQuery).toHaveBeenLastCalledWith(true);
  expect(useNativeMovesDataQuery).toHaveBeenLastCalledWith(true);
  expect(useNativeCollectionSnapshotQuery).toHaveBeenLastCalledWith('trainer', false);
  fireEvent.press(screen.getByText('Use my Pokémon'));
  expect(useNativeCollectionSnapshotQuery).toHaveBeenLastCalledWith('trainer', true);
});
