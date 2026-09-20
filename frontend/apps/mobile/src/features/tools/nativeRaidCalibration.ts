import * as SecureStore from 'expo-secure-store';
import {
  RAID_CALIBRATION_MAX_OBSERVATIONS,
  analyzeRaidCalibration,
  createRaidCalibrationObservation,
  isRaidCalibrationObservation,
  normalizeRaidCalibrationObservations,
  serializeRaidCalibrationObservations,
  type CreateRaidCalibrationObservationInput,
  type RaidCalibrationObservation,
  type RaidCalibrationPredictionSource,
  type RaidCalibrationProfile,
  type RaidObservationActual,
} from '@pokemongonexus/app-core/raid-calibration-model';

export type NativeRaidObservation = RaidCalibrationObservation;
export type NativeRaidCalibrationProfile = RaidCalibrationProfile;
export type NativeRaidObservationActual = RaidObservationActual;
export type NativeRaidCalibrationPredictionSource = RaidCalibrationPredictionSource;
export type CreateNativeRaidObservationInput = CreateRaidCalibrationObservationInput;

const STORAGE_KEY = 'pokegonexus.native.raid-observations.v2';

export const normalizeNativeRaidObservations = (value: unknown): NativeRaidObservation[] =>
  normalizeRaidCalibrationObservations(value)
    .filter(isRaidCalibrationObservation)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, RAID_CALIBRATION_MAX_OBSERVATIONS);

export const loadNativeRaidObservations = async (): Promise<NativeRaidObservation[]> => {
  const stored = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!stored) return [];
  try {
    return normalizeNativeRaidObservations(JSON.parse(stored));
  } catch {
    return [];
  }
};

export const saveNativeRaidObservations = async (
  observations: NativeRaidObservation[],
): Promise<NativeRaidObservation[]> => {
  const retained = normalizeNativeRaidObservations(observations);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(retained));
  return retained;
};

export const clearNativeRaidObservations = async (
  ownerKey?: string,
): Promise<NativeRaidObservation[]> => {
  if (!ownerKey) {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return [];
  }
  const retained = (await loadNativeRaidObservations()).filter(
    (observation) => observation.ownerKey !== ownerKey,
  );
  await saveNativeRaidObservations(retained);
  return retained;
};

export const createNativeRaidObservation = (
  input: CreateNativeRaidObservationInput,
): NativeRaidObservation => createRaidCalibrationObservation(input);

export const summarizeNativeRaidCalibration = (
  observations: NativeRaidObservation[],
): NativeRaidCalibrationProfile => analyzeRaidCalibration(observations);

export const serializeNativeRaidObservations = (
  observations: NativeRaidObservation[],
  modelVersion?: number,
): string => serializeRaidCalibrationObservations(observations, modelVersion);
