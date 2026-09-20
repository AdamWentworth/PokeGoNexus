import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  NativeHorizontalPageSlider,
  useNativeHorizontalPageOffset,
  type NativeHorizontalPageSliderHandle,
} from '../components/NativeHorizontalPageSlider';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import { NativeTrainerWorkspaceNav } from '../components/NativeTrainerWorkspaceNav';
import { NativeBackIcon } from '../components/NativeBackIcon';
import { NativeUiIcon, type NativeUiIconName } from '../components/NativeUiIcon';
import type {
  NativeFriendRow,
  NativeFriendsOverviewModel,
} from '../features/social/nativeFriendsModel';
import type { NativeTrainerSearchRow } from '../features/search/trainerSearchModel';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import {
  captureNativeUiInteractionStart,
  markNativeUiPerformanceAfterPaint,
} from '../observability/nativeUiInteractionTiming';

export type NativeFriendsView = 'friends' | 'requests' | 'find' | 'blocked';
export type NativeFriendsScreenCommand =
  | { action: 'accept'; friendshipId: string }
  | { action: 'add'; username: string }
  | { action: 'delete-request'; friendshipId: string; message: string }
  | { action: 'remove-friend'; userId: string }
  | { action: 'unblock'; userId: string };

type Props = {
  embedded?: boolean;
  activeView: NativeFriendsView;
  error?: string | null;
  feedback?: { tone: 'success' | 'error' | 'info'; text: string } | null;
  isCommandPending?: boolean;
  isLoading?: boolean;
  isSearching?: boolean;
  onCommand: (command: NativeFriendsScreenCommand) => void;
  onBack: () => void;
  onDismissFeedback?: () => void;
  onOpenProfile: (username: string) => void;
  onOpenProfileHome: () => void;
  onQueryChange: (query: string) => void;
  onRetry?: () => void;
  onRunSearch: () => void;
  onViewChange: (view: NativeFriendsView) => void;
  overview: NativeFriendsOverviewModel;
  query: string;
  scrollX?: Animated.Value;
  searchError?: string | null;
  searchResults: NativeTrainerSearchRow[];
};

const VIEWS: NativeFriendsView[] = ['friends', 'requests', 'find', 'blocked'];
const TEAM_COLORS = {
  instinct: '#f0b928',
  mystic: '#3f8ee8',
  valor: '#ef5a64',
  neutral: '#42d7c6',
} as const;

const viewLabel = (view: NativeFriendsView): string => ({
  blocked: 'Blocked',
  find: 'Find',
  friends: 'Friends',
  requests: 'Requests',
})[view];

const VIEW_ICONS: Record<NativeFriendsView, NativeUiIconName> = {
  blocked: 'blocked',
  find: 'search',
  friends: 'trainers',
  requests: 'clock',
};

const viewIcon = (view: NativeFriendsView): NativeUiIconName => VIEW_ICONS[view];

const TrainerIdentity = ({
  light,
  onOpen,
  row,
}: {
  light: boolean;
  onOpen?: () => void;
  row: NativeFriendRow | NativeTrainerSearchRow;
}) => {
  const color = TEAM_COLORS[row.team];
  const content = (
    <>
      <View style={[styles.avatar, { borderColor: color, backgroundColor: `${color}20` }]}>
        <Text style={[styles.avatarText, { color }]}>{row.avatarLabel}</Text>
      </View>
      <View style={styles.identityCopy}>
        <Text numberOfLines={1} style={[styles.identityName, light && styles.textLight]}>
          {row.pokemonGoName ?? row.username}
        </Text>
        <Text numberOfLines={1} style={[styles.identityMeta, light && styles.mutedLight]}>
          @{row.username}
          {row.teamLabel ? ` · ${row.teamLabel}` : ''}
          {row.trainerLevel ? ` · Level ${row.trainerLevel}` : ''}
        </Text>
      </View>
    </>
  );
  return onOpen ? (
    <Pressable
      accessibilityLabel={`Open ${row.username}'s profile`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.identityButton, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : <View style={styles.identityButton}>{content}</View>;
};

const TrainerRow = ({
  action,
  light,
  onOpen,
  row,
}: {
  action: React.ReactNode;
  light: boolean;
  onOpen?: () => void;
  row: NativeFriendRow | NativeTrainerSearchRow;
}) => (
  <View style={[styles.personRow, light && styles.personRowLight]}>
    <TrainerIdentity light={light} onOpen={onOpen} row={row} />
    <View style={styles.rowActions}>{action}</View>
  </View>
);

const TrashGlyph = () => (
  <Svg height={18} viewBox="0 0 24 24" width={18}>
    <Path
      d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"
      fill="none"
      stroke="#ff7187"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </Svg>
);

const RowAction = ({
  accessibilityLabel,
  disabled,
  icon,
  label,
  onPress,
  tone = 'secondary',
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.rowAction,
      icon != null && styles.rowActionIconOnly,
      tone === 'primary' && styles.rowActionPrimary,
      tone === 'danger' && styles.rowActionDanger,
      (pressed || disabled) && styles.pressed,
    ]}
  >
    {icon ?? (
      <Text style={[
        styles.rowActionText,
        tone === 'primary' && styles.rowActionPrimaryText,
        tone === 'danger' && styles.rowActionDangerText,
      ]}>{label}</Text>
    )}
  </Pressable>
);

const EmptyState = ({ children, light }: { children: string; light: boolean }) => (
  <View style={[styles.empty, light && styles.emptyLight]}>
    <NativeUiIcon color="#42d7c6" name="trade" size={26} />
    <Text style={[styles.emptyText, light && styles.mutedLight]}>{children}</Text>
  </View>
);

const SectionHeading = ({ eyebrow, light, title }: { eyebrow: string; light: boolean; title: string }) => (
  <View style={styles.sectionHeading}>
    <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={[styles.sectionTitle, light && styles.textLight]}>{title}</Text>
  </View>
);

export const NativeFriendsScreen = ({
  embedded = false,
  activeView,
  error = null,
  feedback = null,
  isCommandPending = false,
  isLoading = false,
  isSearching = false,
  onCommand,
  onBack,
  onDismissFeedback,
  onOpenProfile,
  onOpenProfileHome,
  onQueryChange,
  onRetry,
  onRunSearch,
  onViewChange,
  overview,
  query,
  scrollX,
  searchError = null,
  searchResults,
}: Props) => {
  const insets = useSafeAreaInsets();
  const light = useNativeColorScheme() === 'light';
  const { width } = useWindowDimensions();
  const sliderRef = useRef<NativeHorizontalPageSliderHandle>(null);
  const [confirmation, setConfirmation] = useState<NativeFriendRow | null>(null);
  const feedbackPerformanceRef = useRef<number | null>(null);
  const searchPerformanceRef = useRef<number | null>(null);
  const activeIndex = VIEWS.indexOf(activeView);
  const [dragX] = useState(() => new Animated.Value(0));
  const [internalScrollX] = useState(() => new Animated.Value(activeIndex * width));
  const pageScrollX = scrollX ?? internalScrollX;
  const renderedOffset = useNativeHorizontalPageOffset(pageScrollX, dragX, width);
  const tabWidth = Math.max(0, width - 30) / VIEWS.length;
  const translateX = renderedOffset?.interpolate({
    inputRange: [0, Math.max(width, 1) * (VIEWS.length - 1)],
    outputRange: [0, tabWidth * (VIEWS.length - 1)],
    extrapolate: 'clamp',
  }) ?? activeIndex * tabWidth;
  const requestCount = overview.incoming.length + overview.outgoing.length;
  const counts: Record<NativeFriendsView, number | null> = {
    blocked: overview.blocked.length,
    find: null,
    friends: overview.friends.length,
    requests: requestCount,
  };
  const changeView = (view: NativeFriendsView) => {
    const startedAt = captureNativeUiInteractionStart();
    onViewChange(view);
    sliderRef.current?.setPage(VIEWS.indexOf(view), undefined, () => {
      markNativeUiPerformanceAfterPaint('friends_view_result_painted', startedAt);
    });
  };
  const runCommand = (command: NativeFriendsScreenCommand) => {
    feedbackPerformanceRef.current = captureNativeUiInteractionStart();
    onCommand(command);
  };
  const runSearch = () => {
    searchPerformanceRef.current = captureNativeUiInteractionStart();
    onRunSearch();
  };

  useEffect(() => {
    if (!feedback || feedbackPerformanceRef.current === null) return;
    const startedAt = feedbackPerformanceRef.current;
    feedbackPerformanceRef.current = null;
    markNativeUiPerformanceAfterPaint('friends_command_result_painted', startedAt);
  }, [feedback]);

  useEffect(() => {
    if (isSearching || searchPerformanceRef.current === null) return;
    const startedAt = searchPerformanceRef.current;
    searchPerformanceRef.current = null;
    markNativeUiPerformanceAfterPaint('friends_search_result_painted', startedAt);
  }, [isSearching, searchError, searchResults]);
  const panelContentStyle = [
    styles.panelContent,
    { paddingBottom: 120 + insets.bottom },
  ];

  const loadingState = isLoading ? (
    <View accessibilityLiveRegion="polite" style={[styles.state, light && styles.panelLight]}>
      <ActivityIndicator color="#2f9cff" size="large" />
      <Text style={[styles.stateTitle, light && styles.textLight]}>Loading friends</Text>
      <Text style={[styles.stateCopy, light && styles.mutedLight]}>Syncing your trainer network…</Text>
    </View>
  ) : null;
  const errorState = !isLoading && error ? (
    <View accessibilityLiveRegion="assertive" style={[styles.state, styles.errorState, light && styles.panelLight]}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={[styles.stateTitle, light && styles.textLight]}>Friends are unavailable</Text>
      <Text style={[styles.stateCopy, light && styles.mutedLight]}>{error}</Text>
      {onRetry ? (
        <RowAction accessibilityLabel="Try loading friends again" label="Try again" onPress={onRetry} tone="primary" />
      ) : null}
    </View>
  ) : null;

  return (
    <View style={[styles.screen, light && styles.screenLight]} testID="native-friends-screen">
      <View style={[styles.header, light && styles.headerLight, { paddingTop: embedded ? 7 : 14 + insets.top }]}>
        {!embedded ? <View style={styles.productHeader}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={onBack}
            style={[styles.backButton, light && styles.backButtonLight]}
          >
            <NativeBackIcon color={light ? '#172124' : '#ffffff'} size={20} />
          </Pressable>
          <View style={styles.productCopy}>
            <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>TRAINER NETWORK</Text>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Friends</Text>
          </View>
        </View> : null}
        {overview.incoming.length ? (
          <Text accessibilityLabel={`${overview.incoming.length} incoming requests`} style={[styles.requestCount, light && styles.textLight]}>
            {overview.incoming.length} request{overview.incoming.length === 1 ? '' : 's'}
          </Text>
        ) : null}
        {!embedded ? <View style={styles.workspaceNav}>
          <NativeTrainerWorkspaceNav
            active="friends"
            onOpenFriends={() => undefined}
            onOpenProfile={onOpenProfileHome}
          />
        </View> : null}
        <View accessibilityRole="tablist" style={[styles.tabs, light && styles.tabsLight]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.tabIndicator, light && styles.tabIndicatorLight, { width: tabWidth, transform: [{ translateX }] }]}
            testID="native-friends-tab-indicator"
          />
          {VIEWS.map((view) => (
            <Pressable
              aria-selected={activeView === view}
              accessibilityLabel={`${viewLabel(view)} view`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeView === view }}
              key={view}
              onPress={() => changeView(view)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <NativeUiIcon
                color={activeView === view ? light ? '#172124' : '#ffffff' : light ? '#566467' : '#879699'}
                name={viewIcon(view)}
                size={14}
              />
              <Text numberOfLines={1} style={[styles.tabLabel, light && styles.tabLabelLight, activeView === view && styles.tabSelected, activeView === view && light && styles.tabSelectedLight]}>
                {viewLabel(view)}
              </Text>
              {counts[view] !== null ? <Text style={styles.tabCount}>{counts[view]}</Text> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {feedback ? (
        <View accessibilityRole="alert" style={[
          styles.feedback,
          feedback.tone === 'success' ? styles.feedbackSuccess : feedback.tone === 'error' ? styles.feedbackError : styles.feedbackInfo,
        ]}>
          <Text style={styles.feedbackText}>{feedback.text}</Text>
          {onDismissFeedback ? (
            <Pressable accessibilityLabel="Dismiss message" accessibilityRole="button" onPress={onDismissFeedback} style={styles.feedbackDismissButton}>
              <Text style={styles.feedbackDismiss}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <NativeHorizontalPageSlider
        activeIndex={activeIndex}
        onIndexChange={(index) => onViewChange(VIEWS[index] ?? 'friends')}
        ref={sliderRef}
        scrollX={pageScrollX}
        dragX={dragX}
      >
        <ScrollView contentContainerStyle={panelContentStyle} style={styles.panel}>
          {loadingState ?? errorState ?? (
            <View style={[styles.section, light && styles.panelLight]}>
              <SectionHeading eyebrow="CONNECTED TRAINERS" light={light} title="Your friends" />
              <View style={styles.peopleList}>
                {overview.friends.map((row) => (
                  <TrainerRow
                    action={<RowAction accessibilityLabel={`Remove ${row.username}`} disabled={isCommandPending} icon={<TrashGlyph />} label="Remove" onPress={() => {
                      const startedAt = Date.now();
                      setConfirmation(row);
                      markNativeUiPerformanceAfterPaint('friends_confirmation_painted', startedAt);
                    }} tone="danger" />}
                    key={row.userId}
                    light={light}
                    onOpen={() => onOpenProfile(row.username)}
                    row={row}
                  />
                ))}
              </View>
              {!overview.friends.length ? <EmptyState light={light}>Your friends will appear here. Find a trainer to get started.</EmptyState> : null}
            </View>
          )}
        </ScrollView>

        <ScrollView contentContainerStyle={panelContentStyle} style={styles.panel}>
          {loadingState ?? errorState ?? (
            <View style={styles.sectionStack}>
              <View style={[styles.section, light && styles.panelLight]}>
                <SectionHeading eyebrow="NEEDS YOUR ANSWER" light={light} title="Incoming requests" />
                <View style={styles.peopleList}>
                  {overview.incoming.map((row) => (
                    <TrainerRow
                      action={(
                        <>
                          <RowAction accessibilityLabel={`Accept ${row.username}`} disabled={isCommandPending} label="Accept" onPress={() => runCommand({ action: 'accept', friendshipId: row.friendshipId })} tone="primary" />
                          <RowAction accessibilityLabel={`Decline ${row.username}`} disabled={isCommandPending} label="Decline" onPress={() => runCommand({ action: 'delete-request', friendshipId: row.friendshipId, message: 'Friend request declined.' })} tone="danger" />
                        </>
                      )}
                      key={row.friendshipId}
                      light={light}
                      onOpen={() => onOpenProfile(row.username)}
                      row={row}
                    />
                  ))}
                </View>
                {!overview.incoming.length ? <EmptyState light={light}>No incoming requests.</EmptyState> : null}
              </View>
              <View style={[styles.section, light && styles.panelLight]}>
                <SectionHeading eyebrow="WAITING FOR A RESPONSE" light={light} title="Sent requests" />
                <View style={styles.peopleList}>
                  {overview.outgoing.map((row) => (
                    <TrainerRow
                      action={<RowAction accessibilityLabel={`Cancel request to ${row.username}`} disabled={isCommandPending} label="Cancel" onPress={() => runCommand({ action: 'delete-request', friendshipId: row.friendshipId, message: 'Friend request canceled.' })} />}
                      key={row.friendshipId}
                      light={light}
                      onOpen={() => onOpenProfile(row.username)}
                      row={row}
                    />
                  ))}
                </View>
                {!overview.outgoing.length ? <EmptyState light={light}>No sent requests.</EmptyState> : null}
              </View>
            </View>
          )}
        </ScrollView>

        <ScrollView contentContainerStyle={panelContentStyle} keyboardShouldPersistTaps="handled" style={styles.panel}>
          <View style={[styles.section, light && styles.panelLight]}>
            <SectionHeading eyebrow="SEARCH POKÉMON GO NEXUS" light={light} title="Find trainers" />
            <Text style={[styles.searchCopy, light && styles.mutedLight]}>Search by a Nexus username or Pokémon GO name.</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Trainer name"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onQueryChange}
                onSubmitEditing={runSearch}
                placeholder="Username or Pokémon GO name"
                placeholderTextColor={light ? '#6a777a' : '#809092'}
                returnKeyType="search"
                style={[styles.searchInput, light && styles.searchInputLight]}
                value={query}
              />
              <Pressable accessibilityRole="button" disabled={isSearching} onPress={runSearch} style={({ pressed }) => [styles.searchButton, (pressed || isSearching) && styles.pressed]}>
                <Text style={styles.searchButtonText}>{isSearching ? '…' : 'Search'}</Text>
              </Pressable>
            </View>
            {searchError ? <Text accessibilityRole="alert" style={styles.searchError}>{searchError}</Text> : null}
            <View style={styles.peopleList}>
              {searchResults.map((row) => (
                <TrainerRow
                  action={<RowAction accessibilityLabel={`Add ${row.username}`} disabled={isCommandPending} label="Add" onPress={() => runCommand({ action: 'add', username: row.username })} tone="primary" />}
                  key={row.username.toLocaleLowerCase()}
                  light={light}
                  onOpen={() => onOpenProfile(row.username)}
                  row={row}
                />
              ))}
            </View>
            {!searchResults.length && query.trim().length >= 2 && !isSearching && !searchError ? (
              <EmptyState light={light}>No trainers found. Try another username or Pokémon GO name.</EmptyState>
            ) : null}
          </View>
        </ScrollView>

        <ScrollView contentContainerStyle={panelContentStyle} style={styles.panel}>
          {loadingState ?? errorState ?? (
            <View style={[styles.section, light && styles.panelLight]}>
              <SectionHeading eyebrow="HIDDEN TRAINERS" light={light} title="Blocked trainers" />
              <View style={styles.peopleList}>
                {overview.blocked.map((row) => (
                  <TrainerRow
                    action={<RowAction accessibilityLabel={`Unblock ${row.username}`} disabled={isCommandPending} label="Unblock" onPress={() => runCommand({ action: 'unblock', userId: row.userId })} />}
                    key={row.userId}
                    light={light}
                    row={row}
                  />
                ))}
              </View>
              {!overview.blocked.length ? <EmptyState light={light}>You have not blocked any trainers.</EmptyState> : null}
            </View>
          )}
        </ScrollView>
      </NativeHorizontalPageSlider>

      <NativeConfirmationDialog
        body={confirmation ? `${confirmation.username} will be removed from your friends. You can send a new request later.` : ''}
        confirmLabel="Remove friend"
        isPending={isCommandPending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          runCommand({ action: 'remove-friend', userId: confirmation.userId });
          setConfirmation(null);
        }}
        title={confirmation ? `Remove ${confirmation.username}?` : 'Remove friend?'}
        visible={Boolean(confirmation)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#080d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  header: { zIndex: 2, paddingHorizontal: 10, paddingBottom: 7, backgroundColor: '#080d0f' },
  headerLight: { backgroundColor: '#f8fff9' },
  productHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11 },
  productCopy: { flex: 1, minWidth: 0 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#35494d', borderRadius: 10, backgroundColor: '#171f20' },
  backButtonLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  eyebrow: { color: '#42d7c6', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  eyebrowLight: { color: '#006a61' },
  title: { color: '#f7fbfc', fontSize: 27, fontWeight: '900' },
  requestCount: { marginTop: -2, marginBottom: 3, color: '#f7fbfc', fontSize: 13, fontWeight: '800' },
  workspaceNav: { marginTop: 25 },
  tabs: { position: 'relative', flexDirection: 'row', minHeight: 58, marginTop: 8, padding: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#35494d', borderRadius: 11, backgroundColor: '#0d1416' },
  tabsLight: { borderColor: '#9bb8b1', backgroundColor: '#e7f3eb' },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderWidth: 1, borderColor: '#36c5a4', borderRadius: 8, backgroundColor: '#153e39' },
  tabIndicatorLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  tab: { zIndex: 1, flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabLabel: { color: '#9aa8aa', fontSize: 10, fontWeight: '900' },
  tabLabelLight: { color: '#4b625e' },
  tabSelected: { color: '#ffffff' },
  tabSelectedLight: { color: '#2f4744' },
  tabCount: { position: 'absolute', top: 3, right: 5, minWidth: 17, paddingHorizontal: 4, color: '#b9c5c7', fontSize: 9, fontWeight: '900', textAlign: 'center', borderRadius: 9, backgroundColor: '#283335' },
  feedback: { marginHorizontal: 10, marginTop: 3, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 13, borderWidth: 1, borderRadius: 11 },
  feedbackSuccess: { borderColor: '#318b67', backgroundColor: '#17392e' },
  feedbackError: { borderColor: '#b94e61', backgroundColor: '#471f29' },
  feedbackInfo: { borderColor: '#3f78a5', backgroundColor: '#183049' },
  feedbackText: { flex: 1, color: '#f8fcfd', fontSize: 13, fontWeight: '800' },
  feedbackDismissButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  feedbackDismiss: { color: '#ffffff', fontSize: 22 },
  panel: { flex: 1, minHeight: 0 },
  panelContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 10 },
  sectionStack: { gap: 10 },
  section: { padding: 19, borderWidth: 1, borderColor: '#2d4246', borderRadius: 14, backgroundColor: '#12191b' },
  panelLight: { borderColor: '#9bb8b1', backgroundColor: '#f3faf5' },
  sectionHeading: { marginBottom: 17, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: '#2d4246' },
  sectionTitle: { marginTop: 2, color: '#f7fbfc', fontSize: 20, fontWeight: '900' },
  peopleList: { gap: 8 },
  personRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9 },
  personRowLight: { backgroundColor: 'transparent' },
  identityButton: { flex: 1, minWidth: 0, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: '900' },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  identityName: { color: '#f7fbfc', fontSize: 15, fontWeight: '900' },
  identityMeta: { color: '#9fadaf', fontSize: 11 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowAction: { minHeight: 44, minWidth: 62, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#596a6d', borderRadius: 9 },
  rowActionIconOnly: { width: 44, minWidth: 44, paddingHorizontal: 0 },
  rowActionPrimary: { borderColor: '#36c5a4', backgroundColor: '#36c5a4' },
  rowActionDanger: { borderColor: '#a94858', backgroundColor: '#3c2027' },
  rowActionText: { color: '#e5edef', fontSize: 12, fontWeight: '900' },
  rowActionPrimaryText: { color: '#061612' },
  rowActionDangerText: { color: '#ff9cab' },
  empty: { alignItems: 'center', marginTop: 9, padding: 20, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#365055', borderRadius: 11, backgroundColor: '#0c1315' },
  emptyLight: { borderColor: '#9bb8b1', backgroundColor: '#e3efe8' },
  emptyIcon: { color: '#42d7c6', fontSize: 25, fontWeight: '900' },
  emptyText: { maxWidth: 360, color: '#a5b2b4', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  searchCopy: { marginTop: -6, marginBottom: 10, color: '#a4b1b3', fontSize: 13, lineHeight: 18 },
  searchRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 12, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: '#617377', borderRadius: 10, backgroundColor: '#0c1214' },
  searchInputLight: { color: '#2f4744', borderColor: '#9bb8b1', backgroundColor: '#f9fffa' },
  searchButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#2f9cff' },
  searchButtonText: { color: '#04131f', fontSize: 13, fontWeight: '900' },
  searchError: { marginBottom: 10, color: '#ff8193', fontSize: 13, fontWeight: '800' },
  state: { alignItems: 'center', padding: 26, gap: 7, borderWidth: 1, borderColor: '#2d4246', borderRadius: 14, backgroundColor: '#12191b' },
  errorState: { borderColor: '#b94e61' },
  errorIcon: { color: '#ff6e83', fontSize: 28, fontWeight: '900' },
  stateTitle: { color: '#f7fbfc', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: '#a4b1b3', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  pressed: { opacity: 0.65 },
  textLight: { color: '#2f4744' },
  mutedLight: { color: '#4b625e' },
});
