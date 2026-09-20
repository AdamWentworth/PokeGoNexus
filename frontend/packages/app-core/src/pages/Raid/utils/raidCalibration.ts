import { getStorageJson, setStorageJson, STORAGE_KEYS } from "../../../utils/storage";
import {
  RAID_CALIBRATION_MAX_OBSERVATIONS,
  isRaidCalibrationObservation,
  normalizeRaidCalibrationObservations,
  type RaidCalibrationObservation,
} from "./raidCalibrationModel";

export * from "./raidCalibrationModel";

export const loadRaidCalibrationObservations = (): RaidCalibrationObservation[] =>
  normalizeRaidCalibrationObservations(
    getStorageJson<unknown>(STORAGE_KEYS.raidCalibrationObservations),
  );

export const storeRaidCalibrationObservations = (
  observations: RaidCalibrationObservation[],
): RaidCalibrationObservation[] => {
  const retained = observations
    .filter(isRaidCalibrationObservation)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, RAID_CALIBRATION_MAX_OBSERVATIONS);
  setStorageJson(STORAGE_KEYS.raidCalibrationObservations, retained);
  return retained;
};

export const appendRaidCalibrationObservation = (
  observation: RaidCalibrationObservation,
): RaidCalibrationObservation[] => storeRaidCalibrationObservations([
  observation,
  ...loadRaidCalibrationObservations(),
]);

export const clearRaidCalibrationObservations = (
  ownerKey: string,
): RaidCalibrationObservation[] => storeRaidCalibrationObservations(
  loadRaidCalibrationObservations().filter((observation) => observation.ownerKey !== ownerKey),
);
