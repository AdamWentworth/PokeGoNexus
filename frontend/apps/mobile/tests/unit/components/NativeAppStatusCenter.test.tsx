import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NativeAppStatusCenter } from '../../../src/components/NativeAppStatusCenter';

let mockNetwork = { isConnected: true, isInternetReachable: true };
let mockSession = { status: 'signed-in' };
const mockRetry = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn();
let mockSync = { pendingCount: 0, acceptedCount: 0, isSyncing: false, isOffline: false, lastError: null as string | null, retry: mockRetry };
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { refresh: () => mockRefresh() }, useNetInfo: () => mockNetwork }));
jest.mock('../../../src/auth/NativeSessionContext', () => ({ useNativeSession: () => mockSession }));
jest.mock('../../../src/features/collection/NativeCollectionSyncProvider', () => ({ useNativeCollectionSync: () => mockSync }));

describe('NativeAppStatusCenter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNetwork = { isConnected: true, isInternetReachable: true };
    mockSession = { status: 'signed-in' };
    mockSync = { pendingCount: 0, acceptedCount: 0, isSyncing: false, isOffline: false, lastError: null, retry: mockRetry };
    mockRetry.mockClear(); mockRefresh.mockReset(); mockRefresh.mockResolvedValue(mockNetwork);
  });
  afterEach(() => { jest.useRealTimers(); });

  it('stays hidden when healthy, announces reconnection once, and expires after four seconds', () => {
    const view = render(<NativeAppStatusCenter />);
    expect(screen.queryByTestId('native-app-status-center')).toBeNull();
    mockNetwork = { isConnected: false, isInternetReachable: false };
    view.rerender(<NativeAppStatusCenter />);
    expect(screen.getByText('You’re offline')).toBeTruthy();
    mockNetwork = { isConnected: true, isInternetReachable: true };
    view.rerender(<NativeAppStatusCenter />);
    expect(screen.getByText('Back online')).toBeTruthy();
    act(() => jest.advanceTimersByTime(4_000));
    expect(screen.queryByTestId('native-app-status-center')).toBeNull();
    view.rerender(<NativeAppStatusCenter />);
    expect(screen.queryByText('Back online')).toBeNull();
  });

  it('prioritizes offline feedback and checks reachability before retrying retained changes', async () => {
    mockNetwork = { isConnected: true, isInternetReachable: false };
    mockSync = { ...mockSync, pendingCount: 1, acceptedCount: 1, lastError: 'Receiver failed' };
    render(<NativeAppStatusCenter />);
    expect(screen.getByText(/2 collection changes are safe/)).toBeTruthy();
    expect(screen.queryByText('Collection sync needs attention')).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check again' })));
    expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows global sync failure and exposes the retry action', async () => {
    mockSync = { ...mockSync, pendingCount: 1, lastError: 'Receiver failed' };
    render(<NativeAppStatusCenter />);
    expect(screen.getByText('Collection sync needs attention')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry sync' })));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('supports signed-out connectivity without showing another session’s sync state', async () => {
    mockNetwork = { isConnected: false, isInternetReachable: false };
    mockSession = { status: 'signed-out' };
    mockSync = { ...mockSync, pendingCount: 9, lastError: 'old error' };
    render(<NativeAppStatusCenter />);
    expect(screen.queryByText(/9 collection/)).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check again' })));
    expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockRetry).not.toHaveBeenCalled();
  });

  it('handles a failed connection check and never syncs while reachability remains false', async () => {
    mockNetwork = { isConnected: false, isInternetReachable: false };
    mockRefresh.mockRejectedValueOnce(new Error('network'));
    render(<NativeAppStatusCenter />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check again' })));
    expect(screen.getByText('The connection check failed. Please try again.')).toBeTruthy();
    mockRefresh.mockResolvedValueOnce(mockNetwork);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check again' })));
    expect(mockRetry).not.toHaveBeenCalled();
  });
});
