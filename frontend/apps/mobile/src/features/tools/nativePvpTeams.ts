import * as SecureStore from "expo-secure-store";

export type NativePvpTeamSlots = [string | null, string | null, string | null];

const STORAGE_KEY = "pokemongonexus.native.pvp-teams.v1";
const EMPTY_TEAM: NativePvpTeamSlots = [null, null, null];

type StoredTeams = Record<string, (string | null)[]>;

const normalizeSlots = (value: unknown): NativePvpTeamSlots => {
  if (!Array.isArray(value)) return [...EMPTY_TEAM];
  const slots = value.slice(0, 3).map((item) =>
    typeof item === "string" && item.trim() ? item : null,
  );
  while (slots.length < 3) slots.push(null);
  return slots as NativePvpTeamSlots;
};

const readTeams = async (): Promise<StoredTeams> => {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StoredTeams)
      : {};
  } catch {
    return {};
  }
};

export const loadNativePvpTeam = async (
  teamKey: string,
): Promise<NativePvpTeamSlots> => {
  const teams = await readTeams();
  return normalizeSlots(teams[teamKey]);
};

export const saveNativePvpTeam = async (
  teamKey: string,
  slots: NativePvpTeamSlots,
): Promise<void> => {
  try {
    const teams = await readTeams();
    teams[teamKey] = normalizeSlots(slots);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(teams));
  } catch {
    // A team remains fully usable in memory if device persistence is unavailable.
  }
};
