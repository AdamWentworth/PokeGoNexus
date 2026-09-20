import React, { useEffect, useRef, useState } from 'react';
import { FaCrosshairs, FaMapMarkerAlt } from 'react-icons/fa';

import { fetchSuggestions } from '@/services/locationServices';
import { createScopedLogger } from '@/utils/logger';
import type { LocationSuggestion } from '@/types/location';
import { getStoredLocation } from '@/utils/storage';
import './LocationSearch.css';

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

type ViewMode = 'list' | 'map';

type SuggestionWithCoordinates = LocationSuggestion & {
  latitude?: number | string | null;
  longitude?: number | string | null;
  boundary?: string | null;
};

type LocationSearchProps = {
  city: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  useCurrentLocation: boolean;
  setUseCurrentLocation: React.Dispatch<React.SetStateAction<boolean>>;
  setCoordinates: React.Dispatch<React.SetStateAction<Coordinates>>;
  range: number;
  setRange: React.Dispatch<React.SetStateAction<number>>;
  resultsLimit: number;
  setResultsLimit: React.Dispatch<React.SetStateAction<number>>;
  handleSearch: () => void | Promise<void>;
  isLoading: boolean;
  view: ViewMode;
  setView: React.Dispatch<React.SetStateAction<ViewMode>>;
  setSelectedBoundary?: React.Dispatch<React.SetStateAction<string | null>>;
  showSearchButton?: boolean;
};

const log = createScopedLogger('LocationSearch');

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const LocationSearch: React.FC<LocationSearchProps> = ({
  city,
  setCity,
  useCurrentLocation,
  setUseCurrentLocation,
  setCoordinates,
  range,
  setRange,
  resultsLimit,
  setResultsLimit,
  handleSearch,
  isLoading,
  view: _view,
  setView: _setView,
  setSelectedBoundary,
  showSearchButton = true,
}) => {
  const [suggestions, setSuggestions] = useState<SuggestionWithCoordinates[]>([]);
  const [locationError, setLocationError] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleLocationChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const userInput = event.target.value;
    setCity(userInput);
    setCoordinates({ latitude: null, longitude: null });
    setLocationError('');

    if (userInput.length <= 2) {
      setSuggestions([]);
      return;
    }

    const fetchedSuggestions = await fetchSuggestions(userInput);
    setSuggestions(fetchedSuggestions as SuggestionWithCoordinates[]);
  };

  const selectSuggestion = (suggestion: SuggestionWithCoordinates) => {
    setCity(suggestion.displayName);
    setLocationError('');

    const latitude = toNumberOrNull(suggestion.latitude);
    const longitude = toNumberOrNull(suggestion.longitude);

    setCoordinates({ latitude, longitude });

    if (typeof setSelectedBoundary === 'function') {
      setSelectedBoundary(suggestion.boundary ?? null);
    }

    setSuggestions([]);
  };

  const toggleUseCurrentLocation = () => {
    const nextUseCurrentLocation = !useCurrentLocation;

    if (nextUseCurrentLocation) {
      const storedLocation = getStoredLocation();
      if (!storedLocation) {
        log.warn('No location found in localStorage');
        setLocationError(
          'No saved location is available. Search for a city instead.',
        );
        return;
      }

      const latitude = toNumberOrNull(storedLocation.latitude);
      const longitude = toNumberOrNull(storedLocation.longitude);

      setUseCurrentLocation(true);
      setLocationError('');
      setCity('');
      setSuggestions([]);
      setCoordinates({ latitude, longitude });
      log.debug(
        `Using current location: Latitude ${latitude}, Longitude ${longitude}`,
      );

      return;
    }

    setUseCurrentLocation(false);
    setLocationError('');
    setCoordinates({ latitude: null, longitude: null });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !wrapperRef.current.contains(target)) {
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRange(Number(event.target.value));
  };

  const handleResultsLimitChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setResultsLimit(Number.parseInt(event.target.value, 10));
  };

  return (
    <div className="search-filter-panel location-search" ref={wrapperRef}>
      <header className="search-filter-panel__intro">
        <div>
          <span>Search area</span>
          <h3>Where should we look?</h3>
          <p>Use your saved location or search around another city.</p>
        </div>
      </header>

      <section className="search-filter-card location-source-card">
        <div className="search-filter-card__heading">
          <div>
            <h4>Starting point</h4>
            <p>Your exact coordinates are never shown in search results.</p>
          </div>
        </div>

        <button
          aria-pressed={useCurrentLocation}
          className="location-current-button"
          onClick={toggleUseCurrentLocation}
          type="button"
        >
          <FaCrosshairs aria-hidden="true" />
          <span>
            <strong>
              {useCurrentLocation ? 'Using saved location' : 'Use saved location'}
            </strong>
            <small>Search from the location stored in your profile</small>
          </span>
        </button>

        <div className="location-divider"><span>or choose another area</span></div>

        <label className="location-input-label">
          <span>City or place</span>
          <div className="location-input">
            <FaMapMarkerAlt aria-hidden="true" />
            <input
              autoComplete="off"
              type="text"
              value={city}
              onChange={handleLocationChange}
              disabled={useCurrentLocation}
              placeholder="Search for a city"
            />
            {suggestions.length > 0 && (
              <ul className="suggestions" aria-label="Location suggestions">
                {suggestions.map((suggestion) => (
                  <li
                    key={`${suggestion.displayName}-${suggestion.latitude ?? 'na'}-${suggestion.longitude ?? 'na'}`}
                  >
                    <button
                      className="suggestion-item"
                      onClick={() => selectSuggestion(suggestion)}
                      type="button"
                    >
                      <FaMapMarkerAlt aria-hidden="true" />
                      {suggestion.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
        {locationError ? (
          <p className="location-error" role="status">{locationError}</p>
        ) : null}
      </section>

      <section className="search-filter-card location-distance-card">
        <div className="search-filter-card__heading">
          <div>
            <h4>Distance and results</h4>
            <p>Balance nearby relevance with the number of listings returned.</p>
          </div>
        </div>
        <div className="location-slider-grid">
          <label className="location-slider-field">
            <span>Search radius <output>{range} km</output></span>
          <input
            aria-label="Search radius"
            type="range"
            min="1"
            max="25"
            step="1"
            value={range}
            onChange={handleRangeChange}
          />
            <small><span>1 km</span><span>25 km</span></small>
          </label>

          <label className="location-slider-field">
            <span>Maximum results <output>{resultsLimit}</output></span>
          <input
            aria-label="Maximum results"
            type="range"
            min="5"
            max="100"
            step="5"
            value={resultsLimit}
            onChange={handleResultsLimitChange}
          />
            <small><span>5</span><span>100</span></small>
          </label>
        </div>
      </section>

      {showSearchButton ? (
        <div className="location-search-button">
          <button type="button" onClick={handleSearch} disabled={isLoading}>
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default LocationSearch;
