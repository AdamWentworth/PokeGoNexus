import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import type {
  PokemonPvPBattleMechanics,
  PokemonPvPBattleResponse,
  PokemonPvPRankingEntry,
} from "@pokemongonexus/shared-contracts/pokemon";
import {
  buildPvPBattleFighterFromRankingEntry,
  simulatePvPBattleLocally,
} from "@pokemongonexus/shared-domain/pvp-battle";
import { NativePvpTeamBattle } from "./NativePvpTeamBattle";
import { NativeUiIcon } from "../NativeUiIcon";
import type { PvPTeamCandidate } from "@pokemongonexus/app-core/pvp-team-builder";
import { pvpBattleMechanicsLabel } from "@pokemongonexus/app-core/pvp-battle-mechanics";
import { markNativeUiPerformanceAfterPaint } from "../../observability/nativeUiInteractionTiming";

type Props = {
  assetBaseUrl: string;
  candidates: PvPTeamCandidate[];
  formatLabel: string;
  initialSelection?: {
    mode?: "single" | "team";
    leftKey: string;
    rightKey: string;
    leftTeamKeys?: string[];
    rightTeamKeys?: string[];
  } | null;
  light: boolean;
  mechanics: PokemonPvPBattleMechanics;
  opponentCandidates: PvPTeamCandidate[];
  onResultLayout?: (offsetY: number) => void;
  playerSideLabel?: string;
};

const assetUri = (base: string, value: string): string | undefined => {
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
};

const Choice = ({
  accessibilityLabel,
  active,
  label,
  light,
  onPress,
}: {
  accessibilityLabel?: string;
  active: boolean;
  label: string;
  light: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[
      styles.choice,
      light && styles.controlLight,
      active && styles.choiceActive,
    ]}
  >
    <Text
      style={[
        styles.choiceText,
        light && styles.textLight,
        active && styles.choiceTextActive,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const ResultSide = ({
  assetBaseUrl,
  candidate,
  entry,
  index,
  light,
  result,
}: {
  assetBaseUrl: string;
  candidate: PvPTeamCandidate;
  entry: PokemonPvPRankingEntry;
  index: 0 | 1;
  light: boolean;
  result: PokemonPvPBattleResponse;
}) => {
  const combatant = result.fighters[index];
  const hpPercent =
    combatant.maxHp > 0
      ? Math.max(0, Math.min(100, (combatant.hp / combatant.maxHp) * 100))
      : 0;
  return (
    <View style={styles.resultSide}>
      <Image
        fadeDuration={0}
        resizeMode="contain"
        source={{ uri: assetUri(assetBaseUrl, entry.imageUrl) }}
        style={styles.resultPokemonImage}
      />
      <View style={styles.resultSideCopy}>
        <Text
          numberOfLines={1}
          style={[styles.resultName, light && styles.textLight]}
        >
          {candidate.nickname || entry.name}
        </Text>
        <View style={[styles.hpTrack, light && styles.hpTrackLight]}>
          <View style={[styles.hpFill, { width: `${hpPercent}%` }]} />
        </View>
        <Text style={[styles.resultMeta, light && styles.mutedLight]}>
          {combatant.hp} / {combatant.maxHp} HP
        </Text>
      </View>
      <View style={styles.resultStat}>
        <Text style={styles.resultStatValue}>{result.ratings[index]}</Text>
        <Text style={[styles.resultStatLabel, light && styles.mutedLight]}>rating</Text>
      </View>
      <View style={styles.resultStat}>
        <Text style={[styles.resultStatValue, light && styles.textLight]}>{combatant.shields}</Text>
        <Text style={[styles.resultStatLabel, light && styles.mutedLight]}>shields</Text>
      </View>
      <View style={styles.resultStat}>
        <Text style={[styles.resultStatValue, light && styles.textLight]}>{combatant.energy}</Text>
        <Text style={[styles.resultStatLabel, light && styles.mutedLight]}>energy</Text>
      </View>
    </View>
  );
};

export const NativePvpBattleLab = ({
  assetBaseUrl,
  candidates,
  formatLabel,
  initialSelection,
  light,
  mechanics,
  opponentCandidates,
  onResultLayout,
  playerSideLabel = "Side A",
}: Props) => {
  const performanceStartsRef = useRef(new Map<string, number>());
  const beginPerformance = useCallback((event: string) => {
    performanceStartsRef.current.set(event, Date.now());
  }, []);
  const finishPerformance = useCallback((event: string) => {
    const startedAt = performanceStartsRef.current.get(event);
    if (startedAt == null) return;
    performanceStartsRef.current.delete(event);
    markNativeUiPerformanceAfterPaint(event, startedAt);
  }, []);
  const readyCandidates = useMemo(
    () => candidates.filter((candidate) => buildPvPBattleFighterFromRankingEntry(candidate.entry, candidate.key) != null),
    [candidates],
  );
  const readyOpponents = useMemo(
    () => opponentCandidates.filter((candidate) => buildPvPBattleFighterFromRankingEntry(candidate.entry, candidate.key) != null),
    [opponentCandidates],
  );
  const [leftId, setLeftId] = useState(initialSelection?.leftKey ?? "");
  const [rightId, setRightId] = useState(initialSelection?.rightKey ?? "");
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const deferredLeftQuery = useDeferredValue(leftQuery);
  const deferredRightQuery = useDeferredValue(rightQuery);
  const [shields, setShields] = useState<[number, number]>([1, 1]);
  const [energy, setEnergy] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<PokemonPvPBattleResponse | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"single" | "team">(initialSelection?.mode ?? "single");
  const [simulating, setSimulating] = useState(false);

  const left = readyCandidates.find((candidate) => candidate.key === leftId) ?? readyCandidates[0];
  const right = readyOpponents.find((candidate) => candidate.key === rightId)
    ?? readyOpponents.find((candidate) => candidate.key !== left?.key)
    ?? readyOpponents[0];
  const searchableText = (candidate: PvPTeamCandidate) => [candidate.entry.name, candidate.nickname ?? "", candidate.entry.speciesId, ...candidate.entry.types, ...candidate.entry.moveset.map((move) => move.name)].join(" ").toLocaleLowerCase();
  const visibleLeft = useMemo(() => {
    const normalized = deferredLeftQuery.trim().toLocaleLowerCase();
    return readyCandidates.filter((candidate) => !normalized || searchableText(candidate).includes(normalized)).slice(0, 12);
  }, [deferredLeftQuery, readyCandidates]);
  const visibleRight = useMemo(() => {
    const normalized = deferredRightQuery.trim().toLocaleLowerCase();
    return readyOpponents.filter((candidate) => !normalized || searchableText(candidate).includes(normalized)).slice(0, 12);
  }, [deferredRightQuery, readyOpponents]);

  const selectEntry = (side: 0 | 1, candidate: PvPTeamCandidate) => {
    beginPerformance("pvp_battle_selection_result_painted");
    if (side === 0) setLeftId(candidate.key);
    else setRightId(candidate.key);
    setResult(null);
    setError("");
  };

  useEffect(() => finishPerformance("pvp_battle_mode_result_painted"), [finishPerformance, mode]);
  useEffect(() => finishPerformance("pvp_battle_selection_result_painted"), [finishPerformance, leftId, rightId]);
  useEffect(() => finishPerformance("pvp_battle_condition_result_painted"), [energy, finishPerformance, shields]);
  useEffect(() => {
    if (leftQuery === deferredLeftQuery && rightQuery === deferredRightQuery) finishPerformance("pvp_battle_picker_search_result_painted");
  }, [deferredLeftQuery, deferredRightQuery, finishPerformance, leftQuery, rightQuery, visibleLeft, visibleRight]);

  const setPairValue = (
    setter: Dispatch<SetStateAction<[number, number]>>,
    side: 0 | 1,
    value: number,
  ) => {
    beginPerformance("pvp_battle_condition_result_painted");
    setter((current) =>
      side === 0 ? [value, current[1]] : [current[0], value],
    );
    setResult(null);
    setError("");
  };

  const simulate = async () => {
    if (!left || !right) return;
    const fighters = [
      buildPvPBattleFighterFromRankingEntry(left.entry, left.key),
      buildPvPBattleFighterFromRankingEntry(right.entry, right.key),
    ] as const;
    if (!fighters[0] || !fighters[1]) {
      setError(
        "Complete move and battle-stat data is required for both Pokémon.",
      );
      return;
    }
    setSimulating(true);
    beginPerformance("pvp_battle_result_painted");
    setResult(null);
    setError("");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      setResult(
        simulatePvPBattleLocally({
          mechanics,
          fighters: [fighters[0], fighters[1]],
          shields,
          startingEnergy: energy,
          recordTimeline: true,
        }),
      );
      finishPerformance("pvp_battle_result_painted");
      setError("");
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "The battle could not be simulated.",
      );
    } finally {
      setSimulating(false);
    }
  };

  if (readyCandidates.length < 1 || readyOpponents.length < 1) {
    return (
      <View style={[styles.panel, light && styles.panelLight]}>
        <Text style={styles.eyebrow}>BATTLE LAB</Text>
        <Text style={[styles.heading, light && styles.textLight]}>
          Battle data unavailable
        </Text>
        <Text style={[styles.body, light && styles.mutedLight]}>
          This format snapshot needs complete fast-move, charged-move, and
          battle-stat data for at least two Pokémon.
        </Text>
      </View>
    );
  }

  const keyEvents =
    result?.timeline
      .filter(
        (event) => event.kind === "charged" || event.shielded || event.buffed,
      )
      .slice(0, 12) ?? [];
  const winner =
    result?.winner === 0 ? left : result?.winner === 1 ? right : null;
  const canSwap =
    left != null &&
    right != null &&
    readyCandidates.some((candidate) => candidate.key === right.key) &&
    readyOpponents.some((candidate) => candidate.key === left.key);

  const swapSelections = () => {
    if (!canSwap || !left || !right) return;
    beginPerformance("pvp_battle_selection_result_painted");
    setLeftId(right.key);
    setRightId(left.key);
    setResult(null);
    setError("");
  };

  return (
    <>
      <View style={styles.labHeader}>
        <View style={styles.labTitleRow}>
          <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="flask" size={20} />
          <Text style={[styles.labTitle, light && styles.textLight]}>Battle Lab</Text>
        </View>
        <Text style={[styles.labMeta, light && styles.mutedLight]}>
          {formatLabel} · {mode === "team" ? "switch-aware 3v3" : "focused 1v1"} · {pvpBattleMechanicsLabel(mechanics)}
        </Text>
      </View>
      <View accessibilityLabel="Battle Lab mode" style={[styles.mode, light && styles.panelLight]}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === "single" }} onPress={() => { beginPerformance("pvp_battle_mode_result_painted"); setMode("single"); setResult(null); setError(""); }} style={[styles.modeButton, mode === "single" && styles.modeButtonActive]}><View style={styles.iconLabelRow}><NativeUiIcon color={mode === "single" ? '#071313' : light ? '#071d20' : '#f5ffff'} name="flask" size={14} /><Text style={[styles.modeText, light && styles.textLight, mode === "single" && styles.modeTextActive]}>Focused 1v1</Text></View></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === "team" }} onPress={() => { beginPerformance("pvp_battle_mode_result_painted"); setMode("team"); setResult(null); setError(""); }} style={[styles.modeButton, mode === "team" && styles.modeButtonActive]}><View style={styles.iconLabelRow}><NativeUiIcon color={mode === "team" ? '#071313' : light ? '#071d20' : '#f5ffff'} name="trainers" size={14} /><Text style={[styles.modeText, light && styles.textLight, mode === "team" && styles.modeTextActive]}>Team battle</Text></View></Pressable>
      </View>
      {mode === "single" ? (
        <>
      <View style={[styles.panel, light && styles.panelLight]}>
        <Text style={styles.eyebrow}>BATTLE LAB</Text>
        <Text style={[styles.heading, light && styles.textLight]}>
          Simulate a focused matchup
        </Text>
        <Text style={[styles.body, light && styles.mutedLight]}>
          Set shields and starting energy, then run the canonical deterministic
          Battle Lab mechanics directly on this device.
        </Text>

        <Text style={[styles.sectionTitle, light && styles.textLight]}>
          {playerSideLabel}
        </Text>
        <View style={[styles.searchWrap, light && styles.inputLight]}><NativeUiIcon color={light ? '#4c7073' : '#9db6b8'} name="search" size={17} /><TextInput accessibilityLabel={`Find ${playerSideLabel} Pokemon`} onChangeText={(value) => { beginPerformance("pvp_battle_picker_search_result_painted"); setLeftQuery(value); }} placeholder="Find a Pokémon" placeholderTextColor="#78868e" style={[styles.searchInput, light && styles.textLight]} value={leftQuery} /></View>
        <ScrollView
          contentContainerStyle={styles.pickerRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {visibleLeft.map((candidate) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose ${candidate.nickname || candidate.entry.name} for ${playerSideLabel}`}
              key={candidate.key}
              onPress={() => selectEntry(0, candidate)}
              style={[
                styles.picker,
                light && styles.controlLight,
                left.key === candidate.key && styles.pickerActive,
              ]}
            >
              <Image fadeDuration={0}
                resizeMode="contain"
                source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }}
                style={styles.pickerImage}
              />
              <Text numberOfLines={2} style={[styles.pickerName, light && styles.textLight]}>
                {candidate.nickname || candidate.entry.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          accessibilityLabel="Swap battle sides"
          accessibilityRole="button"
          disabled={!canSwap}
          onPress={swapSelections}
          style={[styles.swap, light && styles.controlLight, !canSwap && styles.disabled]}
        >
          <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trade" size={17} />
        </Pressable>

        <Text style={[styles.sectionTitle, light && styles.textLight]}>
          Opponent
        </Text>
        <View style={[styles.searchWrap, light && styles.inputLight]}><NativeUiIcon color={light ? '#4c7073' : '#9db6b8'} name="search" size={17} /><TextInput accessibilityLabel="Find Opponent Pokemon" onChangeText={(value) => { beginPerformance("pvp_battle_picker_search_result_painted"); setRightQuery(value); }} placeholder="Find a Pokémon" placeholderTextColor="#78868e" style={[styles.searchInput, light && styles.textLight]} value={rightQuery} /></View>
        <ScrollView
          contentContainerStyle={styles.pickerRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {visibleRight.map((candidate) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose ${candidate.nickname || candidate.entry.name} as opponent`}
              key={candidate.key}
              onPress={() => selectEntry(1, candidate)}
              style={[
                styles.picker,
                light && styles.controlLight,
                right.key === candidate.key && styles.pickerActive,
              ]}
            >
              <Image fadeDuration={0}
                resizeMode="contain"
                source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }}
                style={styles.pickerImage}
              />
              <Text numberOfLines={2} style={[styles.pickerName, light && styles.textLight]}>
                {candidate.nickname || candidate.entry.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.battlePair}>
          {(
            [
              [playerSideLabel, left],
              ["Opponent", right],
            ] as const
          ).map(([label, entry]) => (
            <View
              key={label}
              style={[styles.battleSide, light && styles.controlLight]}
            >
              <Image fadeDuration={0}
                resizeMode="contain"
                source={{ uri: assetUri(assetBaseUrl, entry.entry.imageUrl) }}
                style={styles.battleImage}
              />
              <View style={styles.battleSideCopy}>
                <Text style={styles.eyebrow}>{label.toUpperCase()}</Text>
                <Text
                  numberOfLines={2}
                  style={[styles.pokemonName, light && styles.textLight]}
                >
                  {entry.nickname || entry.entry.name}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.moves, light && styles.mutedLight]}
                >
                  {entry.entry.moveset.map((move) => move.name).join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {([0, 1] as const).map((side) => (
          <View key={side} style={styles.conditions}>
            <View style={[styles.conditionPanel, light && styles.conditionsLight]}>
              <View style={styles.conditionHeading}>
                <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="shield" size={14} />
                <Text style={[styles.conditionTitle, light && styles.accentLight]}>
                  {side === 0 ? playerSideLabel : "Opponent"} shields
                </Text>
              </View>
              <View style={styles.shieldChoices}>
              {[0, 1, 2].map((value) => (
                <Choice
                  accessibilityLabel={`${side === 0 ? playerSideLabel : "Opponent"} shields ${value}`}
                  active={shields[side] === value}
                  key={value}
                  label={String(value)}
                  light={light}
                  onPress={() => setPairValue(setShields, side, value)}
                />
              ))}
              </View>
            </View>
            <View style={[styles.conditionPanel, light && styles.conditionsLight]}>
              <View style={styles.conditionHeading}>
                <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="bolt" size={14} />
                <Text style={[styles.conditionTitle, light && styles.accentLight]}>
                  {side === 0 ? playerSideLabel : "Opponent"} energy
                </Text>
                <Text style={[styles.conditionValue, light && styles.textLight]}>{energy[side]}</Text>
              </View>
              <Slider
                accessibilityLabel={`${side === 0 ? playerSideLabel : "Opponent"} energy`}
                maximumTrackTintColor={light ? "#cbd8dc" : "#344149"}
                maximumValue={100}
                minimumTrackTintColor="#42d5c2"
                minimumValue={0}
                onSlidingStart={() => beginPerformance("pvp_battle_condition_result_painted")}
                onValueChange={(value) => {
                  setEnergy((current) => side === 0 ? [value, current[1]] : [current[0], value]);
                  setResult(null);
                  setError("");
                }}
                step={5}
                style={styles.energySlider}
                thumbTintColor="#42d5c2"
                value={energy[side]}
              />
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Run battle"
          disabled={simulating}
          onPress={() => void simulate()}
          style={[styles.primary, simulating && styles.disabled]}
        >
          {!simulating ? <NativeUiIcon color="#071313" name="play" size={16} /> : null}
          <Text style={styles.primaryText}>{simulating ? 'Simulating…' : 'Run battle'}</Text>
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>

      {result ? (
        <View
          accessibilityLiveRegion="polite"
          onLayout={(event) => onResultLayout?.(event.nativeEvent.layout.y)}
          style={[styles.result, light && styles.panelLight]}
        >
          <View style={styles.resultHeader}>
            <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="flask" size={20} />
            <View style={styles.resultHeadingCopy}>
              <Text style={[styles.resultEyebrow, light && styles.accentLight]}>Simulated result</Text>
              <Text style={[styles.winner, light && styles.textLight]}>
                {winner ? `${winner.nickname || winner.entry.name} wins` : "Battle ends in a draw"}
              </Text>
            </View>
            <Text style={[styles.resultTime, light && styles.accentLight]}>
              {(result.timeMs / 1000).toFixed(1)}s
            </Text>
          </View>
          <ResultSide assetBaseUrl={assetBaseUrl} candidate={left} entry={left.entry} index={0} light={light} result={result} />
          <ResultSide assetBaseUrl={assetBaseUrl} candidate={right} entry={right.entry} index={1} light={light} result={result} />
          {keyEvents.length ? (
            <View style={styles.timeline}>
              <Text style={[styles.timelineTitle, light && styles.accentLight]}>BATTLE FLOW</Text>
              {keyEvents.map((event, index) => (
                <View
                  key={`${event.turn}-${event.actor}-${index}`}
                  style={[styles.timelineEvent, light && styles.timelineEventLight]}
                >
                  <Text style={[styles.timelineTime, light && styles.accentLight]}>{(event.turn * 0.5).toFixed(1)}s</Text>
                  <View style={styles.timelineCopy}>
                    <Text style={[styles.timelineMove, light && styles.textLight]}><Text style={styles.timelineActor}>{event.actor === 0 ? (left.nickname || left.entry.name) : (right.nickname || right.entry.name)}</Text> used {event.moveId}</Text>
                    <Text style={[styles.timelineDetail, light && styles.mutedLight]}>{event.shielded ? "Shielded" : `${event.damage} damage`}{event.buffed ? " · stat change" : ""}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

        </>
      ) : (
        <NativePvpTeamBattle
          assetBaseUrl={assetBaseUrl}
          candidates={readyCandidates}
          initialLeftKeys={initialSelection?.leftTeamKeys}
          initialRightKeys={initialSelection?.rightTeamKeys}
          light={light}
          mechanics={mechanics}
          opponentCandidates={readyOpponents}
          onResultLayout={onResultLayout}
          playerSideLabel={playerSideLabel}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  labHeader: { gap: 3, paddingHorizontal: 2, paddingTop: 2 },
  labTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  labIcon: { color: "#42d5c2", fontSize: 19 },
  labTitle: { color: "#f5ffff", fontSize: 17, fontWeight: "900" },
  labMeta: { color: "#9db6b8", fontSize: 9, lineHeight: 13 },
  mode: { flexDirection: "row", gap: 5, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 7, padding: 4, backgroundColor: "#101516" },
  modeButton: { minHeight: 41, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 5 },
  modeButtonActive: { backgroundColor: "#42d5c2" },
  modeText: { color: "#9db6b8", fontSize: 10, fontWeight: "900" },
  modeTextActive: { color: "#071313" },
  panel: {
    gap: 10,
  },
  panelLight: { borderColor: "#b2d2d2", backgroundColor: "#fff" },
  controlLight: { borderColor: "#bdc9cf", backgroundColor: "#fff" },
  textLight: { color: "#14232a" },
  mutedLight: { color: "#5d6e76" },
  accentLight: { color: "#08766b" },
  eyebrow: {
    color: "#299cf5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  heading: { color: "#fff", fontSize: 18, fontWeight: "900" },
  body: { color: "#a8b5bc", fontSize: 11, lineHeight: 16 },
  battlePair: { gap: 7 },
  battleSide: {
    minWidth: 0,
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#151a1b",
  },
  battleImage: { width: 64, height: 64 },
  battleSideCopy: { minWidth: 0, flex: 1 },
  pokemonName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  moves: {
    marginTop: 3,
    color: "#99a7ae",
    fontSize: 8.5,
    lineHeight: 12,
  },
  conditions: { gap: 7 },
  conditionPanel: {
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  conditionsLight: { borderColor: "#d0d9de", backgroundColor: "#f6f9fa" },
  conditionHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  conditionTitle: { color: "#8fc6cb", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  conditionValue: { marginLeft: "auto", color: "#f5ffff", fontSize: 10, fontWeight: "900" },
  shieldChoices: { flexDirection: "row", gap: 5 },
  conditionLabel: {
    color: "#8fc6cb",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  energySlider: { minWidth: 0, flex: 1, height: 36 },
  choice: {
    minWidth: 0,
    minHeight: 36,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 4,
    paddingHorizontal: 7,
    backgroundColor: "#1a2227",
  },
  choiceActive: { borderColor: "#299cf5", backgroundColor: "#123c61" },
  choiceText: { color: "#aab6bc", fontSize: 10, fontWeight: "900" },
  choiceTextActive: { color: "#fff" },
  primary: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#42d5c2",
    borderRadius: 7,
    backgroundColor: "#42d5c2",
  },
  primaryText: { color: "#071313", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  error: {
    color: "#ff9bad",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  result: {
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.5)",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#101516",
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultHeadingCopy: { minWidth: 0, flex: 1 },
  resultEyebrow: { color: "#8fc6cb", fontSize: 9, fontWeight: "800" },
  winner: { color: "#fff", fontSize: 18, fontWeight: "900" },
  resultTime: { color: "#42d5c2", fontSize: 15, fontWeight: "900" },
  resultSide: { minHeight: 69, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 6, padding: 8, backgroundColor: "#151a1b" },
  resultPokemonImage: { width: 47, height: 47 },
  resultSideCopy: { minWidth: 0, flex: 1, gap: 3 },
  resultName: { color: "#fff", fontSize: 12, fontWeight: "900" },
  hpTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#344149",
  },
  hpTrackLight: { backgroundColor: "#d5dee2" },
  hpFill: { height: "100%", borderRadius: 999, backgroundColor: "#42cc9f" },
  resultMeta: { color: "#9daab1", fontSize: 9 },
  resultStat: { minWidth: 42, alignItems: "center" },
  resultStatValue: { color: "#299cf5", fontSize: 11, fontWeight: "900" },
  resultStatLabel: { color: "#9daab1", fontSize: 7.5, textTransform: "uppercase" },
  timeline: {
    gap: 6,
    marginTop: 3,
    borderTopWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    paddingTop: 9,
  },
  timelineTitle: { color: "#8fc6cb", fontSize: 10, fontWeight: "900" },
  timelineEvent: { minWidth: 0, flexDirection: "row", gap: 7, borderLeftWidth: 2, borderColor: "#54a9ef", paddingHorizontal: 7, paddingVertical: 6, backgroundColor: "rgba(84,169,239,0.05)" },
  timelineEventLight: { backgroundColor: "#f5fbff" },
  timelineTime: { width: 42, color: "#42d5c2", fontSize: 9, fontWeight: "900" },
  timelineCopy: { minWidth: 0, flex: 1, gap: 2 },
  timelineMove: { color: "#f5ffff", fontSize: 9 },
  timelineActor: { fontWeight: "900" },
  timelineDetail: { color: "#9daab1", fontSize: 8, fontWeight: "800" },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  swap: { width: 44, minHeight: 40, alignSelf: "center", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, backgroundColor: "#101516" },
  searchWrap: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 11, backgroundColor: "#101516" },
  inputLight: { borderColor: "#8dc3c3", backgroundColor: "#fbffff" },
  searchInput: { minWidth: 0, flex: 1, minHeight: 41, color: "#f5ffff", fontSize: 12 },
  pickerRail: { gap: 7, paddingVertical: 7 },
  picker: {
    width: 94,
    minHeight: 108,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 10,
    padding: 7,
    backgroundColor: "#151b20",
  },
  pickerActive: { borderColor: "#42cc9f", backgroundColor: "#123c31" },
  pickerImage: { width: 66, height: 66 },
  pickerName: {
    minHeight: 28,
    color: "#fff",
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
  },
});
