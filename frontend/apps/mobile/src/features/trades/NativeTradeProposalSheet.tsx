import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  AuthoritativeTradeProposalRequest,
  TradeEnvelope,
} from '@pokemongonexus/shared-contracts/trades';
import { calculateTradeCost } from '@pokemongonexus/shared-domain/trade-cost';
import {
  parseTradeVariantReference,
} from '@pokemongonexus/shared-domain/trade-proposal-candidates';
import { NativePokemonLocationBackdrop } from '../collection/parity/NativePokemonLocationBackdrop';
import type { NativeInstanceDetail } from '../collection/collectionModel';
import type { NativeTradeProposalSelection } from './nativeTradeProposalModel';
import { useNativeModalAnimation } from '../settings/useNativeMotion';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

type Props = {
  assetBaseUrl: string;
  caughtDetails: NativeInstanceDetail[];
  currentTrainerInstances: Record<string, PokemonInstance>;
  isMarkingForTrade: boolean;
  isPreparing?: boolean;
  partnerInstances: Record<string, PokemonInstance>;
  partnerUsername: string;
  offeredDetails: NativeInstanceDetail[];
  onClose: () => void;
  onMarkForTrade: (instanceId: string) => Promise<void>;
  onSubmit: (proposal: AuthoritativeTradeProposalRequest) => Promise<TradeEnvelope>;
  selection: NativeTradeProposalSelection | null;
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

const selectionMessage = (selection: NativeTradeProposalSelection): string | null => {
  switch (selection.kind) {
    case 'invalid':
      return selection.message;
    case 'noCaught':
      return 'You do not have this Pokémon caught, so you cannot propose this trade.';
    case 'onlyTradeLocked':
      return 'Your caught copies are Lucky and cannot be traded again.';
    case 'noAvailableTradeable':
      return 'Every matching For Trade copy is already involved in an active proposal.';
    default:
      return null;
  }
};

const PokemonProposalCard = ({
  assetBaseUrl,
  detail,
  label,
  luckyRequested,
  light,
}: {
  assetBaseUrl: string;
  detail: NativeInstanceDetail;
  label: string;
  luckyRequested: boolean;
  light: boolean;
}) => (
  <View style={[styles.pokemonCard, light && styles.pokemonCardLight]}>
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.72}
      numberOfLines={1}
      style={[styles.partyLabel, light && styles.accentLight]}
    >
      {label}
    </Text>
    <View style={styles.pokemonStage}>
      {detail.row.locationBackgroundUri ? (
        <NativePokemonLocationBackdrop uri={detail.row.locationBackgroundUri} />
      ) : null}
      {luckyRequested ? (
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
          style={styles.luckyBackdrop}
        />
      ) : null}
      {detail.row.imageUri ? (
        <Image fadeDuration={0}
          accessibilityLabel={detail.row.name}
          resizeMode="contain"
          source={{ uri: detail.row.imageUri }}
          style={styles.pokemonImage}
        />
      ) : null}
      {detail.row.maxKind ? (
        <Image fadeDuration={0}
          accessibilityLabel={detail.row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, `/images/${detail.row.maxKind}.png`) }}
          style={styles.maxBadge}
        />
      ) : null}
    </View>
    <Text numberOfLines={3} style={[styles.pokemonName, light && styles.textLight]}>
      {detail.row.name}
    </Text>
  </View>
);

const FriendshipPicker = ({
  assetBaseUrl,
  friendshipLevel,
  light,
  luckyRequested,
  onFriendshipChange,
  onLuckyChange,
}: {
  assetBaseUrl: string;
  friendshipLevel: number;
  light: boolean;
  luckyRequested: boolean;
  onFriendshipChange: (level: number) => void;
  onLuckyChange: (value: boolean) => void;
}) => (
  <View style={[styles.friendshipCard, light && styles.friendshipCardLight]}>
    <View style={styles.friendshipIcons}>
      <View accessibilityLabel={`${friendshipLevel} of 5 friendship hearts`} style={styles.hearts}>
        {[1, 2, 3, 4, 5].map((level) => (
          <Pressable
            accessibilityLabel={`Set friendship to ${level} heart${level === 1 ? '' : 's'}${level === 5 ? ' and enable remote trading' : ''}`}
            accessibilityRole="button"
            key={level}
            onPress={() => onFriendshipChange(level)}
            style={styles.heartButton}
          >
            <Image fadeDuration={0}
              accessibilityElementsHidden
              resizeMode="contain"
              source={{
                uri: toAssetUrl(
                  assetBaseUrl,
                  `/images/${level <= friendshipLevel ? 'heart-filled' : 'heart-unfilled'}.png`,
                ),
              }}
              style={styles.heart}
            />
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityLabel={luckyRequested ? 'Disable Lucky trade request' : 'Request Lucky trade'}
        accessibilityRole="button"
        onPress={() => onLuckyChange(!luckyRequested)}
        style={[styles.conditionIconButton, !luckyRequested && styles.conditionInactive]}
      >
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky_friend_icon.png') }}
          style={styles.conditionIcon}
        />
      </Pressable>
      <View
        accessibilityLabel={friendshipLevel === 5
          ? 'Remote trade available'
          : 'Remote trade unlocks at five hearts'}
        accessibilityRole="image"
        style={[styles.conditionIconButton, friendshipLevel < 5 && styles.conditionInactive]}
      >
        <Image fadeDuration={0}
          accessibilityElementsHidden
          resizeMode="contain"
          source={{ uri: toAssetUrl(assetBaseUrl, '/images/remote_trade_icon.png') }}
          style={styles.conditionIcon}
        />
      </View>
    </View>
    <View style={styles.conditionLabels}>
      <Text style={styles.conditionPill}>
        {friendshipLevel === 5 ? 'Remote trade available' : `${friendshipLevel}/5 hearts`}
      </Text>
      <Text style={styles.conditionPill}>
        {luckyRequested
          ? 'Lucky trade requested'
          : friendshipLevel >= 4
            ? 'Lucky Friends eligible'
            : 'Lucky unlocks at 4 hearts'}
      </Text>
    </View>
  </View>
);

export const NativeTradeProposalSheet = ({
  assetBaseUrl,
  caughtDetails,
  currentTrainerInstances,
  isMarkingForTrade,
  isPreparing = false,
  partnerInstances,
  partnerUsername,
  offeredDetails,
  onClose,
  onMarkForTrade,
  onSubmit,
  selection,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('slide');
  const [selectedInstanceId, setSelectedInstanceId] = useState(
    offeredDetails[0]?.instance?.instance_id ?? '',
  );
  const [friendshipLevel, setFriendshipLevel] = useState(
    selection && selection.kind !== 'invalid' ? selection.friendshipLevel : 0,
  );
  const [luckyRequested, setLuckyRequested] = useState(
    selection && selection.kind !== 'invalid' ? selection.luckyRequested : false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [committedTradeId, setCommittedTradeId] = useState<string | null>(null);
  const selectedOffer = offeredDetails.find(
    (detail) => detail.instance?.instance_id === selectedInstanceId,
  ) ?? offeredDetails[0] ?? null;
  const tradeTerms = useMemo(() => {
    if (!selection || selection.kind !== 'proposalReady' || !selectedOffer?.instance) {
      return null;
    }
    return calculateTradeCost({
      friendshipLevel,
      receivedPokemon: {
        variant_id: selection.partnerPokemon.instance?.variant_id,
        rarity: selection.partnerPokemon.rarity,
        instanceData: selection.partnerPokemon.instance,
      },
      offeredInstance: selectedOffer.instance,
      currentTrainerInstances,
      partnerInstances,
      parseVariantId: parseTradeVariantReference,
    });
  }, [
    currentTrainerInstances,
    friendshipLevel,
    partnerInstances,
    selectedOffer,
    selection,
  ]);

  if (!selection && !isPreparing) return null;
  const errorMessage = selection ? selectionMessage(selection) : null;
  const markLucky = (value: boolean) => {
    setLuckyRequested(value);
    if (value && friendshipLevel < 4) setFriendshipLevel(4);
  };
  const selectFriendship = (level: number) => {
    setFriendshipLevel(level);
    if (level < 4) setLuckyRequested(false);
  };
  const submit = async () => {
    if (
      !selection
      || selection.kind !== 'proposalReady'
      || !selectedOffer?.instance?.instance_id
      || !tradeTerms
      || friendshipLevel < 1
      || friendshipLevel > 5
    ) return;
    const readySelection = selection;

    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      const envelope = await onSubmit({
        username_accepting: partnerUsername,
        pokemon_instance_id_user_proposed: selectedOffer.instance.instance_id,
        pokemon_instance_id_user_accepting: readySelection.acceptingInstanceId,
        is_special_trade: tradeTerms.isSpecialTrade,
        is_registered_trade: tradeTerms.isRegisteredTrade,
        is_lucky_trade: luckyRequested,
        trade_dust_cost: tradeTerms.stardustCost,
        trade_friendship_level: friendshipLevel as 1 | 2 | 3 | 4 | 5,
      });
      setCommittedTradeId(envelope.trade.trade_id);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'The trade proposal could not be created. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const markCandidateForTrade = async (instanceId: string) => {
    setMarkError(null);
    try {
      await onMarkForTrade(instanceId);
    } catch (error) {
      setMarkError(
        error instanceof Error
          ? error.message
          : 'This caught copy could not be listed For Trade. Please try again.',
      );
    }
  };

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, light && styles.sheetLight]} testID="native-trade-proposal-sheet">
          <Pressable
            accessibilityLabel="Close trade proposal"
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.closeButton, light && styles.controlLight]}
          >
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {isPreparing || !selection ? (
              <View style={styles.successPanel}>
                <ActivityIndicator color="#63d6a1" size="large" />
                <Text style={[styles.title, light && styles.textLight]}>Preparing proposal</Text>
                <Text style={[styles.body, light && styles.secondaryLight]}>
                  Checking your eligible Pokémon and active trades…
                </Text>
              </View>
            ) : committedTradeId ? (
              <View style={styles.successPanel}>
                <Text style={[styles.eyebrow, light && styles.accentLight]}>TRADE PROPOSAL SENT</Text>
                <Text style={[styles.title, light && styles.textLight]}>Proposal committed</Text>
                <Text style={[styles.body, light && styles.secondaryLight]}>
                  {partnerUsername} can now review your offer. Trade #{committedTradeId.slice(0, 8)} is in Trade Activity.
                </Text>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : selection.kind === 'needsTradeSelection' ? (
              <>
                <Text style={[styles.eyebrow, light && styles.accentLight]}>PREPARE YOUR OFFER</Text>
                <Text style={[styles.title, light && styles.textLight]}>Choose a caught copy</Text>
                <Text style={[styles.body, light && styles.secondaryLight]}>
                  This Pokémon is caught but not listed For Trade. Pick the exact copy to list before proposing.
                </Text>
                <View style={styles.candidateList}>
                  {caughtDetails.map((candidate) => (
                    <View key={candidate.instance?.instance_id} style={[styles.candidateRow, light && styles.pokemonCardLight]}>
                      {candidate.row.imageUri ? (
                        <Image fadeDuration={0} resizeMode="contain" source={{ uri: candidate.row.imageUri }} style={styles.candidateImage} />
                      ) : null}
                      <View style={styles.candidateCopy}>
                        <Text numberOfLines={2} style={[styles.candidateName, light && styles.textLight]}>{candidate.row.name}</Text>
                        <Text style={[styles.candidateMeta, light && styles.secondaryLight]}>
                          {candidate.instance?.nickname || (candidate.instance?.cp ? `CP ${candidate.instance.cp}` : 'Caught copy')}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isMarkingForTrade}
                        onPress={() => candidate.instance?.instance_id
                          ? void markCandidateForTrade(candidate.instance.instance_id)
                          : undefined}
                        style={[styles.compactButton, isMarkingForTrade && styles.disabled]}
                      >
                        <Text style={styles.compactButtonText}>Add to For Trade</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                {markError ? (
                  <View accessibilityLiveRegion="assertive" style={styles.inlineError}>
                    <Text style={styles.inlineErrorTitle}>Pokémon not added</Text>
                    <Text style={styles.inlineErrorText}>{markError}</Text>
                  </View>
                ) : null}
              </>
            ) : errorMessage ? (
              <View style={styles.errorPanel}>
                <Text style={styles.errorEyebrow}>TRADE UNAVAILABLE</Text>
                <Text style={[styles.title, light && styles.textLight]}>This offer cannot continue</Text>
                <Text style={[styles.body, light && styles.secondaryLight]}>{errorMessage}</Text>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={[styles.secondaryButtonText, light && styles.textLight]}>Back to listing</Text>
                </Pressable>
              </View>
            ) : selection.kind === 'proposalReady' && selectedOffer ? (
              <>
                <Text style={[styles.eyebrow, styles.centeredEyebrow, light && styles.accentLight]}>TRADE PROPOSAL</Text>
                <Text style={[styles.title, light && styles.textLight]}>Review the exchange</Text>
                <Text style={[styles.body, light && styles.secondaryLight]}>
                  Set friendship details, confirm both Pokémon, then send the proposal.
                </Text>
                <FriendshipPicker
                  assetBaseUrl={assetBaseUrl}
                  friendshipLevel={friendshipLevel}
                  light={light}
                  luckyRequested={luckyRequested}
                  onFriendshipChange={selectFriendship}
                  onLuckyChange={markLucky}
                />
                <View style={styles.exchange}>
                  <PokemonProposalCard
                    assetBaseUrl={assetBaseUrl}
                    detail={selectedOffer}
                    label="YOU OFFER"
                    light={light}
                    luckyRequested={luckyRequested}
                  />
                  <Image fadeDuration={0}
                    accessibilityElementsHidden
                    resizeMode="contain"
                    source={{ uri: toAssetUrl(assetBaseUrl, '/images/pogo_trade_icon.png') }}
                    style={styles.exchangeIcon}
                  />
                  <PokemonProposalCard
                    assetBaseUrl={assetBaseUrl}
                    detail={selection.partnerPokemon}
                    label={`${partnerUsername.toLocaleUpperCase()} OFFERS`}
                    light={light}
                    luckyRequested={luckyRequested}
                  />
                </View>
                {offeredDetails.length > 1 ? (
                  <View style={styles.instancePicker}>
                    <Text style={[styles.pickerLabel, light && styles.textLight]}>Choose your exact copy</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.instanceChoices}>
                        {offeredDetails.map((candidate, index) => {
                          const id = candidate.instance?.instance_id ?? '';
                          const active = id === selectedOffer.instance?.instance_id;
                          return (
                            <Pressable
                              accessibilityRole="button"
                              key={id || index}
                              onPress={() => setSelectedInstanceId(id)}
                              style={[styles.instanceChoice, active && styles.instanceChoiceActive]}
                            >
                              <Text style={[styles.instanceChoiceText, light && styles.textLight]}>
                                {candidate.instance?.nickname || `Copy ${index + 1}`}
                              </Text>
                              {candidate.instance?.cp ? (
                                <Text style={[styles.instanceChoiceMeta, light && styles.secondaryLight]}>CP {candidate.instance.cp}</Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}
                <View style={[styles.coordinationNote, light && styles.coordinationNoteLight]}>
                  <Text style={styles.coordinationIcon}>●●</Text>
                  <Text style={[styles.coordinationText, light && styles.secondaryLight]}>
                    Pokémon Go Nexus does not provide messaging. If accepted, use shared trainer details to coordinate externally.
                  </Text>
                </View>
                {submissionError ? (
                  <View accessibilityLiveRegion="assertive" style={styles.inlineError}>
                    <Text style={styles.inlineErrorTitle}>Proposal not sent</Text>
                    <Text style={styles.inlineErrorText}>{submissionError}</Text>
                  </View>
                ) : null}
                <View style={styles.actionRow}>
                  <View style={styles.costBlock}>
                    <Text style={[styles.eyebrow, light && styles.accentLight]}>ESTIMATED COST</Text>
                    <View style={styles.costLine}>
                      <Text style={[styles.cost, light && styles.textLight]}>
                        {(tradeTerms?.stardustCost ?? 0).toLocaleString()} Stardust
                      </Text>
                      <Image fadeDuration={0}
                        accessibilityElementsHidden
                        resizeMode="contain"
                        source={{ uri: toAssetUrl(assetBaseUrl, '/images/stardust.png') }}
                        style={styles.stardust}
                      />
                    </View>
                    <View style={styles.flags}>
                      {tradeTerms?.isSpecialTrade ? <Text style={styles.specialFlag}>Special trade</Text> : null}
                      {friendshipLevel === 5 ? <Text style={styles.remoteFlag}>Remote trade available</Text> : null}
                    </View>
                  </View>
                  <Pressable
                    accessibilityLabel="Propose trade"
                    accessibilityRole="button"
                    disabled={isSubmitting || friendshipLevel === 0}
                    onPress={() => void submit()}
                    style={[styles.primaryButton, (isSubmitting || friendshipLevel === 0) && styles.disabled]}
                  >
                    {isSubmitting ? <ActivityIndicator color="#06140d" /> : (
                      <Text style={styles.primaryButtonText}>Propose trade</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 24,
    backgroundColor: 'rgba(3,12,15,0.82)',
  },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 760,
    maxHeight: '94%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(112,191,174,0.42)',
    borderRadius: 18,
    backgroundColor: '#202c2c',
    shadowColor: '#000000',
    shadowOpacity: 0.52,
    shadowRadius: 28,
    elevation: 18,
  },
  sheetLight: { backgroundColor: '#f5faf7', borderColor: '#7eb8aa' },
  content: { padding: 14, gap: 12, paddingBottom: 18 },
  closeButton: {
    position: 'absolute', top: 10, right: 10, zIndex: 5,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 22, borderWidth: 1, borderColor: '#637471', backgroundColor: '#172020',
  },
  closeText: { color: '#ffffff', fontSize: 30, lineHeight: 32, fontWeight: '500' },
  controlLight: { backgroundColor: '#ffffff', borderColor: '#96aaa4' },
  eyebrow: { color: '#63d6a1', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  accentLight: { color: '#087454' },
  centeredEyebrow: { textAlign: 'center' },
  title: { paddingHorizontal: 48, color: '#f4fbf8', fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center' },
  body: { color: '#b7c9c9', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  textLight: { color: '#18302a' },
  secondaryLight: { color: '#536b64' },
  friendshipCard: { gap: 7, padding: 10, borderWidth: 1, borderColor: '#365b54', borderRadius: 13, backgroundColor: '#142322' },
  friendshipCardLight: { borderColor: '#789d94', backgroundColor: '#20312e' },
  friendshipIcons: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center' },
  hearts: { flexDirection: 'row', flexWrap: 'nowrap' },
  heartButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  heart: { width: 31, height: 31 },
  conditionIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  conditionIcon: { width: 37, height: 37 },
  conditionInactive: { opacity: 0.35 },
  conditionLabels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  conditionPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: '#3b6c63', color: '#b8d5cf', fontSize: 11 },
  exchange: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pokemonCard: { flex: 1, minWidth: 0, alignItems: 'center', padding: 8, borderWidth: 1, borderColor: '#34524e', borderRadius: 13, backgroundColor: '#12201f' },
  pokemonCardLight: { backgroundColor: '#e7f1ec', borderColor: '#a0bbb3' },
  partyLabel: { minHeight: 18, color: '#63d6a1', fontSize: 10, lineHeight: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 0.6 },
  pokemonStage: { width: '100%', maxWidth: 150, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  luckyBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  pokemonImage: { width: '86%', height: '86%' },
  maxBadge: { position: 'absolute', top: 4, right: '4%', width: '28%', height: '28%' },
  pokemonName: { minHeight: 38, color: '#f4fbf8', fontSize: 15, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  exchangeIcon: { width: 34, height: 44, borderRadius: 17, backgroundColor: '#293b37' },
  instancePicker: { gap: 7 },
  pickerLabel: { color: '#f4fbf8', fontSize: 13, fontWeight: '800' },
  instanceChoices: { flexDirection: 'row', gap: 7, paddingRight: 14 },
  instanceChoice: { minWidth: 104, padding: 9, borderWidth: 1, borderColor: '#46605c', borderRadius: 9, backgroundColor: '#182725' },
  instanceChoiceActive: { borderColor: '#45c998', backgroundColor: '#174333' },
  instanceChoiceText: { color: '#f4fbf8', fontSize: 12, fontWeight: '800' },
  instanceChoiceMeta: { color: '#a9bfba', fontSize: 10, marginTop: 2 },
  coordinationNote: { flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderColor: '#345b70', borderRadius: 11, backgroundColor: '#132833' },
  coordinationNoteLight: { borderColor: '#8eb6c9', backgroundColor: '#e6f3f8' },
  coordinationIcon: { color: '#7bd8ff', fontSize: 13, letterSpacing: -2 },
  coordinationText: { flex: 1, color: '#b7c9c9', fontSize: 11, lineHeight: 16 },
  actionRow: { gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#36504c' },
  costBlock: { gap: 5 },
  costLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cost: { color: '#f4fbf8', fontSize: 16, fontWeight: '900' },
  stardust: { width: 22, height: 36 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  specialFlag: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 999, color: '#ffd18a', backgroundColor: '#5b4728', fontSize: 10, fontWeight: '800' },
  remoteFlag: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 999, color: '#9edcff', backgroundColor: '#244557', fontSize: 10, fontWeight: '800' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 11, backgroundColor: '#31b777' },
  primaryButtonText: { color: '#06140d', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#60736e', borderRadius: 11 },
  secondaryButtonText: { color: '#f4fbf8', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.48 },
  inlineError: { gap: 3, padding: 10, borderWidth: 1, borderColor: '#e25d72', borderRadius: 10, backgroundColor: '#4c1e29' },
  inlineErrorTitle: { color: '#ff9bae', fontSize: 13, fontWeight: '900' },
  inlineErrorText: { color: '#ffe4e9', fontSize: 12, lineHeight: 17 },
  errorPanel: { gap: 13, paddingTop: 34 },
  errorEyebrow: { color: '#ff7187', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  successPanel: { gap: 13, paddingTop: 34 },
  candidateList: { gap: 8 },
  candidateRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderWidth: 1, borderColor: '#405b56', borderRadius: 11, backgroundColor: '#152220' },
  candidateImage: { width: 58, height: 58 },
  candidateCopy: { flex: 1, minWidth: 0 },
  candidateName: { color: '#f4fbf8', fontSize: 13, fontWeight: '800' },
  candidateMeta: { color: '#a8bbb6', fontSize: 11, marginTop: 2 },
  compactButton: { maxWidth: 112, minHeight: 42, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#258758' },
  compactButtonText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
});
