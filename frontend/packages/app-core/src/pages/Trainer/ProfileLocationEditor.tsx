import { useEffect, useId, useRef, useState } from 'react';
import { FaCrosshairs } from 'react-icons/fa';

import { fetchLocationOptions, fetchSuggestions } from '@/services/locationServices';
import type { LocationSuggestion } from '@/types/location';
import './ProfileLocationEditor.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const ProfileLocationEditor = ({ value, onChange, disabled = false }: Props) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const helpId = useId();

  const cancelRequest = () => {
    clearTimeout(timer.current);
    return ++request.current;
  };

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setStatus('');
      setLocating(false);
    }
    return () => {
      clearTimeout(timer.current);
      request.current += 1;
    };
  }, [disabled]);

  const changeLocation = (nextValue: string) => {
    const requestId = cancelRequest();
    onChange(nextValue);
    setSuggestions([]);
    setStatus('');
    setLocating(false);
    if (nextValue.trim().length < 3) return;

    timer.current = setTimeout(async () => {
      setStatus('Finding locations…');
      try {
        const options = await fetchSuggestions(nextValue.trim());
        if (request.current !== requestId) return;
        setSuggestions(options);
        setStatus(options.length ? 'Choose a location below.' : 'No locations found. Try another city.');
      } catch {
        if (request.current === requestId) {
          setStatus('Unable to find locations. Please try again.');
        }
      }
    }, 250);
  };

  const useCurrentLocation = () => {
    const requestId = cancelRequest();
    setSuggestions([]);
    setStatus('');
    if (!navigator.geolocation?.getCurrentPosition) {
      setStatus('Location access is unavailable in this browser. Search for a city instead.');
      return;
    }

    setLocating(true);
    setStatus('Finding your current location…');
    const fail = (message: string) => {
      if (request.current !== requestId) return;
      setLocating(false);
      setStatus(message);
    };
    try {
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        if (request.current !== requestId) return;
        try {
          const options = await fetchLocationOptions(coords.latitude, coords.longitude);
          if (request.current !== requestId) return;
          setSuggestions(options);
          setLocating(false);
          setStatus(options.length
            ? 'Choose the location to show on your profile.'
            : 'No nearby locations found. Search for a city instead.');
        } catch {
          fail('Unable to find nearby locations. Search for a city or try again.');
        }
      }, (error) => {
        fail(error.code === 1
          ? 'Location access was denied. Allow it in your browser settings or search for a city.'
          : 'Unable to get your current location. Search for a city or try again.');
      }, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 });
    } catch {
      fail('Unable to get your current location. Search for a city or try again.');
    }
  };

  return (
    <div className="profile-location-editor">
      <input
        aria-label="Location"
        aria-describedby={helpId}
        autoComplete="off"
        placeholder="Search for a city"
        value={value}
        disabled={disabled}
        onChange={(event) => changeLocation(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelRequest();
            setSuggestions([]);
            setStatus('');
            setLocating(false);
          }
        }}
      />
      <button
        type="button"
        className="profile-location-current"
        disabled={disabled || locating}
        onClick={useCurrentLocation}
      >
        <FaCrosshairs aria-hidden="true" />
        {locating ? 'Finding location…' : 'Use current location'}
      </button>
      <small id={helpId}>Search for a city or use your device location.</small>
      {status && <span role="status">{status}</span>}
      {suggestions.length > 0 && (
        <ul aria-label="Location suggestions">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.displayName}-${index}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  cancelRequest();
                  onChange(suggestion.displayName);
                  setSuggestions([]);
                  setStatus('');
                }}
              >
                {suggestion.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProfileLocationEditor;
