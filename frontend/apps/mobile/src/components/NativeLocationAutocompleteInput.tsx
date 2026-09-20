import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LocationSuggestion } from '@pokemongonexus/shared-contracts/location';
import { getNativeLocationSuggestions } from '../services/locationApi';
import { NativeUiIcon } from './NativeUiIcon';

type Props = {
  accessibilityLabel: string;
  compact?: boolean;
  light: boolean;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

export const NativeLocationAutocompleteInput = ({
  accessibilityLabel,
  compact = false,
  light,
  maxLength = 255,
  onChangeText,
  placeholder,
  value,
}: Props) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const acceptedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    const requestId = ++requestRef.current;

    if (acceptedLocationRef.current === value) {
      acceptedLocationRef.current = null;
      return undefined;
    }
    if (query.length < 3) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setIsLoading(true);
      void getNativeLocationSuggestions(query)
        .then((nextSuggestions) => {
          if (requestId !== requestRef.current) return;
          setSuggestions(nextSuggestions);
          setSuggestionError(null);
        })
        .catch(() => {
          if (requestId !== requestRef.current) return;
          setSuggestions([]);
          setSuggestionError('Location suggestions are unavailable. You can still type a location.');
        })
        .finally(() => {
          if (requestId === requestRef.current) setIsLoading(false);
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [value]);

  const changeValue = (nextValue: string) => {
    requestRef.current += 1;
    acceptedLocationRef.current = null;
    setSuggestions([]);
    setSuggestionError(null);
    setIsLoading(false);
    onChangeText(nextValue);
  };

  const chooseSuggestion = (suggestion: LocationSuggestion) => {
    requestRef.current += 1;
    acceptedLocationRef.current = suggestion.displayName;
    setSuggestions([]);
    setSuggestionError(null);
    setIsLoading(false);
    onChangeText(suggestion.displayName);
  };

  return (
    <View style={styles.root}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="words"
        autoComplete="off"
        maxLength={maxLength}
        onChangeText={changeValue}
        placeholder={placeholder}
        placeholderTextColor={light ? '#66777d' : '#718087'}
        style={[
          styles.input,
          compact && styles.inputCompact,
          light && styles.inputLight,
        ]}
        value={value}
      />
      {isLoading ? (
        <View accessibilityLabel="Loading location suggestions" style={styles.status}>
          <ActivityIndicator color="#2098ff" size="small" />
          <Text style={[styles.statusText, light && styles.statusTextLight]}>Finding locations…</Text>
        </View>
      ) : null}
      {suggestions.length > 0 ? (
        <View accessibilityLabel="Location suggestions" style={[styles.suggestions, light && styles.suggestionsLight]}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              accessibilityLabel={`Use location ${suggestion.displayName}`}
              accessibilityRole="button"
              key={`${suggestion.displayName}-${index}`}
              onPress={() => chooseSuggestion(suggestion)}
              style={({ pressed }) => [
                styles.suggestion,
                light && styles.suggestionLight,
                pressed && styles.suggestionPressed,
              ]}
            >
              <NativeUiIcon color="#2098ff" name="map" size={16} />
              <Text style={[styles.suggestionText, light && styles.suggestionTextLight]}>{suggestion.displayName}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {suggestionError ? <Text accessibilityRole="alert" style={styles.error}>{suggestionError}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 6 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#59666d',
    borderRadius: 11,
    paddingHorizontal: 14,
    color: '#f7fafb',
    backgroundColor: '#14191c',
    fontSize: 16,
  },
  inputCompact: { minHeight: 46, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '700' },
  inputLight: { borderColor: '#aebdc4', color: '#152126', backgroundColor: '#fff' },
  status: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  statusText: { color: '#a7b6bd', fontSize: 11, fontWeight: '700' },
  statusTextLight: { color: '#5e7077' },
  suggestions: { overflow: 'hidden', borderWidth: 1, borderColor: '#3d5964', borderRadius: 10, backgroundColor: '#10191d' },
  suggestionsLight: { borderColor: '#afbec4', backgroundColor: '#fff' },
  suggestion: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#33454d' },
  suggestionLight: { borderBottomColor: '#d2dcdf' },
  suggestionPressed: { opacity: 0.7, backgroundColor: '#153b5c' },
  suggestionText: { flex: 1, color: '#f7fafb', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  suggestionTextLight: { color: '#152126' },
  error: { color: '#ef6077', fontSize: 11, lineHeight: 15, fontWeight: '700' },
});
