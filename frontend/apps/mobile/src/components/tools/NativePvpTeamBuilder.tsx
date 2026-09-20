import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  PokemonPvPBattleMechanics,
  PokemonPvPRankingEntry,
} from "@pokemongonexus/shared-contracts/pokemon";
import {
  buildPvPBattleFighterFromRankingEntry,
  evaluatePvPTeamLocally,
} from "@pokemongonexus/shared-domain/pvp-battle";
import type {
  PvPTeamEvaluationResponse,
  PvPTeamRole,
  PvPTeamWorkerRequest,
} from "@pokemongonexus/shared-domain/pvp-battle-protocol";
import {
  analyzePvPTeam,
  formatPvPSpeciesName,
  rankPvPTeamCandidates,
  type PvPTeamCandidate,
} from "@pokemongonexus/app-core/pvp-team-builder";
import {
  loadNativePvpTeam,
  saveNativePvpTeam,
  type NativePvpTeamSlots,
} from "../../features/tools/nativePvpTeams";
import { NativeUiIcon, type NativeUiIconName } from "../NativeUiIcon";
import { markNativeUiPerformanceAfterPaint } from "../../observability/nativeUiInteractionTiming";

type Props = {
  assetBaseUrl: string;
  candidates: PvPTeamCandidate[];
  entriesBySpeciesId: Map<string, PokemonPvPRankingEntry>;
  fieldCandidates: PvPTeamCandidate[];
  light: boolean;
  mechanics: PokemonPvPBattleMechanics;
  onTestMatchup: (memberKeys: string[], opponentKey: string) => void;
  persistSelection?: boolean;
  storageKey: string;
};

const ROLES = [
  { detail: "Even shields", icon: "flag" as NativeUiIconName, label: "Lead" },
  { detail: "Energy advantage", icon: "trade" as NativeUiIconName, label: "Safe Swap" },
  { detail: "No shields", icon: "fist" as NativeUiIconName, label: "Closer" },
] as const;
const EMPTY_TEAM: NativePvpTeamSlots = [null, null, null];

const assetUri = (base: string, value: string): string | undefined => {
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
};

const strongestRole = (entry: PokemonPvPRankingEntry): string => {
  const labels = ["Lead", "Closer", "Switch", "Charger", "Attacker", "Consistency"];
  let best = 0;
  entry.categoryScores.forEach((score, index) => {
    if ((score ?? 0) > (entry.categoryScores[best] ?? 0)) best = index;
  });
  return labels[best] ?? "Overall";
};

const entrySearchText = (entry: PokemonPvPRankingEntry): string =>
  [
    entry.name,
    entry.speciesId,
    ...entry.types,
    ...entry.moveset.flatMap((move) => [move.name, move.type]),
  ]
    .join(" ")
    .toLocaleLowerCase();

export const NativePvpTeamBuilder = ({
  assetBaseUrl,
  candidates,
  entriesBySpeciesId,
  fieldCandidates,
  light,
  mechanics,
  onTestMatchup,
  persistSelection = true,
  storageKey,
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
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedKeys, setSelectedKeys] =
    useState<NativePvpTeamSlots>(EMPTY_TEAM);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const storageReady = useRef(false);

  useEffect(() => {
    if (!persistSelection) {
      storageReady.current = false;
      return;
    }
    let active = true;
    void loadNativePvpTeam(storageKey).then((slots) => {
      if (!active) return;
      storageReady.current = true;
      if (slots.some((slot) => slot != null)) {
        setSelectedKeys(slots);
        setActiveSlot(Math.max(0, slots.findIndex((slot) => slot == null)));
      }
    });
    return () => {
      active = false;
    };
  }, [persistSelection, storageKey]);

  useEffect(() => {
    if (persistSelection && storageReady.current)
      void saveNativePvpTeam(storageKey, selectedKeys);
  }, [persistSelection, selectedKeys, storageKey]);

  const candidatesByKey = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.key, candidate])),
    [candidates],
  );
  const members = useMemo(
    () => selectedKeys.map((key) => key ? candidatesByKey.get(key) : undefined),
    [candidatesByKey, selectedKeys],
  );
  const team = useMemo(
    () => members.filter((entry): entry is PvPTeamCandidate => entry != null),
    [members],
  );
  const selected = useMemo(
    () => new Set(team.map((candidate) => candidate.key)),
    [team],
  );
  const analysis = useMemo(() => analyzePvPTeam(team, candidates), [candidates, team]);
  const normalized = deferredQuery.trim().toLocaleLowerCase();
  const visibleCandidates = useMemo(
    () => rankPvPTeamCandidates(candidates)
      .filter((candidate) => !normalized || [entrySearchText(candidate.entry), candidate.nickname ?? ""].join(" ").toLocaleLowerCase().includes(normalized))
      .slice(0, 40),
    [candidates, normalized],
  );
  const hasMatchupEvidence = candidates.some((candidate) => (candidate.entry.matchups?.length ?? 0) > 0 || (candidate.entry.counters?.length ?? 0) > 0);
  const fieldCandidateByKey = useMemo(() => new Map(fieldCandidates.map((candidate) => [candidate.key, candidate])), [fieldCandidates]);
  const teamEvaluationRequest = useMemo<PvPTeamWorkerRequest | null>(() => {
    if (members.some((member) => member == null)) return null;
    const evaluationMembers = members.flatMap((member, index) => {
      if (!member) return [];
      const fighter = buildPvPBattleFighterFromRankingEntry(member.entry, member.key);
      return fighter ? [{ fighter, role: (["lead", "switch", "closer"] as PvPTeamRole[])[index] }] : [];
    });
    const opponents = fieldCandidates.slice(0, 12).flatMap((candidate) => {
      const fighter = buildPvPBattleFighterFromRankingEntry(candidate.entry, candidate.key);
      return fighter ? [{ fighter, weight: Math.max(0.25, Math.min(1, candidate.entry.score / 100)) }] : [];
    });
    if (evaluationMembers.length !== 3 || opponents.length === 0) return null;
    return { kind: "team", mechanics, members: evaluationMembers, opponents };
  }, [fieldCandidates, mechanics, members]);
  const [teamEvaluationState, setTeamEvaluationState] = useState<{
    error: string;
    request: PvPTeamWorkerRequest | null;
    response: PvPTeamEvaluationResponse | null;
  }>({ error: "", request: null, response: null });
  const activeTeamEvaluation = teamEvaluationRequest && teamEvaluationState.request === teamEvaluationRequest
    ? teamEvaluationState
    : { error: "", request: teamEvaluationRequest, response: null };
  const teamEvaluation = activeTeamEvaluation.response;
  const teamEvaluationLoading = teamEvaluationRequest != null && activeTeamEvaluation.response == null && !activeTeamEvaluation.error;
  const teamEvaluationError = activeTeamEvaluation.error;

  useEffect(() => finishPerformance("pvp_team_selection_result_painted"), [finishPerformance, selectedKeys]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance("pvp_team_search_result_painted");
  }, [deferredQuery, finishPerformance, query, visibleCandidates]);
  useEffect(() => finishPerformance("pvp_team_evidence_result_painted"), [evidenceOpen, finishPerformance]);
  useEffect(() => {
    let cancelled = false;
    if (!teamEvaluationRequest) return undefined;
    const timer = setTimeout(() => {
      try {
        const response = evaluatePvPTeamLocally(teamEvaluationRequest);
        if (cancelled) return;
        setTeamEvaluationState({ error: "", request: teamEvaluationRequest, response });
        finishPerformance("pvp_team_evaluation_result_painted");
      } catch (caught) {
        if (cancelled) return;
        setTeamEvaluationState({
          error: caught instanceof Error ? caught.message : "The team field test failed.",
          request: teamEvaluationRequest,
          response: null,
        });
        finishPerformance("pvp_team_evaluation_result_painted");
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [finishPerformance, teamEvaluationRequest]);

  const choose = (key: string) => {
    beginPerformance("pvp_team_selection_result_painted");
    setSelectedKeys((current) => {
      const next = [...current] as NativePvpTeamSlots;
      const existing = next.indexOf(key);
      if (existing >= 0) {
        next[existing] = null;
        setActiveSlot(existing);
        return next;
      }
      const firstEmpty = next.findIndex((item) => item == null);
      const target = next[activeSlot] == null
        ? activeSlot
        : firstEmpty >= 0
          ? firstEmpty
          : activeSlot;
      next[target] = key;
      const nextEmpty = next.findIndex((item) => item == null);
      if (next.every(Boolean)) beginPerformance("pvp_team_evaluation_result_painted");
      setActiveSlot(nextEmpty >= 0 ? nextEmpty : target);
      return next;
    });
  };

  const remove = (index: number) => {
    beginPerformance("pvp_team_selection_result_painted");
    setSelectedKeys((current) => {
      const next = [...current] as NativePvpTeamSlots;
      next[index] = null;
      return next;
    });
    setActiveSlot(index);
  };

  return (
    <View accessibilityLabel="PvP Team Builder" style={styles.builder}>
      <View style={styles.builderHeader}>
        <View style={styles.headingIdentity}>
          <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trainers" size={21} />
          <View>
            <Text style={[styles.eyebrow, light && styles.accentLight]}>THREE-POKÉMON TEAM</Text>
            <Text style={[styles.heading, light && styles.textLight]}>Team Builder</Text>
          </View>
        </View>
        <View style={[styles.count, light && styles.pillLight]}>
          <Text style={[styles.countText, light && styles.accentLight]}>{team.length} / 3</Text>
        </View>
      </View>

      <View style={styles.teamSlots}>
        {ROLES.map((role, index) => {
          const member = members[index];
          const memberName = member ? (member.nickname || member.entry.name) : "";
          const active = activeSlot === index;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${member ? "Edit" : "Choose"} ${role.label}${member ? `, ${memberName}` : ""}`}
              accessibilityState={{ selected: active }}
              key={role.label}
              onPress={() => setActiveSlot(index)}
              style={[
                styles.teamSlot,
                light && styles.panelLight,
                active && styles.teamSlotActive,
                !member && styles.teamSlotEmpty,
              ]}
            >
              <View style={styles.roleRow}>
                <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name={role.icon} size={18} />
                <View style={styles.roleCopy}>
                  <Text style={[styles.roleTitle, light && styles.accentLight]}>{role.label}</Text>
                  <Text style={[styles.roleDetail, light && styles.mutedLight]}>{role.detail}</Text>
                </View>
                {member ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${memberName} from team`}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      remove(index);
                    }}
                    style={[styles.remove, light && styles.removeLight]}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
              {member ? (
                <View style={styles.memberRow}>
                  <Image fadeDuration={0}
                    resizeMode="contain"
                    source={{ uri: assetUri(assetBaseUrl, member.entry.imageUrl) }}
                    style={styles.memberImage}
                  />
                  <View style={styles.memberCopy}>
                    <Text numberOfLines={1} style={[styles.memberName, light && styles.textLight]}>{memberName}</Text>
                    {member.nickname ? <Text style={[styles.memberMeta, light && styles.mutedLight]}>{member.entry.name}</Text> : null}
                    <Text style={[styles.memberMeta, light && styles.mutedLight]}>{strongestRole(member.entry)} profile</Text>
                    <Text style={[styles.memberScore, light && styles.accentLight]}>{member.entry.score.toFixed(1)} overall</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={[styles.plus, light && styles.accentLight]}>＋</Text>
                  <Text style={[styles.emptyCopy, light && styles.mutedLight]}>Choose Pokémon</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {team.length ? (
        <View style={[styles.analysis, light && styles.analysisLight]}>
          <View style={styles.builderHeader}>
            <View style={styles.headingIdentity}>
              <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="shield" size={20} />
              <View>
                <Text style={[styles.eyebrow, light && styles.accentLight]}>LOCAL ROLE FIELD TEST</Text>
                <Text style={[styles.analysisHeading, light && styles.textLight]}>Team check</Text>
              </View>
            </View>
            {teamEvaluation ? (
              <View style={[styles.count, light && styles.pillLight]}>
                <Text style={[styles.countText, light && styles.accentLight]}>{teamEvaluation.coverageCount} / {teamEvaluation.fieldSize} handled</Text>
              </View>
            ) : null}
          </View>
          {team.length < 3 ? (
            <Text style={[styles.body, light && styles.mutedLight]}>Fill all three roles to run the local meta field test.</Text>
          ) : null}
          {teamEvaluationLoading ? <Text accessibilityRole="alert" style={[styles.body, light && styles.mutedLight]}>Testing this team against the current meta field…</Text> : null}
          {teamEvaluationError ? <Text accessibilityRole="alert" style={styles.evaluationError}>{teamEvaluationError}</Text> : null}
          {team.length === 3 && !teamEvaluationRequest && !teamEvaluationLoading ? <Text style={[styles.body, light && styles.mutedLight]}>One or more selected builds lack complete local simulation data.</Text> : null}
          {teamEvaluation ? (
            <>
              <View style={[styles.analysisStats, light && styles.analysisStatsLight]}>
                <View style={styles.analysisStat}>
                  <Text style={[styles.analysisLabel, light && styles.mutedLight]}>FIELD COVERAGE</Text>
                  <Text style={[styles.analysisValue, light && styles.accentLight]}>{teamEvaluation.coverageCount}/{teamEvaluation.fieldSize}</Text>
                </View>
                <View style={styles.analysisStat}>
                  <Text style={[styles.analysisLabel, light && styles.mutedLight]}>SHARED LOSSES</Text>
                  <Text style={[styles.analysisValue, light && styles.accentLight]}>{teamEvaluation.opponents.filter((opponent) => !opponent.covered).length}</Text>
                </View>
                <View style={styles.analysisStat}>
                  <Text style={[styles.analysisLabel, light && styles.mutedLight]}>ROLE TESTS</Text>
                  <Text style={[styles.analysisValue, light && styles.accentLight]}>{teamEvaluation.members.length}</Text>
                </View>
              </View>
              <View style={styles.roleResults}>{teamEvaluation.members.map((result, index) => {
                const member = members[index];
                return <View key={result.fighterId} style={[styles.roleResult, light && styles.panelLight]}><NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name={ROLES[index]?.icon ?? "flag"} size={16} /><View style={styles.memberCopy}><Text style={[styles.memberMeta, light && styles.mutedLight]}>{ROLES[index]?.label}</Text><Text style={[styles.memberName, light && styles.textLight]}>{member?.nickname || member?.entry.name || ROLES[index]?.label}</Text></View><View style={styles.roleRecord}><Text style={[styles.memberName, light && styles.textLight]}>{result.wins}-{result.losses}</Text><Text style={[styles.memberMeta, light && styles.mutedLight]}>W-L · {result.averageRating} avg</Text></View></View>;
              })}</View>
              {teamEvaluation.opponents.some((opponent) => !opponent.covered) ? <View style={styles.fieldLosses}><Text style={[styles.sectionLabel, light && styles.mutedLight]}>HARD FIELD LOSSES</Text>{teamEvaluation.opponents.filter((opponent) => !opponent.covered).slice(0, 6).map((opponent) => {
                const candidate = fieldCandidateByKey.get(opponent.fighterId);
                const bestMember = candidatesByKey.get(opponent.bestMemberId);
                if (!candidate || !bestMember) return null;
                return <Pressable accessibilityLabel={`Test ${candidate.entry.name} in Battle Lab`} accessibilityRole="button" key={opponent.fighterId} onPress={() => onTestMatchup(team.map((member) => member.key), candidate.key)} style={[styles.fieldLoss, light && styles.panelLight]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.suggestionImage} /><View style={styles.memberCopy}><Text style={[styles.memberName, light && styles.textLight]}>{candidate.entry.name}</Text><Text style={[styles.memberMeta, light && styles.mutedLight]}>Best answer {bestMember.nickname || bestMember.entry.name} · {opponent.bestRating}</Text></View><NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="flask" size={16} /></Pressable>;
              })}</View> : null}
            </>
          ) : null}

          {analysis.recommendations.length > 0 && team.length < 3 ? <View style={styles.suggestions}>
            <Text style={[styles.sectionLabel, light && styles.mutedLight]}>BEST ADDITIONS FOR {ROLES[activeSlot].label.toLocaleUpperCase()}</Text>
            {analysis.recommendations.map(({ candidate, covers }) => <Pressable accessibilityLabel={`Add suggested ${candidate.nickname || candidate.entry.name}`} accessibilityRole="button" key={candidate.key} onPress={() => choose(candidate.key)} style={[styles.suggestion, light && styles.panelLight]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, candidate.entry.imageUrl) }} style={styles.suggestionImage} /><View style={styles.memberCopy}><Text numberOfLines={1} style={[styles.memberName, light && styles.textLight]}>{candidate.nickname || candidate.entry.name}</Text><Text style={[styles.memberMeta, light && styles.mutedLight]}>Covers {covers.length} open threat{covers.length === 1 ? "" : "s"}</Text></View><Text style={[styles.plusSmall, light && styles.accentLight]}>＋</Text></Pressable>)}
          </View> : null}

          {analysis.replacements.length > 0 && team.length === 3 ? <View style={styles.suggestions}>
            <Text style={[styles.sectionLabel, light && styles.mutedLight]}>STRONGER COVERAGE SWAPS</Text>
            {analysis.replacements.map((replacement) => {
              const slot = selectedKeys.indexOf(replacement.replaceKey);
              if (slot < 0) return null;
              const label = replacement.candidate.nickname || replacement.candidate.entry.name;
              return <Pressable accessibilityLabel={`Replace ${ROLES[slot].label} with ${label}`} accessibilityRole="button" key={`${replacement.candidate.key}-${replacement.replaceKey}`} onPress={() => { setActiveSlot(slot); choose(replacement.candidate.key); }} style={[styles.suggestion, light && styles.panelLight]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, replacement.candidate.entry.imageUrl) }} style={styles.suggestionImage} /><View style={styles.memberCopy}><Text style={[styles.memberName, light && styles.textLight]}>{label}</Text><Text style={[styles.memberMeta, light && styles.mutedLight]}>Replace {ROLES[slot].label} · closes {replacement.improvement} gap{replacement.improvement === 1 ? "" : "s"}</Text></View><NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trade" size={16} /></Pressable>;
            })}
          </View> : null}

          {hasMatchupEvidence ? <View style={styles.evidence}>
            <Pressable accessibilityLabel="Published matchup evidence" accessibilityRole="button" accessibilityState={{ expanded: evidenceOpen }} onPress={() => { beginPerformance("pvp_team_evidence_result_painted"); setEvidenceOpen((open) => !open); }} style={styles.evidenceSummary}><Text style={[styles.memberName, light && styles.textLight]}>Published matchup evidence</Text><Text style={[styles.countText, light && styles.accentLight]}>{analysis.exposedThreats.length} open {evidenceOpen ? "⌃" : "⌄"}</Text></Pressable>
            {evidenceOpen ? <View style={styles.threatList}>{analysis.threats.slice(0, 10).map((threat) => {
              const opponent = entriesBySpeciesId.get(threat.speciesId);
              const testMemberKey = threat.coveredByKeys[0] ?? threat.affectedKeys[0] ?? team[0]?.key;
              return <View key={threat.speciesId} style={[styles.threat, threat.coveredByKeys.length ? styles.threatCovered : styles.threatOpen]}>{opponent?.imageUrl ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, opponent.imageUrl) }} style={styles.suggestionImage} /> : null}<View style={styles.memberCopy}><Text style={[styles.memberName, light && styles.textLight]}>{opponent?.name ?? formatPvPSpeciesName(threat.speciesId)}</Text><Text style={[styles.memberMeta, light && styles.mutedLight]}>Threatens {threat.affectedKeys.length} · {threat.coveredByKeys.length ? "Covered" : "Open"}</Text></View>{testMemberKey && opponent ? <Pressable accessibilityLabel={`Test ${opponent.name} in Battle Lab`} accessibilityRole="button" onPress={() => onTestMatchup(team.map((member) => member.key), opponent.speciesId)} style={styles.evidenceButton}><NativeUiIcon color="#42d5c2" name="flask" size={15} /></Pressable> : null}</View>;
            })}</View> : null}
          </View> : null}
        </View>
      ) : null}

      <View style={styles.pickSection}>
        <View style={styles.picksHeader}>
          <View>
            <Text style={[styles.eyebrow, light && styles.accentLight]}>CHOOSING ROLE</Text>
            <Text style={[styles.pickRole, light && styles.textLight]}>{ROLES[activeSlot].label}</Text>
          </View>
          <Text style={[styles.pickHint, light && styles.mutedLight]}>{team.length === 3 ? "Select to replace" : "Highest scoring first"}</Text>
        </View>
        <View style={[styles.searchWrap, light && styles.inputLight]}>
          <NativeUiIcon color={light ? '#4c7073' : '#9db6b8'} name="search" size={18} />
          <TextInput
            accessibilityLabel="Search Team Builder Pokémon"
            onChangeText={(value) => {
              beginPerformance("pvp_team_search_result_painted");
              setQuery(value);
            }}
            placeholder="Find Pokémon, type, or move"
            placeholderTextColor="#78868e"
            style={[styles.searchInput, light && styles.textLight]}
            value={query}
          />
        </View>
        <View style={styles.candidateGrid}>
          {visibleCandidates.map((candidate) => {
            const { entry } = candidate;
            const label = candidate.nickname || entry.name;
            const isSelected = selected.has(candidate.key);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSelected
                  ? `Unassign ${label} from ${ROLES[activeSlot].label}`
                  : `${team.length === 3 ? "Replace" : "Select"} ${ROLES[activeSlot].label} with ${label}`}
                key={candidate.key}
                onPress={() => choose(candidate.key)}
                style={[styles.candidate, light && styles.panelLight, isSelected && styles.candidateSelected]}
              >
                <Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, entry.imageUrl) }} style={styles.candidateImage} />
                <View style={styles.candidateCopy}>
                  <Text numberOfLines={1} style={[styles.candidateName, light && styles.textLight]}>{label}</Text>
                  {candidate.nickname ? <Text numberOfLines={1} style={[styles.candidateMeta, light && styles.mutedLight]}>{entry.name}</Text> : null}
                  <Text numberOfLines={1} style={[styles.candidateMeta, light && styles.mutedLight]}>{entry.score.toFixed(1)} overall</Text>
                </View>
                <View style={[styles.addButton, isSelected && styles.addButtonSelected]}>
                  <Text style={[styles.addButtonText, isSelected && styles.addButtonTextSelected]}>{isSelected ? "✓" : "+"}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {candidates.length > 40 && !normalized ? (
          <Text style={[styles.limitCopy, light && styles.mutedLight]}>Showing the 40 highest-scoring choices. Search to reach the full ranking.</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  builder: { gap: 10 },
  builderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  headingIdentity: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { color: "#42d5c2", fontSize: 20 },
  eyebrow: { color: "#8fc6cb", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heading: { color: "#f5ffff", fontSize: 20, fontWeight: "900" },
  count: { borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { color: "#42d5c2", fontSize: 10, fontWeight: "900" },
  teamSlots: { gap: 7 },
  teamSlot: { minHeight: 86, gap: 5, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(115,204,204,0.35)", borderRadius: 7, padding: 8, backgroundColor: "#151a1b" },
  panelLight: { borderColor: "#b2d2d2", backgroundColor: "#fff" },
  teamSlotActive: { borderColor: "#42d5c2", borderWidth: 2 },
  teamSlotEmpty: { borderStyle: "dashed", justifyContent: "center" },
  roleRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  roleIcon: { color: "#42d5c2", fontSize: 14 },
  roleCopy: { minWidth: 0, flex: 1 },
  roleTitle: { color: "#8fc6cb", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  roleDetail: { color: "#9db6b8", fontSize: 9, fontWeight: "700" },
  remove: { width: 29, height: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(237,111,165,0.5)", borderRadius: 15, backgroundColor: "rgba(237,111,165,0.08)" },
  removeLight: { backgroundColor: "#fff3f8" },
  removeText: { color: "#ed6fa5", fontSize: 20, lineHeight: 21, fontWeight: "800" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  memberImage: { width: 53, height: 53 },
  memberCopy: { minWidth: 0, flex: 1 },
  memberName: { color: "#f5ffff", fontSize: 12, fontWeight: "900" },
  memberMeta: { marginTop: 2, color: "#9db6b8", fontSize: 9, fontWeight: "700" },
  memberScore: { marginTop: 3, color: "#42d5c2", fontSize: 9, fontWeight: "900" },
  emptyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plus: { color: "#42d5c2", fontSize: 23 },
  emptyCopy: { color: "#9db6b8", fontSize: 11, fontWeight: "900" },
  analysis: { gap: 9, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(115,204,204,0.28)" },
  analysisLight: { borderColor: "#b2d2d2" },
  analysisHeading: { color: "#f5ffff", fontSize: 15, fontWeight: "900" },
  body: { color: "#9db6b8", fontSize: 10.5, lineHeight: 16 },
  analysisStats: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(115,204,204,0.28)" },
  analysisStatsLight: { borderColor: "#b2d2d2" },
  analysisStat: { minWidth: 0, flex: 1, alignItems: "center", gap: 3, paddingVertical: 8, paddingHorizontal: 2 },
  analysisLabel: { color: "#9db6b8", fontSize: 7.5, fontWeight: "900" },
  analysisValue: { color: "#42d5c2", fontSize: 14, fontWeight: "900" },
  evaluationError: { color: "#ff9ebd", fontSize: 10, lineHeight: 15 },
  roleResults: { gap: 5 },
  roleResult: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, borderLeftWidth: 3, borderColor: "#42d5c2", padding: 7, backgroundColor: "rgba(66,213,194,0.06)" },
  roleRecord: { alignItems: "flex-end" },
  fieldLosses: { gap: 5 },
  fieldLoss: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(237,111,165,0.35)", borderRadius: 6, padding: 6, backgroundColor: "rgba(237,111,165,0.05)" },
  evidence: { borderTopWidth: 1, borderColor: "rgba(115,204,204,0.28)", paddingTop: 6 },
  evidenceSummary: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  threatList: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  threat: { width: "49.3%", minHeight: 49, flexDirection: "row", alignItems: "center", gap: 7, borderLeftWidth: 3, padding: 5, backgroundColor: "#101516" },
  threatCovered: { borderLeftColor: "#42d5c2" },
  threatOpen: { borderLeftColor: "#ed6fa5" },
  evidenceButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 17 },
  battleButton: { minHeight: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 6, backgroundColor: "rgba(66,213,194,0.07)" },
  battleButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  battleButtonLight: { backgroundColor: "#f6ffff" },
  battleButtonText: { color: "#42d5c2", fontSize: 10, fontWeight: "900" },
  suggestions: { gap: 5 },
  sectionLabel: { color: "#9db6b8", fontSize: 9, fontWeight: "900" },
  suggestion: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 6, padding: 5, backgroundColor: "#151a1b" },
  suggestionImage: { width: 40, height: 40 },
  plusSmall: { color: "#42d5c2", fontSize: 20, fontWeight: "900" },
  pickSection: { gap: 7 },
  picksHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  pickRole: { color: "#f5ffff", fontSize: 13, fontWeight: "900" },
  pickHint: { color: "#9db6b8", fontSize: 9, fontWeight: "700" },
  searchWrap: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 12, backgroundColor: "#101516" },
  inputLight: { borderColor: "#8dc3c3", backgroundColor: "#fbffff" },
  searchIcon: { color: "#9db6b8", fontSize: 21 },
  searchInput: { minWidth: 0, flex: 1, minHeight: 42, color: "#f5ffff", fontSize: 13 },
  candidateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  candidate: { width: "49.2%", minHeight: 61, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(141,192,194,0.2)", borderRadius: 6, padding: 5, backgroundColor: "#151a1b" },
  candidateSelected: { borderColor: "#42d5c2", backgroundColor: "rgba(66,213,194,0.08)" },
  candidateImage: { width: 43, height: 43 },
  candidateCopy: { minWidth: 0, flex: 1 },
  candidateName: { color: "#f5ffff", fontSize: 9.5, fontWeight: "900" },
  candidateMeta: { color: "#9db6b8", fontSize: 8, fontWeight: "700" },
  addButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 14 },
  addButtonSelected: { borderColor: "#42d5c2", backgroundColor: "#42d5c2" },
  addButtonText: { color: "#f5ffff", fontSize: 18, fontWeight: "900" },
  addButtonTextSelected: { color: "#071313" },
  limitCopy: { color: "#9db6b8", fontSize: 9, textAlign: "center" },
  textLight: { color: "#071d20" },
  mutedLight: { color: "#4c7073" },
  accentLight: { color: "#08766b" },
  pillLight: { borderColor: "#7dbdb9", backgroundColor: "#f8ffff" },
});
