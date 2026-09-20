import * as SecureStore from 'expo-secure-store';
import {
  clearNativeRaidObservations,
  createNativeRaidObservation,
  loadNativeRaidObservations,
  saveNativeRaidObservations,
  serializeNativeRaidObservations,
  summarizeNativeRaidCalibration,
  type CreateNativeRaidObservationInput,
  type NativeRaidObservation,
} from '../../../src/features/tools/nativeRaidCalibration';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);
const observationInput = (
  overrides: Partial<CreateNativeRaidObservationInput> = {},
): CreateNativeRaidObservationInput => ({
  ownerKey: 'trainer-a',
  modelVersion: 10,
  catalogVersion: 'catalog-1',
  bossVariantId: 'bulbasaur-default',
  bossName: 'Bulbasaur',
  tierKey: 'tier1',
  predictionSource: 'custom-party',
  scenarioKey: 'party-2-test',
  dodgeCalibrationApplied: false,
  predicted: {
    clearTimeSeconds: 100,
    faints: 4,
    relobbies: 0,
    winRate: 1,
    p10ClearTimeSeconds: 90,
    p90ClearTimeSeconds: 115,
  },
  actual: {
    outcome: 'cleared',
    trainerCount: 2,
    clearTimeSeconds: 110,
    remainingBossHpPercent: null,
    faints: 5,
    relobbies: 1,
    dodgeAttempts: 3,
    successfulDodges: 2,
    latencyMs: 120,
  },
  ...overrides,
});
const observation = (overrides: Partial<CreateNativeRaidObservationInput> = {}): NativeRaidObservation =>
  createNativeRaidObservation(observationInput(overrides));

describe('native raid calibration canonical storage adapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the shared calibration analysis for timing, outcomes, and dodge evidence', () => {
    const rows = Array.from({ length: 5 }, (_, index) => observation({ id: `raid-${index}` }));
    const profile = summarizeNativeRaidCalibration(rows);
    expect(profile).toMatchObject({
      canApplyDodgeCalibration: true,
      clearSampleCount: 5,
      dodgeAttempts: 15,
      exactPartySampleCount: 5,
      predictedOutcomeAccuracy: 1,
      sampleCount: 5,
    });
    expect(profile.dodgeSuccessRate).toBeCloseTo(2 / 3);
    expect(profile.meanAbsoluteTimingErrorPercent).toBeCloseTo(10 / 110);
  });

  it('loads, stores, clears, and exports the canonical schema-v2 device log', async () => {
    const row = observation({ id: 'raid-1' });
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify([row]));
    expect(await loadNativeRaidObservations()).toEqual([row]);
    await saveNativeRaidObservations([row]);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(expect.stringContaining('raid-observations.v2'), expect.stringContaining('raid-1'));
    await clearNativeRaidObservations();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(expect.stringContaining('raid-observations.v2'));
    expect(serializeNativeRaidObservations([row], 10)).toContain('"schemaVersion": 2');
  });

  it('clears only the active owner while retaining other device profiles', async () => {
    const own = observation({ id: 'own' });
    const other = observation({ id: 'other', ownerKey: 'trainer-b' });
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify([own, other]));
    expect(await clearNativeRaidObservations('trainer-a')).toEqual([other]);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      expect.stringContaining('raid-observations.v2'),
      expect.stringContaining('trainer-b'),
    );
  });
});
