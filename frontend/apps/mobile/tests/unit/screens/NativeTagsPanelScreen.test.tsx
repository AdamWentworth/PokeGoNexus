import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Image, Platform } from 'react-native';
import { beginNativeUiInteraction } from '../../../src/interaction/nativeUiInteractionScheduler';
import {
  NATIVE_TAG_PREVIEW_REVEAL_BATCH,
  NATIVE_TAG_PREVIEW_PRESS_DELAY_MS,
  NativeTagsPanelScreen,
} from '../../../src/screens/NativeTagsPanelScreen';

const tag = {
  key: 'custom:purple-tag' as const,
  parent: 'caught' as const,
  name: 'Shadow Shinies',
  color: '#7c3aed',
  tone: 'custom' as const,
  rows: [{
    id: 'instance-1',
    pokemonId: 6,
    pokedexNumber: 6,
    name: 'Shiny Shadow Charizard',
    imageUri: 'https://pokegonexus.com/images/charizard.png',
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'caught' as const,
    source: 'instance' as const,
    cp: 2500,
    favorite: false,
    mostWanted: false,
  }],
};

const maxTag = {
  ...tag,
  key: 'system:trade' as const,
  name: 'Trade',
  color: '#3aa85f',
  tone: 'trade' as const,
  rows: [{
    ...tag.rows[0],
    id: 'instance-gigantamax',
    maxKind: 'gigantamax' as const,
  }],
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('NativeTagsPanelScreen', () => {
  it('renders real tag membership and returns the selected tag to the Pokémon grid', () => {
    const onSelectTag = jest.fn();
    const onPreviewTag = jest.fn();
    const onCancelPreviewTag = jest.fn();
    const onViewChange = jest.fn();
    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={2500}
        error={null}
        isLoading={false}
        onActionMenuPress={jest.fn()}
        onRetry={jest.fn()}
        onSelectTag={onSelectTag}
        onPreviewTag={onPreviewTag}
        onCancelPreviewTag={onCancelPreviewTag}
        onViewChange={onViewChange}
        parent="caught"
        tags={[tag]}
      />,
    );

    expect(screen.getByText('Shadow Shinies')).toBeTruthy();
    expect(screen.getByText('1 Pokémon have this tag.')).toBeTruthy();
    const openTag = screen.getByRole('button', { name: /Open Shadow Shinies/i });
    // Vite does not alpha-fade the image-heavy tag card on touch. Keeping the
    // native Pressable free of an opacity style avoids an Android offscreen
    // alpha-compositing pass on the exact frame that starts page motion.
    expect(openTag.props.style).toBeUndefined();
    expect(screen.UNSAFE_getByProps({
      unstable_pressDelay: NATIVE_TAG_PREVIEW_PRESS_DELAY_MS,
    })).toBeTruthy();
    fireEvent(openTag, 'pressIn');
    expect(onPreviewTag).toHaveBeenCalledWith(tag);
    fireEvent(openTag, 'pressOut');
    expect(onCancelPreviewTag).toHaveBeenCalledWith(tag);
    fireEvent.press(openTag);
    expect(onSelectTag).toHaveBeenCalledWith(tag);
    fireEvent.press(screen.getByRole('tab', { name: /wishlist/i }));
    expect(onViewChange).toHaveBeenCalledWith('wishlist');
  });

  it('keeps tag previews aligned with the web cards and preserves Max badges', () => {
    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={1}
        error={null}
        isLoading={false}
        onActionMenuPress={jest.fn()}
        onRetry={jest.fn()}
        onSelectTag={jest.fn()}
        onViewChange={jest.fn()}
        parent="caught"
        tags={[maxTag]}
      />,
    );

    expect(screen.getByLabelText('Inventory tags')).toBeTruthy();
    expect(screen.getByText('1 Pokémon')).toBeTruthy();
    expect(screen.getByLabelText('Open Trade, 1 Pokémon')).toBeTruthy();
    expect(screen.getByTestId('native-tag-gradient-system-trade')).toBeTruthy();
    expect(screen.queryByTestId(
      'native-tag-preview-gigantamax',
      { includeHiddenElements: true },
    )).toBeNull();
    act(() => jest.advanceTimersByTime(1_500));
    expect(screen.getByTestId(
      'native-tag-preview-gigantamax',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.queryByText('Inventory tags')).toBeNull();
    expect(screen.queryByText('›')).toBeNull();
  });

  it('admits retained tag-preview bitmaps one per Android frame', () => {
    expect(NATIVE_TAG_PREVIEW_REVEAL_BATCH).toBe(1);
    const rows = Array.from({ length: 3 }, (_, index) => ({
      ...maxTag.rows[0],
      id: `instance-${index + 1}`,
      imageUri: `https://pokegonexus.com/images/pokemon-${index + 1}.png`,
      maxKind: null,
    }));

    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={3}
        error={null}
        isActive={false}
        isLoading={false}
        onRetry={jest.fn()}
        onSelectTag={jest.fn()}
        onViewChange={jest.fn()}
        parent="caught"
        tags={[{ ...maxTag, rows }]}
      />,
    );

    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    act(() => jest.advanceTimersByTime(1_201));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(1);
    act(() => jest.advanceTimersByTime(17));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(2);
    act(() => jest.advanceTimersByTime(17));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(3);
  });

  const previewProps = {
    activeTagName: null,
    assetBaseUrl: 'https://pokegonexus.com',
    collectionCount: 3,
    error: null,
    isLoading: false,
    onRetry: jest.fn(),
    onSelectTag: jest.fn(),
    onViewChange: jest.fn(),
    parent: 'caught' as const,
  };

  it('starts visible previews immediately and skips empty cards and missing artwork', () => {
    render(<NativeTagsPanelScreen {...previewProps} tags={[
      { ...maxTag, rows: [] },
      { ...tag, rows: [{ ...tag.rows[0], id: 'missing-artwork', imageUri: null }, ...tag.rows] },
    ]} />);

    expect(screen.getByLabelText('Open Shadow Shinies, 2 Pokémon')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(1);
  });

  it('keeps revealed thumbnails when another tag is added', () => {
    const { rerender } = render(<NativeTagsPanelScreen {...previewProps} tags={[tag]} />);
    act(() => jest.advanceTimersByTime(1));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(1);

    rerender(<NativeTagsPanelScreen {...previewProps} tags={[tag, {
      ...maxTag, rows: [{ ...maxTag.rows[0], maxKind: null }],
    }]} />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(1);
    act(() => jest.advanceTimersByTime(1));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(2);
  });

  it('promotes a background panel when selected while respecting page motion', () => {
    const { rerender } = render(
      <NativeTagsPanelScreen {...previewProps} isActive={false} tags={[tag]} />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    const release = beginNativeUiInteraction();
    try {
      rerender(<NativeTagsPanelScreen {...previewProps} isActive tags={[tag]} />);
      act(() => jest.advanceTimersByTime(100));
      expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
      act(() => {
        release();
        jest.advanceTimersByTime(1);
      });
      expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(1);
    } finally {
      release();
    }
  });

  it('lets the browser schedule all preview images without native delays', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const rows = Array.from({ length: 3 }, (_, index) => ({
      ...tag.rows[0], id: `web-instance-${index}`,
    }));
    render(<NativeTagsPanelScreen {...previewProps} isActive={false} tags={[{ ...tag, rows }]} />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(3);
  });

  it('warms Vite\'s hidden preview sources without mounting extra native images', () => {
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    const rows = Array.from({ length: 18 }, (_, index) => ({
      ...tag.rows[0],
      id: `instance-${index + 1}`,
      imageUri: `https://pokegonexus.com/images/pokemon-${index + 1}.png`,
      typeIconUris: [
        'https://pokegonexus.com/images/types/fire-prefetch-test.png',
        'https://pokegonexus.com/images/types/flying-prefetch-test.png',
      ],
    }));

    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={18}
        error={null}
        isLoading={false}
        onRetry={jest.fn()}
        onSelectTag={jest.fn()}
        onViewChange={jest.fn()}
        parent="caught"
        tags={[{ ...tag, rows }]}
      />,
    );

    expect(prefetch.mock.calls.map(([uri]) => uri)).toEqual(
      [
        ...rows.slice(12).map((row) => row.imageUri),
        ...rows[0].typeIconUris,
      ],
    );
    prefetch.mockRestore();
  });

  it('provides the canonical arrange workflow', async () => {
    const onCreateTag = jest.fn().mockResolvedValue(undefined);
    const onDeleteTag = jest.fn().mockResolvedValue(undefined);
    const onSaveOrder = jest.fn().mockResolvedValue(undefined);
    const onUpdateTag = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={1}
        error={null}
        isEditable
        isLoading={false}
        onActionMenuPress={jest.fn()}
        onCreateTag={onCreateTag}
        onDeleteTag={onDeleteTag}
        onRetry={jest.fn()}
        onSaveOrder={onSaveOrder}
        onSelectTag={jest.fn()}
        onUpdateTag={onUpdateTag}
        onViewChange={jest.fn()}
        parent="caught"
        tags={[maxTag, tag]}
      />,
    );

    expect(screen.getByRole('button', { name: 'New inventory tag' })).toBeTruthy();
    fireEvent.press(screen.getByText('↕ Arrange'));
    expect(screen.getByLabelText('Reorder Trade, position 1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Reorder Shadow Shinies, position 2 of 2')).toBeTruthy();
    fireEvent(
      screen.getByLabelText('Reorder Trade, position 1 of 2'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    fireEvent.press(screen.getByText('✓ Save order'));
    await act(async () => Promise.resolve());
    expect(onSaveOrder).toHaveBeenCalledWith('caught', ['custom:purple-tag', 'system:trade']);
  });

  it('provides the canonical custom-tag editor workflow', async () => {
    const onUpdateTag = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeTagsPanelScreen
        activeTagName={null}
        assetBaseUrl="https://pokegonexus.com"
        collectionCount={1}
        error={null}
        isEditable
        isLoading={false}
        onActionMenuPress={jest.fn()}
        onCreateTag={jest.fn().mockResolvedValue(undefined)}
        onDeleteTag={jest.fn().mockResolvedValue(undefined)}
        onRetry={jest.fn()}
        onSaveOrder={jest.fn().mockResolvedValue(undefined)}
        onSelectTag={jest.fn()}
        onUpdateTag={onUpdateTag}
        onViewChange={jest.fn()}
        parent="caught"
        tags={[tag]}
      />,
    );

    fireEvent.press(screen.getByText('Edit'));
    expect(screen.getByText('Edit tag')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Tag name'), 'Shadow favorites');
    fireEvent.press(screen.getByText('Save changes'));
    await act(async () => Promise.resolve());
    expect(onUpdateTag).toHaveBeenCalledWith('purple-tag', {
      color: '#7c3aed',
      name: 'Shadow favorites',
    });
  });
});
