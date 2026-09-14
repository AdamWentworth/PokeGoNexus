import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import type { NativeInstanceDetail } from '../../../src/features/collection/collectionModel';
import {
  NativeInstanceDetailScreen,
  resolveNativeInstanceLocationBackdropLayout,
} from '../../../src/screens/NativeInstanceDetailScreen';
import { getNativeLocationSuggestions } from '../../../src/services/locationApi';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../../src/features/collection/NativeCollectionSyncStatusCard', () => ({
  NativeCollectionSyncStatusCard: () => null,
}));

jest.mock('../../../src/services/locationApi', () => ({
  getNativeLocationSuggestions: jest.fn(),
}));

const mockGetNativeLocationSuggestions = jest.mocked(getNativeLocationSuggestions);

const detail = {
  row: {
    id: 'instance-1',
    pokemonId: 6,
    pokedexNumber: 6,
    name: 'Shiny Charizard',
    imageUri: 'https://pokegonexus.com/images/charizard.png',
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'trade' as const,
    cp: 2499,
    favorite: false,
    mostWanted: false,
  },
  traits: ['Shiny'],
  stats: [{ label: 'CP', value: '2,499' }],
  ivs: [{ label: 'Attack', value: 15 }],
  moves: [{
    label: 'Fast move',
    value: 'Fire Spin',
    legacy: false,
    typeName: 'Fire',
    typeIconUri: 'https://pokegonexus.com/images/types/fire.png',
    raidPower: 14,
    pvpPower: 9,
  }],
  provenance: [],
  preferences: [{ label: 'Friendship', value: '5/5 hearts' }],
  targetRows: [{
    id: 'wanted-1',
    pokemonId: 9,
    pokedexNumber: 9,
    name: 'Gigantamax Blastoise',
    imageUri: 'https://pokegonexus.com/images/blastoise.png',
    locationBackgroundUri: null,
    maxKind: 'gigantamax' as const,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'wanted' as const,
    cp: null,
    favorite: false,
    mostWanted: true,
  }],
};

const openCaughtEditor = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Edit Pokémon' }));
  // The Save affordance acknowledges the tap before the expensive controls
  // mount on the following frame.
  expect(screen.getByRole('button', { name: 'Save Pokémon' })).toBeTruthy();
  await waitFor(() => {
    expect(screen.getByLabelText('Pokémon inline identity editor')).toBeTruthy();
  });
};

describe('NativeInstanceDetailScreen', () => {
  beforeEach(() => {
    mockGetNativeLocationSuggestions.mockReset();
  });

  it.each([false, true])('hides stale trade conditions on caught Pokémon (lucky: %s)', (lucky) => {
    const caughtDetail: NativeInstanceDetail = {
      ...detail,
      row: { ...detail.row, status: 'caught', name: 'Shiny Groudon', cp: 4059, lucky },
      instance: {
        is_caught: true, is_for_trade: false, is_wanted: false,
        lucky, is_traded: lucky, friendship_level: 5,
      } as NonNullable<NativeInstanceDetail['instance']>,
      // Also guard an older cached projection carrying these summaries.
      preferences: [{ label: 'Friendship', value: '5/5 hearts' }],
    };
    const props = {
      cachedAt: null, error: null, isLoading: false, isSaving: false,
      movesWarning: null, saveNotice: null, saveError: null,
      onRetry: jest.fn(), onBack: jest.fn(), onToggleFavorite: jest.fn(),
    };
    const { rerender } = render(<NativeInstanceDetailScreen {...props} detail={caughtDetail} />);
    expect(screen.getByText('CP4059')).toBeTruthy();
    expect(screen.queryByText('TRADE CONDITIONS')).toBeNull();
    expect(screen.queryByText('Friendship')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit preferences' })).toBeNull();
    expect(screen.queryByText('Wanted Pokémon')).toBeNull();

    rerender(<NativeInstanceDetailScreen {...props} detail={detail} />);
    expect(screen.getByText('TRADE CONDITIONS')).toBeTruthy();
    expect(screen.getByText('5/5 hearts')).toBeTruthy();
  });

  it('matches Vite location-card geometry for every instance overlay width and status', () => {
    expect(resolveNativeInstanceLocationBackdropLayout(412, 'caught')).toEqual({
      backdropHeight: 340,
      backdropTop: -44,
      backdropWidth: 354.32,
      maxBadgeSize: 103.6,
      pokemonSize: 290.08,
      purifiedBadgeSize: 59.2,
      stageLift: 48,
      stageSize: 296,
    });
    expect(resolveNativeInstanceLocationBackdropLayout(412, 'trade'))
      .toEqual(resolveNativeInstanceLocationBackdropLayout(412, 'caught'));
    expect(resolveNativeInstanceLocationBackdropLayout(360, 'wanted')).toEqual({
      backdropHeight: 212,
      backdropTop: -44,
      backdropWidth: 309.6,
      maxBadgeSize: 58.8,
      pokemonSize: 164.64,
      purifiedBadgeSize: 33.6,
      stageLift: 8,
      stageSize: 168,
    });
    expect(resolveNativeInstanceLocationBackdropLayout(412, 'wanted')).toEqual(expect.objectContaining({
      backdropHeight: 229,
      backdropTop: -44,
      backdropWidth: 354.32,
      maxBadgeSize: 64.75,
      purifiedBadgeSize: 37,
      stageLift: 8,
      stageSize: 185,
    }));
    expect(resolveNativeInstanceLocationBackdropLayout(412, 'wanted').pokemonSize)
      .toBeCloseTo(181.3, 8);
    expect(resolveNativeInstanceLocationBackdropLayout(700, 'wanted')).toEqual({
      backdropHeight: 282,
      backdropTop: -44,
      backdropWidth: 447,
      maxBadgeSize: 83.3,
      pokemonSize: 233.24,
      purifiedBadgeSize: 47.6,
      stageLift: 18,
      stageSize: 238,
    });
  });

  it('commits the incoming identity and all detail sections together before entrance', async () => {
    const animationCompletions: ((result: { finished: boolean }) => void)[] = [];
    const deferredFrames: FrameRequestCallback[] = [];
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (completion?: (result: { finished: boolean }) => void) => {
        if (completion) animationCompletions.push(completion);
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }) as unknown as Animated.CompositeAnimation);
    jest.spyOn(Animated, 'parallel').mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    }) as unknown as Animated.CompositeAnimation);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      deferredFrames.push(callback);
      return deferredFrames.length;
    });
    const onNext = jest.fn();
    const commonProps = {
      cachedAt: null,
      error: null,
      isLoading: false,
      isSaving: false,
      movesWarning: null,
      onBack: jest.fn(),
      onNext,
      onRetry: jest.fn(),
      onToggleFavorite: jest.fn(),
      saveError: null,
      saveNotice: null,
    };
    const { rerender } = render(
      <NativeInstanceDetailScreen {...commonProps} detail={detail} />,
    );
    await act(async () => Promise.resolve());

    fireEvent(screen.getByTestId('native-horizontal-page-0'), 'layout', {
      nativeEvent: { layout: { width: 360, height: 64, x: 0, y: 0 } },
    });
    fireEvent.press(screen.getByTestId('native-instance-next'));
    act(() => animationCompletions.shift()?.({ finished: true }));
    expect(onNext).toHaveBeenCalledTimes(1);

    const incomingDetail: NativeInstanceDetail = {
      ...detail,
      row: { ...detail.row, id: 'instance-2', name: 'Shiny Squirtle' },
      ivs: [{ label: 'Attack', value: 3 }],
      moves: [{
        ...detail.moves[0],
        value: 'Water Gun',
        typeName: 'Water',
        typeIconUri: 'https://pokegonexus.com/images/types/water.png',
      }],
    };
    rerender(<NativeInstanceDetailScreen {...commonProps} detail={incomingDetail} />);

    expect(screen.getByText('Shiny Squirtle')).toBeTruthy();
    expect(screen.getByText('Water Gun')).toBeTruthy();
    expect(screen.queryByText('Fire Spin')).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByText('15')).toBeNull();
    expect(deferredFrames).toHaveLength(0);
    expect(StyleSheet.flatten(screen.getByTestId('native-horizontal-page-slider').props.style).height).toBeUndefined();

    act(() => animationCompletions.shift()?.({ finished: true }));
    jest.restoreAllMocks();
  });

  it('renders canonical Pokémon details and keeps editing behind the fallback', async () => {
    const onEditInCurrentApp = jest.fn();
    render(
      <NativeInstanceDetailScreen
        detail={detail}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={onEditInCurrentApp}
      />,
    );

    expect(screen.getByText('Shiny Charizard')).toBeTruthy();
    expect(screen.getByText('Fire Spin')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'TRAINER BATTLES' }));
    expect(screen.getByText('9')).toBeTruthy();
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 240));
    });
    expect(screen.getByText('Wanted Pokémon')).toBeTruthy();
    expect(screen.getByTestId('native-instance-scroll').props.nestedScrollEnabled).toBe(true);
    expect(screen.getByText('CP2499')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Edit Pokémon' }));
    expect(onEditInCurrentApp).toHaveBeenCalledTimes(1);
  });

  it('keeps every IV label on one line at constrained mobile widths', () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          ivs: [
            { label: 'Attack', value: 15 },
            { label: 'Defense', value: 14 },
            { label: 'HP', value: 13 },
          ],
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
        onSaveDetails={jest.fn()}
      />,
    );

    expect(screen.getByText('Defense').props).toMatchObject({
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.9,
      numberOfLines: 1,
    });
  });

  const renderOverlay = (instanceDetail: NativeInstanceDetail) => render(
    <NativeInstanceDetailScreen
      detail={instanceDetail} isLoading={false} error={null} cachedAt={null}
      movesWarning={null} saveNotice={null} saveError={null} isSaving={false}
      onRetry={jest.fn()} onBack={jest.fn()} onToggleFavorite={jest.fn()} onSaveDetails={jest.fn()}
    />,
  );

  const megaDetail = (shadow: boolean, purified: boolean): NativeInstanceDetail => ({
    ...detail,
    row: { ...detail.row, status: 'caught' },
    instance: { shadow, purified, mega: false, is_mega: false } as NativeInstanceDetail['instance'],
    megaOptions: [{
      form: 'X', label: 'Mega Charizard X', primal: false, imageUri: '', typeIconUris: [],
      stats: { attack: 273, defense: 213, stamina: 186 },
    }],
  });

  it.each([[false, false, true], [true, false, false], [false, true, true], [true, true, true]])(
    'Mega eligibility respects Shadow=%s and Purified=%s in both overlay and editor',
    async (shadow, purified, eligible) => {
      renderOverlay(megaDetail(shadow, purified));
      expect(Boolean(screen.queryByLabelText('Mega Evolution available'))).toBe(eligible);
      await openCaughtEditor();
      expect(Boolean(screen.queryByRole('button', { name: 'Mega Evolve' }))).toBe(eligible);
      expect(screen.queryByLabelText('Mega Evolution available')).toBeNull();
    },
  );

  it('updates Mega eligibility immediately when a Shadow draft is purified and reverted', async () => {
    renderOverlay(megaDetail(true, false));
    await openCaughtEditor();
    expect(screen.queryByRole('button', { name: 'Mega Evolve' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Shadow state: Purified' }));
    expect(screen.getByRole('button', { name: 'Mega Evolve' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Shadow state: Shadow' }));
    expect(screen.queryByRole('button', { name: 'Mega Evolve' })).toBeNull();
  });

  it.each([
    ['caught', 'premier_ball', 'premierball.png', 'PREMIER BALL'],
    ['trade', 'ultraball', 'ultraball.png', 'ULTRA BALL'],
    ['caught', ' Beast Ball ', 'beastball.png', 'BEAST BALL'],
  ] as const)('restores the saved ball in the %s card and editor for %s', async (status, pokeball, file, label) => {
    renderOverlay({
      ...detail, row: { ...detail.row, status }, provenance: [],
      instance: { pokeball } as NativeInstanceDetail['instance'],
    });
    expect(screen.getByText('CAUGHT')).toBeTruthy();
    expect(screen.getByTestId('native-instance-caught-ball', { includeHiddenElements: true }).props.source.uri)
      .toBe(`https://pokegonexus.com/media/images/balls/${file}`);
    await openCaughtEditor();
    expect(screen.getByTestId('native-instance-caught-ball', { includeHiddenElements: true }).props.source.uri)
      .toBe(`https://pokegonexus.com/media/images/balls/${file}`);
    expect(screen.getByRole('button', { name: `Ball caught: ${label}` }).props.accessibilityState.selected).toBe(true);
  });

  it('does not invent a caught ball when the saved ball is unknown', () => {
    renderOverlay({ ...detail, row: { ...detail.row, status: 'caught' },
      instance: { pokeball: null } as NativeInstanceDetail['instance'] });
    expect(screen.queryByTestId('native-instance-caught-ball', { includeHiddenElements: true })).toBeNull();
  });

  it('shows canonical catch-date and Mega-eligibility signals', () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            date_caught: '2026-06-15',
            mega: false,
            is_mega: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
          megaOptions: [{
            form: 'X',
            imageUri: 'https://pokegonexus.com/images/mega/mega_6_X.png',
            label: 'Mega Charizard X',
            primal: false,
            stats: { attack: 273, defense: 213, stamina: 186 },
            typeIconUris: [],
          }],
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Caught on 2026-06-15')).toBeTruthy();
    expect(screen.getByTestId('native-instance-caught-ribbon-icon', { includeHiddenElements: true }).props.source.uri)
      .toBe('https://pokegonexus.com/media/images/caught.png');
    expect(screen.getByLabelText('Mega Evolution available')).toBeTruthy();
  });

  it('removes owner mutation controls from a foreign For Trade listing', () => {
    render(
      <NativeInstanceDetailScreen
        canEdit={false}
        detail={detail}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    expect(screen.getByText('Shiny Charizard')).toBeTruthy();
    expect(screen.getByText('Wanted Pokémon')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Pokémon' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit preferences' })).toBeNull();
  });

  it('removes owner mutation controls from a foreign Wanted listing', () => {
    render(
      <NativeInstanceDetailScreen
        canEdit={false}
        detail={{
          ...detail,
          row: { ...detail.row, status: 'wanted', mostWanted: true },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    expect(screen.getByText('WANTED')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit wanted listing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit preferences' })).toBeNull();
  });

  it('renders canonical type, legacy, power, and Shadow bonus move signals', () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: { shadow: true } as NonNullable<NativeInstanceDetail['instance']>,
          moves: [{
            label: 'Charged move',
            value: 'Blast Burn',
            legacy: true,
            typeName: 'Fire',
            typeIconUri: 'https://pokegonexus.com/images/types/fire.png',
            raidPower: 120,
            pvpPower: 110,
          }],
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    expect(screen.getByText('Blast Burn*')).toBeTruthy();
    expect(screen.getByLabelText('Fire type')).toBeTruthy();
    expect(screen.getByText('+24')).toBeTruthy();
    expect(screen.getByLabelText('Shadow bonus')).toBeTruthy();
  });

  it('shows a recoverable missing-instance state', () => {
    const onBack = jest.fn();
    render(
      <NativeInstanceDetailScreen
        detail={null}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={onBack}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    expect(screen.getByText('This instance was not found.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back to collection' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('offers the native Favorite action only for a caught Pokémon', () => {
    const onToggleFavorite = jest.fn();
    render(
      <NativeInstanceDetailScreen
        detail={{ ...detail, row: { ...detail.row, status: 'caught', favorite: false } }}
        isLoading={false}
        error={null}
        cachedAt={1234}
        movesWarning={null}
        saveNotice="Saved on this device."
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={onToggleFavorite}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Mark as Favorite' }));
    expect(onToggleFavorite).toHaveBeenCalledWith(true);
    expect(screen.getByText('Saved on this device.')).toBeTruthy();
    expect(screen.getByText('Viewing an offline copy')).toBeTruthy();
  });

  it('treats legacy zero weight and height values as missing metadata', async () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            weight: 0,
            height: 0,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
        onSaveDetails={jest.fn()}
      />,
    );

    expect(screen.queryByText('0kg')).toBeNull();
    expect(screen.queryByText('0m')).toBeNull();

    await openCaughtEditor();
    await waitFor(() => {
      expect(screen.getByLabelText('Pokémon weight').props.value).toBe('');
      expect(screen.getByLabelText('Pokémon height').props.value).toBe('');
    });
  });

  it('preserves the canonical animated previous and next overlay controls', async () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    const view = render(
      <NativeInstanceDetailScreen
        detail={detail}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Previous Pokémon' }));
    await waitFor(() => expect(onPrevious).toHaveBeenCalledTimes(1));

    view.rerender(
      <NativeInstanceDetailScreen
        detail={{ ...detail, row: { ...detail.row, id: 'instance-2' } }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'Next Pokémon' }).props.accessibilityState?.disabled,
    ).toBe(false));
    fireEvent.press(screen.getByRole('button', { name: 'Next Pokémon' }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it('keeps the full-bleed background outside the horizontally moving content layer', () => {
    render(
      <NativeInstanceDetailScreen
        detail={detail}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onPrevious={jest.fn()}
        onNext={jest.fn()}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    const motionLayer = screen.getByTestId('native-instance-motion-layer');
    expect(motionLayer.findAllByProps({ testID: 'native-instance-background' })).toHaveLength(0);
    expect(screen.getByTestId(
      'native-instance-background-layer',
      { includeHiddenElements: true },
    ).props.pointerEvents).toBe('none');
  });

  it('opens a configured target directly from the listing summary', () => {
    const onOpenTarget = jest.fn();
    render(
      <NativeInstanceDetailScreen
        detail={detail}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onOpenTarget={onOpenTarget}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Open Gigantamax Blastoise' }));
    expect(onOpenTarget).toHaveBeenCalledWith('wanted-1');
  });

  it('edits and saves caught instance details without leaving the native overlay', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: 'Charizard',
            cp: 2499,
            level: 40,
            gender: 'Male',
            weight: 90.5,
            height: 1.7,
            attack_iv: 15,
            defense_iv: 14,
            stamina_iv: 13,
            lucky: false,
            shadow: false,
            purified: false,
            is_traded: false,
            original_trainer_id: null,
            original_trainer_name: null,
            traded_date: null,
            pokeball: null,
            date_caught: '2026-08-23',
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    expect(screen.getByLabelText('Pokémon inline identity editor')).toBeTruthy();
    expect(screen.getByLabelText('Caught on 2026-08-23')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as Favorite' })).toBeTruthy();
    expect(screen.queryByText('NAME')).toBeNull();
    expect(screen.queryByText('GENDER')).toBeNull();
    expect(screen.queryByText('MOVES')).toBeNull();
    expect(screen.queryByText('APPRAISAL IVS')).toBeNull();
    expect(screen.getByText('CAUGHT')).toBeTruthy();
    expect(['#ef8582', '#9b2e2e']).toContain(
      StyleSheet.flatten(screen.getByLabelText('Attack IV').props.style).color,
    );
    fireEvent.changeText(screen.getByLabelText('Defense IV'), '99');
    expect(screen.getByLabelText('Defense IV').props.value).toBe('15');
    fireEvent.changeText(screen.getByLabelText('Pokémon nickname'), 'Fire Partner');
    fireEvent.changeText(screen.getByLabelText('Combat Power'), '2500');
    fireEvent.press(screen.getByRole('button', { name: 'LUCKY: YES' }));
    fireEvent.changeText(screen.getByLabelText('Original trainer name'), 'TradePartner');
    fireEvent.changeText(screen.getByLabelText('Traded date'), '2026-08-23');
    fireEvent.press(screen.getByRole('button', { name: 'Ball caught: BEAST BALL' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Pokémon detail editor')).toBeNull();
    });

    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      nickname: 'Fire Partner',
      cp: 2500,
      level: 40,
      gender: 'Male',
      attack_iv: 15,
      lucky: true,
      is_traded: true,
      original_trainer_name: 'TradePartner',
      traded_date: '2026-08-23',
      pokeball: 'beast_ball',
    }));
    expect(screen.queryByLabelText('Pokémon detail editor')).toBeNull();
  });

  it('keeps compact For Trade editing free of invented level-arc and type metadata', async () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: 'Festival spare',
            cp: 812,
            level: null,
            weight: null,
            height: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: {
            ...detail.row,
            typeIconUris: ['https://pokegonexus.com/images/types/electric.png'],
          },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );

    await openCaughtEditor();
    expect(screen.getByLabelText('Pokémon level').props.value).toBe('');
    expect(screen.getByLabelText('Pokémon level').props.placeholder).toBe('1-51 (0.5 steps)');
    expect(screen.queryByLabelText('Pokémon types: electric')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add second charged move' })).toBeTruthy();
    expect(screen.getByTestId('native-instance-target-list')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit preferences' })).toBeTruthy();
  });

  it('recalculates caught CP from level and IVs before saving', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          baseStats: { attack: 223, defense: 173, stamina: 186 },
          instance: {
            nickname: null,
            cp: 2867,
            level: 40,
            attack_iv: 15,
            defense_iv: 14,
            stamina_iv: 13,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught', cp: 2867 },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.changeText(screen.getByLabelText('Pokémon level'), '40.5');
    expect(screen.getByLabelText('Combat Power').props.value).toBe('2885');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      cp: 2885,
      level: 40.5,
      attack_iv: 15,
      defense_iv: 14,
      stamina_iv: 13,
    }));
  });

  it('keeps the editor open and explains invalid level increments', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          baseStats: { attack: 223, defense: 173, stamina: 186 },
          instance: {
            nickname: null,
            cp: 2867,
            level: 40,
            attack_iv: 15,
            defense_iv: 14,
            stamina_iv: 13,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught', cp: 2867 },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.changeText(screen.getByLabelText('Pokémon level'), '40.25');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).not.toHaveBeenCalled();
    expect(screen.getByText('Level must be 1–51 in 0.5 increments.')).toBeTruthy();
    expect(screen.getByLabelText('Pokémon detail editor')).toBeTruthy();
  });

  it('selects compatible moves and a location background inside the native editor', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            cp: 2499,
            level: 40,
            fast_move_id: null,
            charged_move1_id: null,
            charged_move2_id: null,
            location_card: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
          moveOptions: [
            { id: 101, name: 'Fire Spin', kind: 'fast', legacy: false, typeName: 'Fire' },
            { id: 102, name: 'Blast Burn', kind: 'charged', legacy: true, typeName: 'Fire' },
          ],
          backgroundOptions: [{
            id: 9,
            name: 'Vancouver City Safari',
            imageUri: 'https://pokegonexus.com/images/vancouver-location.png',
          }],
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Choose fast move' }));
    fireEvent.press(screen.getByRole('button', { name: 'Fire Spin' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose charged move' }));
    fireEvent.press(screen.getByRole('button', { name: 'Blast Burn' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose location background' }));
    fireEvent.press(screen.getByRole('button', { name: 'Use Vancouver City Safari background' }));
    const locationBackdropFrame = screen.getByTestId('native-instance-location-backdrop-frame');
    const locationBackdropStyle = StyleSheet.flatten(locationBackdropFrame.props.style);
    expect(locationBackdropStyle.left).toBe('50%');
    expect(locationBackdropStyle.transform).toEqual([
      { translateX: -locationBackdropStyle.width / 2 },
    ]);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Pokémon detail editor')).toBeNull();
    });

    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      fast_move_id: 101,
      charged_move1_id: 102,
      location_card: '9',
    }));
  });

  it('keeps Lucky and traded controls constrained for an unpurified Shadow Pokémon', async () => {
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            shadow: true,
            purified: false,
            lucky: false,
            is_traded: false,
            location_caught: 'Vancouver, BC',
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={jest.fn().mockResolvedValue(undefined)}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();

    expect(screen.queryByRole('button', { name: 'LUCKY: YES' })).toBeNull();
    expect(screen.getByRole('button', { name: 'TRADED: YES' })
      .props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Shadow Pokémon cannot be traded until purified.')).toBeTruthy();
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    });
    expect(mockGetNativeLocationSuggestions).not.toHaveBeenCalled();
  });

  it('purifies and restores a caught Shadow Pokémon with canonical trade invariants', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          appearanceImageUris: {
            shadow: 'https://pokegonexus.com/images/shadow-charizard.png',
            purified: 'https://pokegonexus.com/images/charizard.png',
          },
          instance: {
            nickname: null,
            shadow: true,
            purified: false,
            lucky: false,
            is_traded: false,
            costume_id: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Shadow state: Purified' }));
    expect(screen.getByLabelText('Purified')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'LUCKY: YES' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Shadow state: Shadow' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });

    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      shadow: true,
      purified: false,
      lucky: false,
      is_traded: false,
    }));
  });

  it('edits all three Max Move levels for an eligible instance', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            shadow: false,
            purified: false,
            costume_id: null,
            dynamax: true,
            gigantamax: false,
            max_attack: 1,
            max_guard: 0,
            max_spirit: 0,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught', maxKind: 'dynamax' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Open Max Move upgrades' }));
    fireEvent.press(screen.getByRole('button', { name: 'Max Attack: 3' }));
    fireEvent.press(screen.getByRole('button', { name: 'Max Guard: 2' }));
    fireEvent.press(screen.getByRole('button', { name: 'Max Spirit: 1' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });

    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      max_attack: 3,
      max_guard: 2,
      max_spirit: 1,
    }));
  });

  it('selects and clears native Mega forms while preserving Mega registration', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          appearanceImageUris: {
            base: 'https://pokegonexus.com/images/charizard.png',
            shadow: 'https://pokegonexus.com/images/shadow-charizard.png',
            purified: 'https://pokegonexus.com/images/charizard.png',
          },
          megaOptions: [
            {
              form: 'x',
              imageUri: 'https://pokegonexus.com/images/mega-x.png',
              label: 'Mega X',
              primal: false,
              typeIconUris: ['https://pokegonexus.com/images/types/fire.png'],
            },
            {
              form: 'y',
              imageUri: 'https://pokegonexus.com/images/mega-y.png',
              label: 'Mega Y',
              primal: false,
              typeIconUris: ['https://pokegonexus.com/images/types/dragon.png'],
            },
          ],
          instance: {
            nickname: null,
            shadow: false,
            purified: false,
            costume_id: null,
            mega: true,
            is_mega: false,
            mega_form: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: {
            ...detail.row,
            status: 'caught',
            typeIconUris: ['https://pokegonexus.com/images/types/fire.png'],
          },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Mega Evolve' }));
    });
    fireEvent.press(await screen.findByRole('button', { name: 'Change Mega form' }));
    expect(screen.getByLabelText('Pokémon types: dragon')).toBeTruthy();
    expect(screen.getByTestId('native-instance-types-dragon')).toBeTruthy();
    expect(screen.getByTestId(
      'native-instance-background',
      { includeHiddenElements: true },
    ).props.source[0].uri).toContain(
      '/images/backgrounds/bg_dragon.png',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Change Mega form' }));
    expect(screen.getByRole('button', { name: 'Mega Evolve' })).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      mega: true,
      is_mega: false,
      mega_form: null,
    }));
  });

  it('acknowledges Save immediately while persistence finishes', async () => {
    let finishSave: () => void = () => undefined;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const onSaveDetails = jest.fn(() => pendingSave);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: 'Charizard',
            shadow: false,
            purified: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));

    expect(onSaveDetails).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit Pokémon' })).toBeTruthy();
    expect(screen.queryByLabelText('Pokémon inline identity editor')).toBeNull();

    await act(async () => {
      finishSave();
      await pendingSave;
    });
  });

  it('suggests caught locations and saves the selected canonical display name', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    mockGetNativeLocationSuggestions.mockResolvedValue([
      {
        displayName: 'Burnaby, British Columbia, Canada',
        name: 'Burnaby',
        state_or_province: 'British Columbia',
        country: 'Canada',
      },
    ]);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            location_caught: null,
            shadow: false,
            purified: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.changeText(screen.getByLabelText('Caught location'), 'Burnaby');
    await waitFor(() => {
      expect(mockGetNativeLocationSuggestions).toHaveBeenCalledWith('Burnaby');
    });
    fireEvent.press(screen.getByRole('button', {
      name: 'Use location Burnaby, British Columbia, Canada',
    }));
    expect(screen.getByLabelText('Caught location').props.value).toBe(
      'Burnaby, British Columbia, Canada',
    );

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      location_caught: 'Burnaby, British Columbia, Canada',
    }));
  });

  it('keeps manual caught-location editing available when suggestions fail', async () => {
    mockGetNativeLocationSuggestions.mockRejectedValue(new Error('offline'));
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            location_caught: null,
            shadow: false,
            purified: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={jest.fn().mockResolvedValue(undefined)}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.changeText(screen.getByLabelText('Caught location'), 'Burnaby');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Location suggestions are unavailable. You can still enter a location manually.',
    );
    expect(screen.getByLabelText('Caught location').props.value).toBe('Burnaby');
  });

  it('does not let an older location response replace newer suggestions', async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof getNativeLocationSuggestions>>) => void = () => undefined;
    let resolveSecond: (value: Awaited<ReturnType<typeof getNativeLocationSuggestions>>) => void = () => undefined;
    const firstResponse = new Promise<Awaited<ReturnType<typeof getNativeLocationSuggestions>>>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<Awaited<ReturnType<typeof getNativeLocationSuggestions>>>((resolve) => {
      resolveSecond = resolve;
    });
    mockGetNativeLocationSuggestions
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            location_caught: null,
            shadow: false,
            purified: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={jest.fn().mockResolvedValue(undefined)}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.changeText(screen.getByLabelText('Caught location'), 'Burnab');
    await waitFor(() => expect(mockGetNativeLocationSuggestions).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByLabelText('Caught location'), 'Burnaby');
    await waitFor(() => expect(mockGetNativeLocationSuggestions).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond([{ displayName: 'Burnaby, British Columbia, Canada' }]);
      await secondResponse;
    });
    expect(screen.getByRole('button', {
      name: 'Use location Burnaby, British Columbia, Canada',
    })).toBeTruthy();

    await act(async () => {
      resolveFirst([{ displayName: 'Burnaby Lake, British Columbia, Canada' }]);
      await firstResponse;
    });
    expect(screen.queryByRole('button', {
      name: 'Use location Burnaby Lake, British Columbia, Canada',
    })).toBeNull();
    expect(screen.getByRole('button', {
      name: 'Use location Burnaby, British Columbia, Canada',
    })).toBeTruthy();
  });

  it('unlocks special Max Move editing when a Crowned form is selected', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          appearanceImageUris: {
            base: 'https://pokegonexus.com/images/zacian.png',
            shadow: null,
            purified: 'https://pokegonexus.com/images/zacian.png',
          },
          crownOptions: [{
            form: 'Crowned Sword',
            imageUri: 'https://pokegonexus.com/images/crowned-zacian.png',
            label: 'Crowned Sword',
          }],
          instance: {
            nickname: null,
            pokemon_id: 888,
            shadow: false,
            purified: false,
            costume_id: null,
            crown: false,
            max_attack: null,
            max_guard: null,
            max_spirit: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: { ...detail.row, pokemonId: 888, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    expect(screen.queryByText('Max Move Levels')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Power form: Crowned Sword' }));
    fireEvent.press(screen.getByRole('button', { name: 'Open Max Move upgrades' }));
    expect(screen.getByText('Max Move Levels')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Max Attack: 3' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      crown: true,
      fusion_form: 'Crowned Sword',
      max_attack: 3,
      max_guard: 0,
      max_spirit: 0,
    }));
  });

  it('selects a fusion partner, swaps to the fusion move pool, and saves the linked form', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    const partner = (id: string, name: string): NativeInstanceDetail['row'] => ({
      ...detail.row,
      id,
      pokemonId: 792,
      pokedexNumber: 792,
      name,
      status: 'caught',
    });
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          appearanceImageUris: {
            base: 'https://pokegonexus.com/images/necrozma.png',
            shadow: null,
            purified: 'https://pokegonexus.com/images/necrozma.png',
          },
          fusionOptions: [{
            id: 2,
            imageUri: 'https://pokegonexus.com/images/dawn-wings.png',
            moveOptions: [{
              id: 202,
              name: 'Moongeist Beam',
              kind: 'charged',
              legacy: false,
              typeName: 'Ghost',
            }],
            name: 'Dawn Wings Necrozma',
            partnerPokemonId: 792,
            partnerRows: [partner('lunala-1', 'Lunala One'), partner('lunala-2', 'Lunala Two')],
            backgroundOptions: [{
              id: 12,
              name: 'Fusion sky',
              imageUri: 'https://pokegonexus.com/images/fusion-location.png',
            }],
            partnerBackgroundIds: { 'lunala-1': 21, 'lunala-2': null },
            comboBackgrounds: [{
              ownBackgroundId: 12,
              partnerBackgroundId: 21,
              option: {
                id: 99,
                name: 'Combined sky',
                imageUri: 'https://pokegonexus.com/images/fusion-combo.png',
              },
            }],
          }],
          instance: {
            nickname: null,
            pokemon_id: 800,
            shadow: false,
            purified: false,
            costume_id: null,
            is_fused: false,
            fused_with: null,
            fusion_form: null,
            fusion: null,
            crown: false,
            mega: false,
            is_mega: false,
          } as NonNullable<NativeInstanceDetail['instance']>,
          moveOptions: [{
            id: 101,
            name: 'Metal Claw',
            kind: 'fast',
            legacy: false,
            typeName: 'Steel',
          }],
          row: { ...detail.row, pokemonId: 800, status: 'caught' },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Fuse Dawn Wings Necrozma' }));
    fireEvent.press(screen.getByTestId('native-fusion-partner-lunala-2'));
    fireEvent.press(screen.getByRole('button', { name: 'Fuse' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose location background' }));
    expect(screen.getByRole('button', { name: 'Use Fusion sky background' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Use Fusion sky background' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose charged move' }));
    expect(screen.getByText('Moongeist Beam')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Close charged move selector' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save Pokémon' }));
    });
    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      is_fused: true,
      fused_with: 'lunala-2',
      fusion_form: 'Dawn Wings Necrozma',
      fusion: { 2: true },
      location_card: '12',
    }));
  });

  it('saves five-heart, lucky, and Most Wanted conditions natively', async () => {
    const onSaveDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeInstanceDetailScreen
        detail={{
          ...detail,
          instance: {
            nickname: null,
            friendship_level: 4,
            pref_lucky: false,
            most_wanted: false,
            wanted_size_preferences: null,
          } as NonNullable<NativeInstanceDetail['instance']>,
          row: {
            ...detail.row,
            id: 'wanted-1',
            status: 'wanted',
            mostWanted: false,
          },
          sizeThresholds: {
            pokedex_height: 1,
            pokedex_weight: 10,
            height_standard_deviation: 0.1,
            weight_standard_deviation: 1,
            height_xxs_threshold: 1,
            height_xs_threshold: 2,
            height_xl_threshold: 3,
            height_xxl_threshold: 4,
            weight_xxs_threshold: 10,
            weight_xs_threshold: 20,
            weight_xl_threshold: 30,
            weight_xxl_threshold: 40,
          },
        }}
        isLoading={false}
        error={null}
        cachedAt={null}
        movesWarning={null}
        saveNotice={null}
        saveError={null}
        isSaving={false}
        onRetry={jest.fn()}
        onBack={jest.fn()}
        onSaveDetails={onSaveDetails}
        onToggleFavorite={jest.fn()}
        onEditInCurrentApp={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Edit wanted listing' }));
    expect(screen.getByLabelText('Friendship level')).toBeTruthy();
    expect(screen.getByLabelText('Wanted weight')).toBeTruthy();
    expect(screen.getByLabelText('Wanted height')).toBeTruthy();
    expect(screen.getByTestId('native-instance-target-list')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit preferences' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Set friendship to 5 hearts' }));
    fireEvent.press(screen.getByRole('button', { name: 'Lucky trade not requested' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mark as Most Wanted' }));
    fireEvent.press(screen.getByRole('button', { name: 'XXL weight' }));
    fireEvent.press(screen.getByRole('button', { name: 'XS height' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save wanted listing' }));
    });

    expect(onSaveDetails).toHaveBeenCalledWith(expect.objectContaining({
      friendship_level: 5,
      pref_lucky: true,
      most_wanted: true,
      wanted_size_preferences: {
        weight: {
          category: 'XXL',
          min: 40,
          max: null,
          min_inclusive: false,
          max_inclusive: false,
        },
        height: {
          category: 'XS',
          min: 1,
          max: 2,
          min_inclusive: true,
          max_inclusive: false,
        },
      },
    }));
  });
  const renderGenderEditor = (rate: string | null, gender: string | null, wanted = false) => render(
    <NativeInstanceDetailScreen detail={{ ...detail, genderRate: rate ?? undefined,
      row: { ...detail.row, status: wanted ? 'wanted' : 'caught' },
      instance: { gender, cp: 2499, level: 40, attack_iv: 15, defense_iv: 15, stamina_iv: 15 } as NonNullable<NativeInstanceDetail['instance']>,
      moveOptions: [{ id: 1, name: 'Fire Spin', kind: 'fast', legacy: false, typeName: 'Fire', typeIconUri: undefined, raidPower: 14, pvpPower: 9 }],
    }} isLoading={false} error={null} cachedAt={null} movesWarning={null}
      saveNotice={null} saveError={null} isSaving={false} onRetry={jest.fn()}
      onBack={jest.fn()} onToggleFavorite={jest.fn()} onSaveDetails={jest.fn()} />
  );

  it.each([
    ['0_0_100', 'Genderless'], ['100_0_0', 'Male'], ['0_100_0', 'Female'], [null, 'Unspecified'],
  ])('does not offer gender cycling for rate %s', async (rate, expected) => {
    renderGenderEditor(rate, null);
    await openCaughtEditor();
    expect(screen.queryByRole('button', { name: /^Gender:/ })).toBeNull();
    expect(screen.getByLabelText(`Gender: ${expected}`)).toBeDisabled();
  });

  it('cycles mixed-gender caught Pokémon between Male and Female without clearing the value', async () => {
    renderGenderEditor('87.5_12.5_0', 'Male');
    await openCaughtEditor();
    fireEvent.press(screen.getByRole('button', { name: 'Gender: Male' }));
    fireEvent.press(screen.getByRole('button', { name: 'Gender: Female' }));
    expect(screen.getByRole('button', { name: 'Gender: Male' })).toBeTruthy();
  });

  it('retains Any in the mixed-gender Wanted requirements cycle', async () => {
    renderGenderEditor('50_50_0', null, true);
    fireEvent.press(screen.getByRole('button', { name: 'Edit wanted listing' }));
    await waitFor(() => expect(screen.getByLabelText('Pokémon inline identity editor')).toBeTruthy());
    for (const value of ['Any', 'Male', 'Female']) fireEvent.press(screen.getByRole('button', { name: `Gender: ${value}` }));
    expect(screen.getByRole('button', { name: 'Gender: Any' })).toBeTruthy();
  });

  it('keeps Trainer Battles selected when opening the editor and slides both editor pages', async () => {
    renderGenderEditor('50_50_0', 'Male');
    fireEvent.press(screen.getByRole('tab', { name: 'TRAINER BATTLES' }));
    await openCaughtEditor();
    expect(screen.getByRole('tab', { name: 'TRAINER BATTLES' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Choose fast move' })).toHaveLength(1);
    expect(screen.getAllByTestId('native-move-selector-fast-move', { includeHiddenElements: true })).toHaveLength(2);
    fireEvent.press(screen.getByRole('tab', { name: 'GYMS & RAIDS' }));
    expect(screen.getByRole('tab', { name: 'GYMS & RAIDS' }).props.accessibilityState.selected).toBe(true);
  });

});
