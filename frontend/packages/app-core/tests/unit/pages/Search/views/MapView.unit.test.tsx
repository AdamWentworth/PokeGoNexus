import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import MapView from '@/pages/Search/views/MapView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { PokemonVariant } from '@/types/pokemonVariants';

const { mapInstances, overlayInstances } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    featureAtPixel: unknown;
    setFeatureAtPixel: (feature: unknown) => void;
    triggerClick: (pixel?: number[]) => void;
    setTarget: Mock<(...args: unknown[]) => void>;
    getSize: () => [number, number];
    getView: () => { fit: Mock<(...args: unknown[]) => void> };
  }>,
  overlayInstances: [] as Array<{
    setPositioning: Mock<(...args: unknown[]) => void>;
    setPosition: Mock<(...args: unknown[]) => void>;
  }>,
}));

const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>(
    'react-router',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/pages/Search/views/MapViewComponents/CaughtPopup', () => ({
  default: ({ item }: { item?: { instance_id?: string } }) => (
    <div data-testid="popup-caught">{item?.instance_id}</div>
  ),
}));

vi.mock('@/pages/Search/views/MapViewComponents/TradePopup', () => ({
  default: ({ item }: { item?: { instance_id?: string } }) => (
    <div data-testid="popup-trade">{item?.instance_id}</div>
  ),
}));

vi.mock('@/pages/Search/views/MapViewComponents/WantedPopup', () => ({
  default: ({ item }: { item?: { instance_id?: string } }) => (
    <div data-testid="popup-wanted">{item?.instance_id}</div>
  ),
}));

vi.mock('ol/proj', () => ({
  fromLonLat: (coords: number[]) => coords,
}));

vi.mock('ol/extent', () => ({
  getCenter: () => [5, 5],
  buffer: (extent: number[]) => extent,
}));

vi.mock('ol/source/Vector', () => ({
  default: class MockVectorSource {
    features: unknown[] = [];

    addFeature(feature: unknown) {
      this.features.push(feature);
    }

    getExtent() {
      return [0, 0, 10, 10];
    }
  },
}));

vi.mock('ol/Feature', () => ({
  default: class MockFeature {
    properties: Record<string, unknown>;

    constructor(properties: Record<string, unknown>) {
      this.properties = properties;
    }

    setStyle() {}
  },
}));

vi.mock('ol/geom/Point', () => ({
  default: class MockPoint {
    constructor(_coordinates: number[]) {}
  },
}));

vi.mock('ol/Overlay', () => ({
  default: class MockOverlay {
    setPositioning = vi.fn<(...args: unknown[]) => void>();
    setPosition = vi.fn<(...args: unknown[]) => void>();

    constructor() {
      overlayInstances.push(this);
    }
  },
}));

vi.mock('ol/style', () => ({
  Style: class MockStyle {
    constructor(_args?: unknown) {}
  },
  Circle: class MockCircle {
    constructor(_args?: unknown) {}
  },
  Fill: class MockFill {
    constructor(_args?: unknown) {}
  },
  Stroke: class MockStroke {
    constructor(_args?: unknown) {}
  },
}));

vi.mock('ol/layer/Tile', () => ({
  default: class MockTileLayer {
    constructor(_args?: unknown) {}
  },
}));

vi.mock('ol/source/XYZ', () => ({
  default: class MockXYZ {
    constructor(_args?: unknown) {}
  },
}));

vi.mock('ol/layer/Vector', () => ({
  default: class MockVectorLayer {
    constructor(_args?: unknown) {}
  },
}));

vi.mock('ol/View', () => ({
  default: class MockView {
    fit = vi.fn<(...args: unknown[]) => void>();

    constructor(_args?: unknown) {}
  },
}));

vi.mock('ol/format', () => ({
  WKT: class MockWKT {
    readFeature() {
      return {
        setStyle: vi.fn(),
      };
    }
  },
}));

vi.mock('ol/Map', () => ({
  default: class MockMap {
    featureAtPixel: unknown = null;
    clickHandler: ((event: { pixel: number[] }) => void) | null = null;
    setTarget = vi.fn<(...args: unknown[]) => void>();
    view = { fit: vi.fn<(...args: unknown[]) => void>() };

    constructor(args: { view?: { fit: Mock<(...args: unknown[]) => void> } } = {}) {
      this.view = args.view ?? this.view;
      mapInstances.push(this);
    }

    addOverlay() {}

    on(eventName: string, callback: (event: { pixel: number[] }) => void) {
      if (eventName === 'click') {
        this.clickHandler = callback;
      }
    }

    forEachFeatureAtPixel(
      _pixel: number[],
      callback: (feature: unknown) => void,
    ) {
      if (this.featureAtPixel) {
        callback(this.featureAtPixel);
      }
    }

    setFeatureAtPixel(feature: unknown) {
      this.featureAtPixel = feature;
    }

    triggerClick(pixel: number[] = [20, 20]) {
      this.clickHandler?.({ pixel });
    }

    getSize(): [number, number] {
      return [100, 100];
    }

    getView() {
      return this.view;
    }
  },
}));

const createPointFeature = (item: Record<string, unknown>) => ({
  getProperties: () => ({
    item,
    geometry: {
      getType: () => 'Point',
    },
  }),
  getGeometry: () => ({
    getCoordinates: () => [1, 2],
  }),
});

const baseData = [
  {
    username: 'ash',
    instance_id: 'inst-1',
    latitude: '1',
    longitude: '2',
  },
];

const pokemonCache: PokemonVariant[] = [{} as PokemonVariant];

const renderMapView = (instanceData: 'caught' | 'trade' | 'wanted') =>
  render(
    <ThemeProvider>
      <MapView data={baseData} instanceData={instanceData} pokemonCache={pokemonCache} />
    </ThemeProvider>,
  );

const getLatestMap = async () => {
  await waitFor(() => {
    expect(mapInstances.length).toBeGreaterThan(0);
  });
  return mapInstances[mapInstances.length - 1];
};

describe('MapView', () => {
  beforeEach(() => {
    mapInstances.length = 0;
    overlayInstances.length = 0;
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders trade popup when trade point is clicked', async () => {
    renderMapView('trade');

    const map = await getLatestMap();
    map.setFeatureAtPixel(createPointFeature(baseData[0]));

    await act(async () => {
      map.triggerClick([10, 90]);
    });

    expect(screen.getByTestId('popup-trade')).toBeInTheDocument();
    expect(screen.getByText('inst-1')).toBeInTheDocument();
  });

  it('renders a useful empty map state before and after a search', () => {
    const { rerender } = render(
      <ThemeProvider>
        <MapView
          data={[]}
          hasSearched={false}
          instanceData="caught"
          pokemonCache={pokemonCache}
        />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Map nearby results' }),
    ).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <MapView
          data={[]}
          hasSearched
          instanceData="caught"
          pokemonCache={pokemonCache}
        />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'No locations to map' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/widening your distance/i)).toBeInTheDocument();
  });

  it('renders wanted popup when wanted point is clicked', async () => {
    renderMapView('wanted');

    const map = await getLatestMap();
    map.setFeatureAtPixel(createPointFeature(baseData[0]));

    await act(async () => {
      map.triggerClick([10, 90]);
    });

    expect(screen.getByTestId('popup-wanted')).toBeInTheDocument();
  });

  it('renders caught popup and clears popup when clicking empty map area', async () => {
    renderMapView('caught');

    const map = await getLatestMap();
    map.setFeatureAtPixel(createPointFeature(baseData[0]));

    await act(async () => {
      map.triggerClick([10, 10]);
    });
    expect(screen.getByTestId('popup-caught')).toBeInTheDocument();

    map.setFeatureAtPixel(null);
    await act(async () => {
      map.triggerClick([10, 10]);
    });

    expect(screen.queryByTestId('popup-caught')).not.toBeInTheDocument();
  });

  it('cleans up map target on unmount', () => {
    const { unmount } = renderMapView('trade');

    const map = mapInstances[mapInstances.length - 1];
    unmount();

    expect(map.setTarget).toHaveBeenCalledWith(undefined);
  });
});
