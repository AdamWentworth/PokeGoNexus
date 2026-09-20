import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import type {
  PokemonPvPBattleFighter,
  PokemonPvPBattleMechanics,
} from "@pokemongonexus/shared-contracts/pokemon";
import {
  buildPvPBattleFighterFromRankingEntry,
  simulatePvPTeamBattleLocally,
  simulatePvPTeamGauntletLocally,
} from "@pokemongonexus/shared-domain/pvp-battle";
import type {
  PvPTeamBattleResponse,
  PvPTeamGauntletResponse,
  PvPTeamSwitchPolicy,
} from "@pokemongonexus/shared-domain/pvp-battle-protocol";
import {
  buildRepresentativePvPMetaTeams,
  type PvPTeamCandidate,
} from "@pokemongonexus/app-core/pvp-team-builder";
import { NativeUiIcon, type NativeUiIconName } from "../NativeUiIcon";
import { markNativeUiPerformanceAfterPaint } from "../../observability/nativeUiInteractionTiming";

type TeamKeys = [string, string, string];
type Props = {
  assetBaseUrl: string;
  candidates: PvPTeamCandidate[];
  initialLeftKeys?: string[];
  initialRightKeys?: string[];
  light: boolean;
  mechanics: PokemonPvPBattleMechanics;
  opponentCandidates: PvPTeamCandidate[];
  onResultLayout?: (offsetY: number) => void;
  playerSideLabel: string;
};
const ROLES = ["Lead", "Safe Swap", "Closer"] as const;

const assetUri = (base: string, value: string): string | undefined => {
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
};

const initialTeam = (
  candidates: PvPTeamCandidate[],
  preferred: string[] | undefined,
  offset: number,
): TeamKeys => {
  const available = new Set(candidates.map((candidate) => candidate.key));
  const keys = (preferred ?? []).filter((key, index, values) => available.has(key) && values.indexOf(key) === index).slice(0, 3);
  for (let index = 0; keys.length < 3 && index < candidates.length; index += 1) {
    const candidate = candidates[(index + offset) % candidates.length];
    if (candidate && !keys.includes(candidate.key)) keys.push(candidate.key);
  }
  while (keys.length < 3) keys.push("");
  return keys as TeamKeys;
};

const toFighter = (
  candidate: PvPTeamCandidate | undefined,
): PokemonPvPBattleFighter | null =>
  candidate ? buildPvPBattleFighterFromRankingEntry(candidate.entry, candidate.key) : null;

const Choice = ({
  accessibilityLabel,
  active,
  icon,
  label,
  light,
  onPress,
}: {
  accessibilityLabel?: string;
  active: boolean;
  icon?: NativeUiIconName;
  label: string;
  light: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[styles.choice, light && styles.controlLight, active && styles.choiceActive]}
  >
    <View style={styles.choiceContent}>
      {icon ? <NativeUiIcon color={active ? '#071313' : light ? '#071d20' : '#f5ffff'} name={icon} size={13} /> : null}
      <Text style={[styles.choiceText, light && styles.textLight, active && styles.choiceTextActive]}>{label}</Text>
    </View>
  </Pressable>
);

export const NativePvpTeamBattle = ({
  assetBaseUrl,
  candidates,
  initialLeftKeys,
  initialRightKeys,
  light,
  mechanics,
  opponentCandidates,
  onResultLayout,
  playerSideLabel,
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
  const ready = useMemo(
    () => candidates.filter((candidate) => toFighter(candidate) != null),
    [candidates],
  );
  const readyOpponents = useMemo(
    () => opponentCandidates.filter((candidate) => toFighter(candidate) != null),
    [opponentCandidates],
  );
  const candidateByKey = useMemo(() => new Map(ready.map((candidate) => [candidate.key, candidate])), [ready]);
  const opponentByKey = useMemo(() => new Map(readyOpponents.map((candidate) => [candidate.key, candidate])), [readyOpponents]);
  const [teams, setTeams] = useState<[TeamKeys, TeamKeys]>(() => [
    initialTeam(ready, initialLeftKeys, 0),
    initialTeam(readyOpponents, initialRightKeys, Math.min(1, Math.max(0, readyOpponents.length - 1))),
  ]);
  const [activeSide, setActiveSide] = useState<0 | 1>(0);
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [policy, setPolicy] = useState<PvPTeamSwitchPolicy>("adaptive");
  const [shields, setShields] = useState<[number, number]>([2, 2]);
  const [energy, setEnergy] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<PvPTeamBattleResponse | null>(null);
  const [gauntlet, setGauntlet] = useState<PvPTeamGauntletResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"battle" | "field" | null>(null);
  const normalized = deferredQuery.trim().toLocaleLowerCase();
  const activeCandidates = activeSide === 0 ? ready : readyOpponents;
  const unavailable = useMemo(
    () => new Set(teams[activeSide].filter((_, index) => index !== activeSlot)),
    [activeSide, activeSlot, teams],
  );
  const choices = useMemo(() => activeCandidates
    .filter((candidate) =>
      (!unavailable.has(candidate.key) || teams[activeSide][activeSlot] === candidate.key) &&
      (!normalized || [
        candidate.entry.name,
        candidate.nickname ?? "",
        candidate.entry.speciesId,
        ...candidate.entry.types,
        ...candidate.entry.moveset.map((move) => move.name),
      ].join(" ").toLocaleLowerCase().includes(normalized)),
    ).slice(0, 40), [activeCandidates, activeSide, activeSlot, normalized, teams, unavailable]);
  const selectedTeams = useMemo(
    () => [teams[0].map((key) => candidateByKey.get(key)), teams[1].map((key) => opponentByKey.get(key))] as const,
    [candidateByKey, opponentByKey, teams],
  );
  const complete = selectedTeams.every((team) =>
    team.length === 3 && team.every(Boolean) && new Set(team.map((candidate) => candidate?.key)).size === 3,
  );
  useEffect(() => finishPerformance("pvp_team_battle_selection_result_painted"), [finishPerformance, teams]);
  useEffect(() => finishPerformance("pvp_team_battle_policy_result_painted"), [finishPerformance, policy]);
  useEffect(() => finishPerformance("pvp_team_battle_condition_result_painted"), [energy, finishPerformance, shields]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance("pvp_team_battle_search_result_painted");
  }, [choices, deferredQuery, finishPerformance, query]);

  const changeTeamMember = (candidate: PvPTeamCandidate) => {
    beginPerformance("pvp_team_battle_selection_result_painted");
    setTeams((current) => {
      const next: [TeamKeys, TeamKeys] = [
        [...current[0]] as TeamKeys,
        [...current[1]] as TeamKeys,
      ];
      next[activeSide][activeSlot] = candidate.key;
      return next;
    });
    setResult(null);
    setGauntlet(null);
    setError("");
  };

  const changePair = (
    setter: React.Dispatch<React.SetStateAction<[number, number]>>,
    side: 0 | 1,
    value: number,
  ) => {
    beginPerformance("pvp_team_battle_condition_result_painted");
    setter((current) => side === 0 ? [value, current[1]] : [current[0], value]);
    setResult(null);
    setGauntlet(null);
  };

  const buildTeams = (): [
    [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
    [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
  ] | null => {
    const fighters = selectedTeams.map((team) => team.map(toFighter));
    if (fighters.some((team) => team.some((fighter) => fighter == null))) return null;
    return fighters as [
      [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
      [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
    ];
  };

  const simulate = async () => {
    const fighters = buildTeams();
    if (!fighters) {
      setError("Team Battle needs three unique, battle-ready Pokémon on each side.");
      return;
    }
    setBusy("battle");
    beginPerformance("pvp_team_battle_result_painted");
    setResult(null);
    setGauntlet(null);
    setError("");
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      setResult(simulatePvPTeamBattleLocally({
        kind: "team-battle",
        mechanics,
        teams: fighters,
        shields,
        startingEnergy: energy,
        switchPolicy: policy,
      }));
      finishPerformance("pvp_team_battle_result_painted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The team battle could not be simulated.");
    } finally {
      setBusy(null);
    }
  };

  const representativeTeams = useMemo(() => {
    return buildRepresentativePvPMetaTeams(readyOpponents, 6).flatMap((row) => {
      const fighters = row.members.map(toFighter);
      return fighters.every(Boolean) ? [{
        id: row.id,
        label: row.label,
        members: row.members,
        team: fighters as [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
      }] : [];
    });
  }, [readyOpponents]);

  const runField = async () => {
    const fighters = buildTeams();
    if (!fighters || !representativeTeams.length) {
      setError("The meta field needs a complete team and at least one representative lineup.");
      return;
    }
    setBusy("field");
    beginPerformance("pvp_team_field_result_painted");
    setGauntlet(null);
    setError("");
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      setGauntlet(simulatePvPTeamGauntletLocally({
        kind: "team-gauntlet",
        mechanics,
        team: fighters[0],
        opponents: representativeTeams,
        shields: shields[0],
        switchPolicy: policy,
      }));
      finishPerformance("pvp_team_field_result_painted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The meta team check could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  const resultCandidateByFighterId = new Map(
    selectedTeams.flatMap((team) => team.filter((candidate): candidate is PvPTeamCandidate => candidate != null))
      .map((candidate) => [candidate.key, candidate]),
  );
  const firstMatchup = result?.matchups[0];
  const resultWinnerLabel = result?.winner === 0
    ? playerSideLabel
    : result?.winner === 1 ? "Opponent" : null;
  const resultSummary = !result
    ? ""
    : result.winner < 0
      ? "Neither lineup finished the other."
      : firstMatchup?.winner === result.winner
        ? `${resultWinnerLabel} held its lead advantage through the lineup.`
        : (firstMatchup?.winner ?? -1) >= 0
          ? `${resultWinnerLabel} recovered after losing the opening matchup.`
          : `${resultWinnerLabel} won through its back-line depth.`;
  const resultSequence = result
    ? [
        ...result.matchups.map((matchup) => ({ kind: "matchup" as const, atMs: matchup.endedAtMs, matchup })),
        ...result.switches.map((event) => ({ kind: "switch" as const, atMs: event.atMs, event })),
      ].sort((left, right) => left.atMs - right.atMs || (left.kind === "matchup" ? -1 : 1))
    : [];
  const representativeTeamById = new Map(representativeTeams.map((team) => [team.id, team]));

  return (
    <View style={styles.root}>
      <View style={styles.lineups}>
        {([0, 1] as const).map((side) => (
          <View key={side} style={[styles.lineup, light && styles.panelLight]}>
            <View style={styles.lineupHeader}>
              <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trainers" size={18} />
              <View>
                <Text style={[styles.lineupTitle, light && styles.textLight]}>{side === 0 ? playerSideLabel : "Opponent"}</Text>
                <Text style={[styles.meta, light && styles.mutedLight]}>Lead, Safe Swap, and Closer</Text>
              </View>
            </View>
            <View style={styles.slots}>
              {ROLES.map((role, index) => {
                const candidate = selectedTeams[side][index];
                const label = candidate ? (candidate.nickname || candidate.entry.name) : "";
                const active = activeSide === side && activeSlot === index;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${side === 0 ? playerSideLabel : "Opponent"} ${role}${candidate ? `: ${label}` : ""}`}
                    accessibilityState={{ selected: active }}
                    key={role}
                    onPress={() => { setActiveSide(side); setActiveSlot(index); }}
                    style={[styles.slot, light && styles.controlLight, active && styles.slotActive]}
                  >
                    <Text style={[styles.role, light && styles.accentLight]}>{role}</Text>
                    {candidate ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.slotImage} /> : null}
                    <Text numberOfLines={2} style={[styles.slotName, light && styles.textLight]}>{label || "Choose"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.policy, light && styles.panelLight]}>
        <View style={styles.lineupHeader}>
          <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="clock" size={18} />
          <View>
            <Text style={[styles.lineupTitle, light && styles.textLight]}>Switching</Text>
            <Text style={[styles.meta, light && styles.mutedLight]}>Current 45-second battle clock</Text>
          </View>
        </View>
        <View style={styles.policyChoices}>
          <Choice active={policy === "adaptive"} icon="trade" label="Adaptive" light={light} onPress={() => { beginPerformance("pvp_team_battle_policy_result_painted"); setPolicy("adaptive"); setResult(null); }} />
          <Choice active={policy === "fixed"} icon="trainers" label="Fixed order" light={light} onPress={() => { beginPerformance("pvp_team_battle_policy_result_painted"); setPolicy("fixed"); setResult(null); }} />
        </View>
        <Text style={[styles.meta, light && styles.mutedLight]}>{policy === "adaptive" ? "Escape clear losses and counter-switch." : "Lead, Safe Swap, then Closer."}</Text>
      </View>

      {([0, 1] as const).map((side) => (
        <View key={side} style={[styles.conditions, light && styles.panelLight]}>
          <Text style={[styles.lineupTitle, light && styles.textLight]}>{side === 0 ? `${playerSideLabel} conditions` : "Opponent conditions"}</Text>
          <View style={styles.conditionRow}>
            <Text style={[styles.conditionLabel, light && styles.mutedLight]}>Shields</Text>
            {[0, 1, 2].map((value) => <Choice accessibilityLabel={`${side === 0 ? playerSideLabel : "Opponent"} shields ${value}`} active={shields[side] === value} key={value} label={String(value)} light={light} onPress={() => changePair(setShields, side, value)} />)}
          </View>
          <View style={styles.conditionRow}>
            <Text style={[styles.conditionLabel, styles.energyLabel, light && styles.mutedLight]}>Lead energy {energy[side]}</Text>
            <Slider
              accessibilityLabel={`${side === 0 ? playerSideLabel : "Opponent"} lead energy`}
              maximumTrackTintColor={light ? "#cbd8dc" : "#344149"}
              maximumValue={100}
              minimumTrackTintColor="#42d5c2"
              minimumValue={0}
              onSlidingStart={() => beginPerformance("pvp_team_battle_condition_result_painted")}
              onValueChange={(value) => {
                setEnergy((current) => side === 0 ? [value, current[1]] : [current[0], value]);
                setResult(null);
                setGauntlet(null);
              }}
              step={5}
              style={styles.energySlider}
              thumbTintColor="#42d5c2"
              value={energy[side]}
            />
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Run team battle" disabled={!complete || busy != null} onPress={() => void simulate()} style={[styles.primary, (!complete || busy != null) && styles.disabled]}>
          {busy !== "battle" ? <NativeUiIcon color="#071313" name="play" size={13} /> : null}
          <Text style={styles.primaryText}>{busy === "battle" ? "Simulating team…" : "Run team battle"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Test meta teams" disabled={!complete || !representativeTeams.length || busy != null} onPress={() => void runField()} style={[styles.secondary, light && styles.secondaryLight, (!complete || !representativeTeams.length || busy != null) && styles.disabled]}>
          <View style={styles.actionLabel}><NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trophy" size={14} /><Text style={[styles.secondaryText, light && styles.accentLight]}>{busy === "field" ? "Testing field…" : `Test ${representativeTeams.length} meta teams`}</Text></View>
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!complete && !error ? <Text style={[styles.status, light && styles.mutedLight]}>Team Battle needs three unique, battle-ready Pokémon on each side.</Text> : null}

      {result ? (
        <View accessibilityLiveRegion="polite" onLayout={(event) => onResultLayout?.(event.nativeEvent.layout.y)} style={[styles.result, light && styles.panelLight]}>
          <Text style={[styles.eyebrow, light && styles.accentLight]}>{result.switchPolicy === "adaptive" ? "SWITCH-AWARE 3V3 RESULT" : "FIXED-ORDER 3V3 RESULT"}</Text>
          <Text style={[styles.resultTitle, light && styles.textLight]}>{result.winner < 0 ? "Team battle ends in a draw" : result.winner === 0 ? `${playerSideLabel} wins` : "Opponent wins"}</Text>
          <Text style={[styles.resultSummary, light && styles.mutedLight]}>{resultSummary}</Text>
          <Text style={[styles.resultTime, light && styles.accentLight]}>{(result.timeMs / 1000).toFixed(1)}s</Text>
          <View style={styles.resultOverview}>
            {([0, 1] as const).map((side) => <View key={side} style={[styles.overviewItem, light && styles.controlLight]}><Text style={[styles.meta, light && styles.mutedLight]}>{side === 0 ? playerSideLabel : "Opponent"}</Text><Text style={[styles.overviewValue, light && styles.textLight]}>{result.teams[side].filter((member) => !member.fainted).length} standing</Text><Text style={[styles.meta, light && styles.mutedLight]}>{result.shields[side]} shields left</Text></View>)}
            {result.switchPolicy === "adaptive" ? <View style={[styles.overviewItem, light && styles.controlLight]}><Text style={[styles.meta, light && styles.mutedLight]}>Battle switching</Text><Text style={[styles.overviewValue, light && styles.textLight]}>{result.switches.filter((event) => event.reason === "adaptive").length} adaptive</Text><Text style={[styles.meta, light && styles.mutedLight]}>{result.switchClockMs / 1000}s clock</Text></View> : null}
          </View>
          {([0, 1] as const).map((side) => (
            <View key={side} style={styles.resultTeam}>
              <Text style={[styles.lineupTitle, light && styles.textLight]}>{side === 0 ? playerSideLabel : "Opponent"} · {result.teams[side].filter((member) => !member.fainted).length} standing</Text>
              {result.teams[side].map((member, index) => {
                const candidate = selectedTeams[side][index];
                const hp = member.maxHp ? Math.max(0, (member.hp / member.maxHp) * 100) : 0;
                return (
                  <View key={member.fighterId} style={[styles.resultMember, light && styles.controlLight, member.fainted && styles.fainted]}>
                    {candidate ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.resultImage} /> : null}
                    <View style={styles.resultCopy}>
                      <Text style={[styles.resultName, light && styles.textLight]}>{candidate ? (candidate.nickname || candidate.entry.name) : ROLES[index]}</Text>
                      <View style={[styles.hpTrack, light && styles.hpTrackLight]}><View style={[styles.hpFill, { width: `${hp}%` }]} /></View>
                      <Text style={[styles.meta, light && styles.mutedLight]}>{member.hp}/{member.maxHp} HP · {member.energy} energy · {member.knockouts} KOs</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={[styles.sequence, light && styles.controlLight]}>
            <Text style={[styles.lineupTitle, light && styles.textLight]}>Battle sequence</Text>
            {resultSequence.map((item) => {
              if (item.kind === "switch") {
                const from = resultCandidateByFighterId.get(item.event.fromFighterId);
                const to = resultCandidateByFighterId.get(item.event.toFighterId);
                return <View key={`switch-${item.event.index}-${item.event.side}`} style={[styles.sequenceRow, styles.sequenceSwitch]}><NativeUiIcon color="#f2ca58" name="trade" size={14} /><View style={styles.sequenceCopy}><Text style={[styles.sequenceTitle, light && styles.textLight]}>{item.event.reason === "adaptive" ? `${item.event.side === 0 ? playerSideLabel : "Opponent"} swaps ${from ? (from.nickname || from.entry.name) : "out"} for ${to ? (to.nickname || to.entry.name) : "its bench"}` : `${item.event.side === 0 ? playerSideLabel : "Opponent"} sends in ${to ? (to.nickname || to.entry.name) : "its next Pokémon"}`}</Text><Text style={[styles.meta, light && styles.mutedLight]}>{(item.event.atMs / 1000).toFixed(1)}s · {item.event.reason === "adaptive" ? `switch ready again at ${(item.event.switchReadyAtMs / 1000).toFixed(1)}s` : "forced replacement"}</Text></View></View>;
              }
              const first = resultCandidateByFighterId.get(item.matchup.fighterIds[0]);
              const second = resultCandidateByFighterId.get(item.matchup.fighterIds[1]);
              const winner = item.matchup.winner < 0 ? null : item.matchup.winner === 0 ? first : second;
              const loser = item.matchup.winner < 0 ? null : item.matchup.winner === 0 ? second : first;
              return <View key={`matchup-${item.matchup.index}-${item.matchup.fighterIds.join("-")}`} style={styles.sequenceRow}><Text style={styles.sequenceIndex}>{item.matchup.index + 1}</Text><View style={styles.sequenceCopy}><Text style={[styles.sequenceTitle, light && styles.textLight]}>{winner && loser ? `${winner.nickname || winner.entry.name} defeats ${loser.nickname || loser.entry.name}` : item.matchup.endedBy === "switch" ? `${first?.nickname || first?.entry.name || playerSideLabel} pressures ${second?.nickname || second?.entry.name || "Opponent"} into a decision` : `${first?.nickname || first?.entry.name || playerSideLabel} and ${second?.nickname || second?.entry.name || "Opponent"} draw`}</Text><Text style={[styles.meta, light && styles.mutedLight]}>{(item.matchup.startedAtMs / 1000).toFixed(1)}-{(item.matchup.endedAtMs / 1000).toFixed(1)}s · {item.matchup.shieldsAfter[0]}-{item.matchup.shieldsAfter[1]} shields</Text></View></View>;
            })}
          </View>
        </View>
      ) : null}

      {gauntlet ? (
        <View accessibilityLiveRegion="polite" style={[styles.result, light && styles.panelLight]}>
          <Text style={[styles.eyebrow, light && styles.accentLight]}>ROLE-BALANCED META FIELD</Text>
          <Text style={[styles.resultTitle, light && styles.textLight]}>{gauntlet.wins}-{gauntlet.losses}-{gauntlet.draws}</Text>
          <Text style={[styles.meta, light && styles.mutedLight]}>Wins, losses, and draws against current top role combinations.</Text>
          {gauntlet.results.map((row) => {
            const representative = representativeTeamById.get(row.opponentId);
            const won = row.result.winner === 0;
            const draw = row.result.winner < 0;
            const standing = row.result.teams[won ? 0 : 1].filter((member) => !member.fainted).length;
            const lead = row.result.matchups[0];
            const swaps = row.result.switches.filter((event) => event.reason === "adaptive").length;
            return <View key={row.opponentId} style={[styles.fieldRow, light && styles.controlLight, draw ? styles.fieldRowDraw : won ? styles.fieldRowWin : styles.fieldRowLoss]}><Text style={draw ? styles.draw : won ? styles.win : styles.loss}>{draw ? "–" : won ? "✓" : "×"}</Text><View style={styles.fieldImages}>{representative?.members.map((candidate) => <Image fadeDuration={0} key={candidate.key} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.fieldImage} />)}</View><View style={styles.fieldCopy}><Text style={[styles.fieldLabel, light && styles.textLight]}>{row.opponentLabel}</Text><Text style={[styles.meta, light && styles.mutedLight]}>{draw ? "Even result" : `${won ? "Clear" : "Loss"} · ${standing} standing`}{lead?.winner === 1 ? " · lost lead" : ""} · {swaps} swaps</Text></View></View>;
          })}
          <Text style={[styles.fieldFooter, light && styles.mutedLight]}>These are deterministic Lead, Switch, and Closer combinations generated from the current ranking snapshot, not claimed historical player teams.</Text>
        </View>
      ) : null}

      <View style={styles.pickerSection}>
        <Text style={[styles.eyebrow, light && styles.accentLight]}>CHOOSE {activeSide === 0 ? playerSideLabel.toLocaleUpperCase() : "OPPONENT"} {ROLES[activeSlot].toLocaleUpperCase()}</Text>
        <View style={[styles.search, light && styles.inputLight]}><NativeUiIcon color={light ? '#4c7073' : '#9db6b8'} name="search" size={18} /><TextInput accessibilityLabel="Search Team Battle Pokémon" onChangeText={(value) => { beginPerformance("pvp_team_battle_search_result_painted"); setQuery(value); }} placeholder="Find a Pokémon" placeholderTextColor="#78868e" style={[styles.searchInput, light && styles.textLight]} value={query} /></View>
        <View style={styles.candidateGrid}>
          {choices.map((candidate) => {
            const active = teams[activeSide][activeSlot] === candidate.key;
            const label = candidate.nickname || candidate.entry.name;
            return <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label} for ${activeSide === 0 ? playerSideLabel : "Opponent"} ${ROLES[activeSlot]}`} key={candidate.key} onPress={() => changeTeamMember(candidate)} style={[styles.candidate, light && styles.controlLight, active && styles.candidateActive]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.candidateImage} /><View style={styles.candidateCopy}><Text numberOfLines={1} style={[styles.candidateName, light && styles.textLight]}>{label}</Text><Text style={[styles.meta, light && styles.mutedLight]}>Level {candidate.entry.recommendedLevel}{candidate.cp != null ? ` · CP ${candidate.cp.toLocaleString()}` : ""}</Text></View><Text style={[styles.check, active && styles.checkActive]}>{active ? "✓" : "+"}</Text></Pressable>;
          })}
        </View>
      </View>
      <Text style={[styles.footer, light && styles.mutedLight]}>{policy === "adaptive" ? "The local model can escape clear losing matchups, counter-switch on a 45-second clock, and preserve benched Pokémon HP and energy." : "Fixed order keeps the selected Lead, Safe Swap, and Closer sequence while preserving shared shields, HP, and energy."}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 9 },
  lineups: { gap: 8 },
  lineup: { gap: 8, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 8, padding: 8, backgroundColor: "#151a1b" },
  panelLight: { borderColor: "#b2d2d2", backgroundColor: "#fff" },
  controlLight: { borderColor: "#bdc9cf", backgroundColor: "#fff" },
  lineupHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  lineupIcon: { color: "#42d5c2", fontSize: 18 },
  lineupTitle: { color: "#f5ffff", fontSize: 12, fontWeight: "900" },
  meta: { color: "#9db6b8", fontSize: 9, lineHeight: 13 },
  slots: { flexDirection: "row", gap: 5 },
  slot: { minWidth: 0, flex: 1, minHeight: 104, alignItems: "center", gap: 3, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 6, padding: 5, backgroundColor: "#101516" },
  slotActive: { borderColor: "#42d5c2", borderWidth: 2 },
  role: { color: "#8fc6cb", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  slotImage: { width: 54, height: 54 },
  slotName: { minHeight: 24, color: "#f5ffff", fontSize: 9, lineHeight: 12, fontWeight: "900", textAlign: "center" },
  policy: { gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 8, padding: 9, backgroundColor: "#151a1b" },
  policyChoices: { flexDirection: "row", gap: 6 },
  choice: { minWidth: 35, minHeight: 35, flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.4)", borderRadius: 7, paddingHorizontal: 5, backgroundColor: "#101516" },
  choiceContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  choiceActive: { borderColor: "#42d5c2", backgroundColor: "#42d5c2" },
  choiceText: { color: "#9db6b8", fontSize: 9, fontWeight: "900" },
  choiceTextActive: { color: "#071313" },
  conditions: { gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 8, padding: 8, backgroundColor: "#151a1b" },
  conditionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  conditionLabel: { width: 66, color: "#9db6b8", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  energyLabel: { width: 86 },
  energySlider: { minWidth: 0, flex: 1, height: 36 },
  actions: { flexDirection: "row", gap: 6 },
  actionLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  primary: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 7, backgroundColor: "#42d5c2" },
  primaryText: { color: "#071313", fontSize: 10, fontWeight: "900" },
  secondary: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 7, backgroundColor: "rgba(66,213,194,0.06)" },
  secondaryLight: { backgroundColor: "#f8ffff" },
  secondaryText: { color: "#42d5c2", fontSize: 9, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  error: { color: "#ff9ebd", fontSize: 10, lineHeight: 15, textAlign: "center" },
  status: { color: "#9db6b8", fontSize: 10, lineHeight: 15, textAlign: "center" },
  result: { gap: 8, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 8, padding: 10, backgroundColor: "#101516" },
  eyebrow: { color: "#8fc6cb", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  resultTitle: { color: "#f5ffff", fontSize: 19, fontWeight: "900" },
  resultSummary: { color: "#9db6b8", fontSize: 10, lineHeight: 15 },
  resultTime: { alignSelf: "flex-end", marginTop: -28, color: "#42d5c2", fontSize: 14, fontWeight: "900" },
  resultOverview: { flexDirection: "row", gap: 5 },
  overviewItem: { minWidth: 0, flex: 1, gap: 2, borderWidth: 1, borderColor: "rgba(115,204,204,0.2)", borderRadius: 6, padding: 6, backgroundColor: "#101516" },
  overviewValue: { color: "#f5ffff", fontSize: 10, fontWeight: "900" },
  resultTeam: { gap: 5, paddingTop: 5, borderTopWidth: 1, borderColor: "rgba(115,204,204,0.2)" },
  resultMember: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.2)", borderRadius: 6, padding: 6, backgroundColor: "#151a1b" },
  fainted: { opacity: 0.45 },
  resultImage: { width: 39, height: 39 },
  resultCopy: { minWidth: 0, flex: 1 },
  resultName: { color: "#f5ffff", fontSize: 10, fontWeight: "900" },
  hpTrack: { height: 6, marginVertical: 3, overflow: "hidden", borderRadius: 999, backgroundColor: "#344149" },
  hpTrackLight: { backgroundColor: "#d5dee2" },
  hpFill: { height: "100%", borderRadius: 999, backgroundColor: "#42d5c2" },
  sequence: { gap: 5, borderTopWidth: 1, borderColor: "rgba(115,204,204,0.28)", paddingTop: 8 },
  sequenceRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, borderLeftWidth: 2, borderColor: "#54a9ef", paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "rgba(84,169,239,0.05)" },
  sequenceSwitch: { borderColor: "#f2ca58", backgroundColor: "rgba(242,202,88,0.08)" },
  sequenceIndex: { width: 22, height: 22, paddingTop: 3, borderRadius: 999, color: "#071313", backgroundColor: "#42d5c2", fontSize: 9, fontWeight: "900", textAlign: "center", overflow: "hidden" },
  sequenceCopy: { minWidth: 0, flex: 1 },
  sequenceTitle: { color: "#f5ffff", fontSize: 9, lineHeight: 13, fontWeight: "800" },
  fieldRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderLeftWidth: 3, borderColor: "rgba(115,204,204,0.28)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#151a1b" },
  fieldRowWin: { borderLeftColor: "#42d5c2" },
  fieldRowLoss: { borderLeftColor: "#ed6f7d" },
  fieldRowDraw: { borderLeftColor: "#f2ca58" },
  fieldImages: { width: 66, flexDirection: "row" },
  fieldImage: { width: 28, height: 28, marginRight: -6 },
  fieldCopy: { minWidth: 0, flex: 1 },
  fieldLabel: { color: "#f5ffff", fontSize: 10, fontWeight: "800" },
  fieldFooter: { color: "#9db6b8", fontSize: 8.5, lineHeight: 13, textAlign: "center" },
  win: { color: "#42d5c2", fontSize: 17, fontWeight: "900" },
  loss: { color: "#ed6fa5", fontSize: 17, fontWeight: "900" },
  draw: { color: "#d5b46b", fontSize: 17, fontWeight: "900" },
  pickerSection: { gap: 7 },
  search: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 11, backgroundColor: "#101516" },
  inputLight: { borderColor: "#8dc3c3", backgroundColor: "#fbffff" },
  searchIcon: { color: "#9db6b8", fontSize: 21 },
  searchInput: { minWidth: 0, flex: 1, minHeight: 41, color: "#f5ffff", fontSize: 12 },
  candidateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  candidate: { width: "49.2%", minHeight: 60, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(115,204,204,0.2)", borderRadius: 6, padding: 5, backgroundColor: "#151a1b" },
  candidateActive: { borderColor: "#42d5c2", backgroundColor: "rgba(66,213,194,0.08)" },
  candidateImage: { width: 42, height: 42 },
  candidateCopy: { minWidth: 0, flex: 1 },
  candidateName: { color: "#f5ffff", fontSize: 9, fontWeight: "900" },
  check: { width: 27, height: 27, color: "#9db6b8", fontSize: 18, fontWeight: "900", textAlign: "center" },
  checkActive: { color: "#42d5c2" },
  footer: { color: "#9db6b8", fontSize: 9, lineHeight: 14, textAlign: "center" },
  textLight: { color: "#071d20" },
  mutedLight: { color: "#4c7073" },
  accentLight: { color: "#08766b" },
});
