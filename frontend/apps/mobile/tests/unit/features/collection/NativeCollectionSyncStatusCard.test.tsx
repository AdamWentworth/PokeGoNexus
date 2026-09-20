import { fireEvent, render, screen } from '@testing-library/react-native';
import { NativeCollectionSyncStatusCard } from '../../../../src/features/collection/NativeCollectionSyncStatusCard';
import { useNativeCollectionSync } from '../../../../src/features/collection/NativeCollectionSyncProvider';

jest.mock('../../../../src/features/collection/NativeCollectionSyncProvider', () => ({
  useNativeCollectionSync: jest.fn(),
}));

const mockedUseSync = useNativeCollectionSync as jest.MockedFunction<
  typeof useNativeCollectionSync
>;

const status = (overrides = {}) => ({
  pendingCount: 0,
  acceptedCount: 0,
  isSyncing: false,
  isOffline: false,
  lastError: null,
  retry: jest.fn().mockResolvedValue(undefined),
  refreshStatus: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('NativeCollectionSyncStatusCard', () => {
  it('stays out of the way when no retained changes need attention', () => {
    mockedUseSync.mockReturnValue(status());
    const { toJSON } = render(<NativeCollectionSyncStatusCard />);
    expect(toJSON()).toBeNull();
  });

  it('distinguishes Receiver acceptance from canonical server confirmation', () => {
    mockedUseSync.mockReturnValue(status({ acceptedCount: 2 }));
    render(<NativeCollectionSyncStatusCard />);
    expect(screen.getByText('Accepted by Receiver')).toBeTruthy();
    expect(screen.getByText(/waiting for server confirmation/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();
  });

  it('offers a real retry when a retained batch failed', () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    mockedUseSync.mockReturnValue(status({
      pendingCount: 1,
      lastError: 'Receiver unavailable',
      retry,
    }));
    render(<NativeCollectionSyncStatusCard />);
    expect(screen.getByText('Sync needs attention')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('explains that offline changes remain on the device', () => {
    mockedUseSync.mockReturnValue(status({ isOffline: true, pendingCount: 1 }));
    render(<NativeCollectionSyncStatusCard />);
    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(screen.getByText(/safely retained on this device/i)).toBeTruthy();
  });
});
