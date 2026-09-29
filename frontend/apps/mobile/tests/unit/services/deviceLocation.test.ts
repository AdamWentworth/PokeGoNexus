import { PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import { getNativeCurrentCoordinates } from '../../../src/services/deviceLocation';

type PermissionResults = Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;

const originalPlatform = Platform.OS;
const { ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION } = PermissionsAndroid.PERMISSIONS;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
const coordinates = { latitude: 49.28, longitude: -123.12 };
let emitPosition: (position: unknown) => void;
const remove = jest.fn();
const locationModule = {
  getConstants: () => ({}),
  getCurrentPosition: jest.fn(),
  requestPermissions: jest.fn(),
  onUpdate: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

const usePlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
};

const expectCleanup = () => {
  expect(remove).toHaveBeenCalledTimes(1);
  expect(locationModule.stop).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
};

describe('native device location', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    usePlatform('android');
    remove.mockReset();
    locationModule.start.mockReset();
    locationModule.stop.mockReset();
    locationModule.getCurrentPosition.mockReset().mockResolvedValue({ coords: coordinates, timestamp: Date.now() });
    locationModule.requestPermissions.mockReset().mockResolvedValue(undefined);
    locationModule.onUpdate.mockReset().mockImplementation((listener) => {
      emitPosition = listener;
      return { remove };
    });
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(locationModule);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [ACCESS_FINE_LOCATION]: DENIED,
      [ACCESS_COARSE_LOCATION]: GRANTED,
    } as PermissionResults);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    usePlatform(originalPlatform);
  });

  it.each([ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION])('accepts Android permission %s', async (permission) => {
    jest.mocked(PermissionsAndroid.requestMultiple).mockResolvedValue({
      [ACCESS_FINE_LOCATION]: DENIED,
      [ACCESS_COARSE_LOCATION]: DENIED,
      [permission]: GRANTED,
    } as PermissionResults);
    await expect(getNativeCurrentCoordinates()).resolves.toEqual(coordinates);
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION,
    ]);
    expect(TurboModuleRegistry.get).toHaveBeenCalledWith('MLRNLocationModule');
    expect(locationModule.requestPermissions).not.toHaveBeenCalled();
    expect(locationModule.onUpdate.mock.invocationCallOrder[0])
      .toBeLessThan(locationModule.start.mock.invocationCallOrder[0]);
    expectCleanup();
  });

  it.each([DENIED, NEVER_ASK_AGAIN])('does not query location when Android permission is %s', async (denial) => {
    jest.mocked(PermissionsAndroid.requestMultiple).mockResolvedValue({
      [ACCESS_FINE_LOCATION]: denial,
      [ACCESS_COARSE_LOCATION]: denial,
    } as PermissionResults);
    await expect(getNativeCurrentCoordinates()).rejects.toThrow('Location permission was not granted');
    expect(locationModule.start).not.toHaveBeenCalled();
    expect(locationModule.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('requests iOS permission and accepts its epoch-second timestamp', async () => {
    usePlatform('ios');
    locationModule.getCurrentPosition.mockResolvedValue({ coords: coordinates, timestamp: Date.now() / 1_000 });
    await expect(getNativeCurrentCoordinates()).resolves.toEqual(coordinates);
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    expect(locationModule.requestPermissions.mock.invocationCallOrder[0])
      .toBeLessThan(locationModule.start.mock.invocationCallOrder[0]);
    expectCleanup();
  });

  it('does not start location after an iOS permission rejection', async () => {
    usePlatform('ios');
    locationModule.requestPermissions.mockRejectedValue(new Error('Request denied'));
    await expect(getNativeCurrentCoordinates()).rejects.toThrow('Request denied');
    expect(locationModule.start).not.toHaveBeenCalled();
  });

  it('explains when the native module is unavailable', async () => {
    jest.mocked(TurboModuleRegistry.get).mockReturnValue(null);
    await expect(getNativeCurrentCoordinates()).rejects.toThrow('Device location is unavailable');
  });

  it('does not request native location on web', async () => {
    usePlatform('web');
    await expect(getNativeCurrentCoordinates()).rejects.toThrow('available in the installed app');
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    expect(TurboModuleRegistry.get).not.toHaveBeenCalled();
  });

  it.each([
    null, undefined, {}, { coords: {} },
    { coords: { latitude: NaN, longitude: 0 } },
    { coords: { latitude: 0, longitude: Infinity } },
    { coords: { latitude: 91, longitude: 0 } },
    { coords: { latitude: 0, longitude: -181 } },
    { coords: { latitude: '49.28', longitude: -123.12 } },
    { coords: coordinates },
    { coords: coordinates, timestamp: Infinity },
  ])('waits for a valid fix after an invalid cached position: %j', async (position) => {
    locationModule.getCurrentPosition.mockResolvedValue(position);
    const result = getNativeCurrentCoordinates();
    await jest.advanceTimersByTimeAsync(0);
    emitPosition(position);
    expect(locationModule.stop).not.toHaveBeenCalled();
    emitPosition({ coords: coordinates, timestamp: Date.now() });
    await expect(result).resolves.toEqual(coordinates);
    expectCleanup();
  });

  it.each([-60_001, 1_000])('waits for a fresh fix after a stale/future position: %s ms', async (offset) => {
    const stale = { coords: coordinates, timestamp: Date.now() + offset };
    locationModule.getCurrentPosition.mockResolvedValue(stale);
    const result = getNativeCurrentCoordinates();
    await jest.advanceTimersByTimeAsync(0);
    emitPosition(stale);
    expect(locationModule.stop).not.toHaveBeenCalled();
    emitPosition({ coords: coordinates, timestamp: Date.now() });
    await expect(result).resolves.toEqual(coordinates);
    expectCleanup();
  });

  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 90, longitude: -180 },
  ])('accepts valid coordinate boundaries: %j', async (coords) => {
    locationModule.getCurrentPosition.mockResolvedValue({ coords, timestamp: Date.now() - 60_000 });
    await expect(getNativeCurrentCoordinates()).resolves.toEqual(coords);
    expectCleanup();
  });

  it('accepts a fresh event even when last-known lookup fails', async () => {
    locationModule.getCurrentPosition.mockRejectedValue(new Error('No cached position'));
    const result = getNativeCurrentCoordinates();
    await jest.advanceTimersByTimeAsync(0);
    emitPosition({ coords: coordinates, timestamp: Date.now() });
    await expect(result).resolves.toEqual(coordinates);
    expectCleanup();
  });

  it('coalesces concurrent callers and ignores late position replies', async () => {
    let completeCached!: (value: unknown) => void;
    locationModule.getCurrentPosition.mockReturnValue(new Promise((resolve) => { completeCached = resolve; }));
    const first = getNativeCurrentCoordinates();
    const second = getNativeCurrentCoordinates();
    expect(second).toBe(first);
    await jest.advanceTimersByTimeAsync(0);
    emitPosition({ coords: coordinates, timestamp: Date.now() });
    await expect(first).resolves.toEqual(coordinates);
    await expect(second).resolves.toEqual(coordinates);
    completeCached({ coords: { latitude: 1, longitude: 2 }, timestamp: Date.now() });
    await jest.advanceTimersByTimeAsync(0);
    expect(locationModule.start).toHaveBeenCalledTimes(1);
    expectCleanup();
  });

  it('cleans up if starting the native provider fails', async () => {
    locationModule.start.mockImplementation(() => { throw new Error('Provider unavailable'); });
    await expect(getNativeCurrentCoordinates()).rejects.toThrow('Provider unavailable');
    expectCleanup();
  });

  it('times out, stops tracking, and allows a later retry', async () => {
    locationModule.getCurrentPosition.mockReturnValue(new Promise(() => {}));
    const result = expect(getNativeCurrentCoordinates()).rejects.toThrow('Finding your location timed out');
    await jest.advanceTimersByTimeAsync(15_000);
    await result;
    expectCleanup();
    locationModule.getCurrentPosition.mockResolvedValue({ coords: coordinates, timestamp: Date.now() });
    await expect(getNativeCurrentCoordinates()).resolves.toEqual(coordinates);
    expect(locationModule.start).toHaveBeenCalledTimes(2);
    expect(locationModule.stop).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
