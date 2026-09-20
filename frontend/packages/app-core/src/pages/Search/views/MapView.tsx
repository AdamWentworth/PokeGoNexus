import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useNavigate } from 'react-router';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import { createMapTileSource } from '@/utils/createMapTileSource';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Overlay from 'ol/Overlay';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { getCenter } from 'ol/extent';
import { buffer as bufferExtent } from 'ol/extent';
import { WKT } from 'ol/format';

import { useTheme } from '../../../contexts/ThemeContext';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { normalizeOwnershipMode } from '../utils/ownershipMode';
import { findVariantForInstance } from '../utils/findVariantForInstance';
import { createScopedLogger } from '@/utils/logger';
import { buildPokemonCatalogPath } from '@/pages/Pokemon/utils/pokemonCatalogNavigation';
import CaughtPopup from './MapViewComponents/CaughtPopup';
import TradePopup from './MapViewComponents/TradePopup';
import WantedPopup from './MapViewComponents/WantedPopup';
import './MapView.css';

const log = createScopedLogger('MapView');

const ownershipColors = {
  caught: '#2196f3',
  trade: '#31b777',
  wanted: '#ff5965',
} as const;

type MapDataItem = {
  longitude?: number | string | null;
  latitude?: number | string | null;
  boundary?: string | null;
  [key: string]: unknown;
};

type MapViewProps = {
  data: MapDataItem[];
  instanceData: 'caught' | 'trade' | 'wanted' | string;
  pokemonCache: PokemonVariant[] | null;
  hasSearched?: boolean;
};

type FeatureLike = {
  getProperties: () => {
    item?: MapDataItem;
    geometry?: {
      getType: () => string;
    };
  };
  getGeometry: () => {
    getCoordinates: () => number[];
  };
};

const MapView: React.FC<MapViewProps> = ({
  data,
  instanceData,
  pokemonCache,
  hasSearched = true,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const { isLightMode } = useTheme();
  const navigate = useNavigate();
  const pokemonVariants = useMemo<PokemonVariant[]>(
    () => pokemonCache ?? [],
    [pokemonCache],
  );

  const ownershipMode = normalizeOwnershipMode(
    instanceData as Parameters<typeof normalizeOwnershipMode>[0],
  );

  const findPokemonByKey = useCallback(
    (
      keyOrInstanceId?: string | null,
      instanceLike?: Parameters<typeof findVariantForInstance>[2],
    ) => findVariantForInstance(pokemonVariants, keyOrInstanceId, instanceLike),
    [pokemonVariants],
  );

  const navigateToUserCatalog = useCallback(
    (
      username: string,
      instanceId: string,
      selectedInstanceData: string,
    ) => {
      navigate(
        buildPokemonCatalogPath({
          username,
          filter: selectedInstanceData as 'Caught' | 'Trade' | 'Wanted',
        }),
        {
          state: {
            instanceId,
            instanceData: selectedInstanceData,
            contextBackTo: '/search',
          },
        },
      );
    },
    [navigate],
  );

  const navigateToUserProfile = useCallback(
    (username: string) => {
      navigate(`/profile/${encodeURIComponent(username)}`, {
        state: { contextBackTo: '/search' },
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (!data.length) return;

    const vectorSource = new VectorSource();
    const wktFormat = new WKT();

    data.forEach((item) => {
      const { longitude, latitude, boundary } = item;

      if (longitude != null && latitude != null) {
        const coordinates = fromLonLat([
          parseFloat(String(longitude)),
          parseFloat(String(latitude)),
        ]);

        const pointColor = ownershipColors[ownershipMode];

        const pointFeature = new Feature({
          geometry: new Point(coordinates),
          item,
        });

        pointFeature.setStyle(
          new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({ color: pointColor }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        );
        vectorSource.addFeature(pointFeature);
      }

      if (boundary) {
        const polygonFeature = wktFormat.readFeature(boundary, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        const boundaryColor = ownershipColors[ownershipMode];

        polygonFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color: boundaryColor,
              width: 2,
            }),
            fill: new Fill({
              color: 'rgba(0, 0, 0, 0)',
            }),
          }),
        );

        vectorSource.addFeature(polygonFeature);
      }
    });

    const extent = vectorSource.getExtent();
    if (!extent) {
      return;
    }
    const paddedExtent = bufferExtent(
      extent,
      Math.max(extent[2] - extent[0], extent[3] - extent[1]) * 0.25,
    );

    const baseTileLayer = new TileLayer({
      source: createMapTileSource(isLightMode),
    });

    const map = new Map({
      target: mapContainer.current ?? undefined,
      layers: [
        baseTileLayer,
        new VectorLayer({
          source: vectorSource,
        }),
      ],
      view: new View({
        center: getCenter(paddedExtent),
        zoom: 10,
        minZoom: 5,
      }),
    });

    map.getView().fit(paddedExtent, {
      padding: [20, 20, 20, 20],
      maxZoom: 15,
      duration: 1000,
    });

    const popupOverlay = new Overlay({
      element: popupRef.current ?? undefined,
      stopEvent: true,
      autoPan: {
        animation: { duration: 200 },
        margin: 16,
      },
    });
    map.addOverlay(popupOverlay);

    if (popupRef.current && !popupRootRef.current) {
      popupRootRef.current = createRoot(popupRef.current);
    }

    map.on('click', (event: { pixel: number[] }) => {
      let featureFound = false;

      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const typedFeature = feature as unknown as FeatureLike;
        const { item: featureItem, geometry } = typedFeature.getProperties();

        if (geometry && geometry.getType() === 'Point' && featureItem) {
          featureFound = true;

          let PopupComponent = CaughtPopup as React.ComponentType<Record<string, unknown>>;
          if (ownershipMode === 'trade') {
            PopupComponent = TradePopup as React.ComponentType<Record<string, unknown>>;
          } else if (ownershipMode === 'wanted') {
            PopupComponent = WantedPopup as React.ComponentType<Record<string, unknown>>;
          }

          if (pokemonVariants.length > 0 && popupRootRef.current) {
            popupRootRef.current.render(
              <PopupComponent
                item={featureItem}
                navigateToUserCatalog={navigateToUserCatalog}
                navigateToUserProfile={navigateToUserProfile}
                findPokemonByKey={findPokemonByKey}
                onClose={() => {
                  popupOverlay.setPosition(undefined);
                  popupRootRef.current?.render(null);
                }}
              />,
            );
          } else {
            log.warn('pokemonVariants not yet populated, skipping popup render');
          }

          const featureCoordinate = typedFeature.getGeometry().getCoordinates();
          const mapSize = map.getSize() ?? [0, 0];
          const viewportCenterY = mapSize[1] / 2;
          const clickY = event.pixel?.[1] ?? 0;

          const positioning =
            clickY > viewportCenterY ? 'bottom-center' : 'top-center';

          popupOverlay.setPositioning(positioning);
          popupOverlay.setPosition(featureCoordinate);
        }
      });

      if (!featureFound) {
        popupOverlay.setPosition(undefined);
        popupRootRef.current?.render(null);
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
      }
    };
  }, [
    data,
    findPokemonByKey,
    isLightMode,
    navigateToUserCatalog,
    navigateToUserProfile,
    ownershipMode,
    pokemonVariants,
  ]);

  if (!data.length) {
    return (
      <section className="search-map-shell search-map-shell--empty">
        <div className="search-map-empty">
          <span aria-hidden="true">⌖</span>
          <h2>{hasSearched ? 'No locations to map' : 'Map nearby results'}</h2>
          <p>
            {hasSearched
              ? 'Try widening your distance or adjusting the active filters.'
              : 'Run a Pokémon search, then use Map to explore where the results are.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="search-map-shell">
      <header className="search-map-header">
        <div>
          <span>Map results</span>
          <h2>
            {data.length} {data.length === 1 ? 'location' : 'locations'}
          </h2>
        </div>
        <p>Select a marker to preview its listing.</p>
      </header>
      <div
        aria-label="Pokémon search result map"
        className="search-map-canvas"
        ref={mapContainer}
        role="application"
      />
      <div ref={popupRef} className="ol-popup" />
    </section>
  );
};

export default React.memo(MapView);
