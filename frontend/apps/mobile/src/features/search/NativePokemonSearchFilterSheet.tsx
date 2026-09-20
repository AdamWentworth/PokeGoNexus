import type { Coordinates, LocationSuggestion } from '@pokemongonexus/shared-contracts/location';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import Slider from '@react-native-community/slider';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeOptionPicker,
  type NativeOptionPickerEntry,
} from '../../components/NativeOptionPicker';
import {
  NativeUiIcon,
  type NativeUiIconName,
} from '../../components/NativeUiIcon';
import { getNativeLocationSuggestions } from '../../services/locationApi';
import { useNativeModalAnimation } from '../settings/useNativeMotion';
import {
  countNativePokemonSearchFilters,
  nativePokemonSearchGenderOptions,
  nativePokemonSearchPreviewImage,
  normalizeNativePokemonSelection,
  selectNativePokemonSearchBackground,
  setNativePokemonSearchMaxMode,
  setNativePokemonSearchOwnership,
  type NativePokemonSearchDraft,
} from './nativePokemonSearchDraft';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

export type NativeSearchFilterSection = 'pokemon' | 'location' | 'matching';

type SavedLocation = Coordinates & { label: string };

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  draft: NativePokemonSearchDraft;
  embedded?: boolean;
  error?: string | null;
  initialSection?: NativeSearchFilterSection;
  isSearching?: boolean;
  notice?: string | null;
  onApply: () => boolean | void;
  onChange: (draft: NativePokemonSearchDraft) => void;
  onClose: () => void;
  onNotice: (notice: string | null) => void;
  onReset: () => void;
  savedLocation?: SavedLocation | null;
  visible: boolean;
};

type PickerState = {
  title: string;
  options: NativeOptionPickerEntry[];
  selectedKey: string | null;
  searchable?: boolean;
  onSelect: (option: NativeOptionPickerEntry) => void;
} | null;

const absoluteUri = (value: string | null | undefined, origin: string): string | null => {
  if (!value) return null;
  try { return new URL(value, origin).toString(); } catch { return null; }
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fieldLabel = (value: string | null | undefined, fallback = 'Any'): string => (
  value?.trim() || fallback
);

const SectionButton = ({
  active,
  icon,
  label,
  light,
  onPress,
}: {
  active: boolean;
  icon: NativeUiIconName;
  label: string;
  light: boolean;
  onPress: () => void;
}) => (
  <Pressable
    aria-selected={active}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[
      styles.sectionButton,
      light && styles.sectionButtonLight,
      active && styles.sectionButtonActive,
      active && light && styles.sectionButtonActiveLight,
    ]}
  >
    <View style={styles.sectionButtonLabel}>
      <NativeUiIcon
        color={active ? (light ? '#2f4744' : '#ffffff') : light ? '#4b625e' : '#a5b0b2'}
        name={icon}
        size={13}
      />
      <Text style={[
        styles.sectionButtonText,
        light && styles.secondaryLight,
        active && styles.sectionButtonTextActive,
        active && light && styles.sectionButtonTextActiveLight,
      ]}>{label}</Text>
    </View>
  </Pressable>
);

const Choice = ({
  active,
  disabled = false,
  imageUri,
  label,
  light,
  onPress,
  detail,
}: {
  active: boolean;
  disabled?: boolean;
  imageUri?: string | null;
  label: string;
  light: boolean;
  onPress: () => void;
  detail?: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled, selected: active }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.choice,
      light && styles.choiceLight,
      active && styles.choiceActive,
      active && light && styles.choiceActiveLight,
      disabled && styles.disabled,
      pressed && styles.pressed,
    ]}
  >
    {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: imageUri }} style={styles.choiceIcon} /> : null}
    <Text style={[styles.choiceLabel, light && styles.textLight]}>{label}</Text>
    <Text style={[styles.choiceDetail, light && styles.secondaryLight]}>{detail ?? (active ? 'Required' : 'Any')}</Text>
  </Pressable>
);

const SelectField = ({ disabled = false, label, light, onPress, value }: { disabled?: boolean; label: string; light: boolean; onPress: () => void; value: string }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.selectField, light && styles.selectFieldLight, disabled && styles.disabled]}
  >
    <View style={styles.selectFieldCopy}>
      <Text style={[styles.fieldLabel, light && styles.secondaryLight]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.selectValue, light && styles.textLight]}>{value}</Text>
    </View>
    <Text style={[styles.chevron, light && styles.textLight]}>⌄</Text>
  </Pressable>
);

const ToggleRow = ({
  description,
  label,
  light,
  onChange,
  value,
}: {
  description: string;
  label: string;
  light: boolean;
  onChange: (value: boolean) => void;
  value: boolean;
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleCopy}>
      <Text style={[styles.toggleLabel, light && styles.textLight]}>{label}</Text>
      <Text style={[styles.toggleDescription, light && styles.secondaryLight]}>{description}</Text>
    </View>
    <Switch
      accessibilityLabel={label}
      onValueChange={onChange}
      thumbColor={value ? '#eafffb' : '#d6dcdd'}
      trackColor={{ false: '#536063', true: '#178d77' }}
      value={value}
    />
  </View>
);

const RangeField = ({
  label,
  light,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value,
}: {
  label: string;
  light: boolean;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) => (
  <View style={styles.rangeField}>
    <View style={styles.rangeHeading}>
      <Text style={[styles.rangeLabel, light && styles.textLight]}>{label}</Text>
      <Text style={[styles.rangeValue, light && styles.rangeValueLight]}>{value}{suffix}</Text>
    </View>
    <Slider
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      maximumTrackTintColor={light ? '#b8c6ca' : '#5b696d'}
      maximumValue={max}
      minimumTrackTintColor="#0d71c9"
      minimumValue={min}
      onSlidingComplete={onChange}
      onValueChange={onChange}
      step={step}
      style={styles.rangeSlider}
      thumbTintColor="#0d71c9"
      value={value}
    />
    <View style={styles.rangeLimits}>
      <Text style={[styles.rangeLimit, light && styles.secondaryLight]}>{min}{suffix}</Text>
      <Text style={[styles.rangeLimit, light && styles.secondaryLight]}>{max}{suffix}</Text>
    </View>
  </View>
);

const IvStepper = ({ label, light, onChange, value }: { label: string; light: boolean; onChange: (value: number | null) => void; value: number | null }) => (
  <View style={styles.ivField}>
    <Text style={[styles.fieldLabel, light && styles.secondaryLight]}>{label}</Text>
    <View style={styles.ivControls}>
      <Pressable accessibilityRole="button" onPress={() => onChange(value == null ? 0 : value <= 0 ? null : value - 1)} style={[styles.miniButton, light && styles.miniButtonLight]}>
        <Text style={[styles.miniButtonText, light && styles.textLight]}>−</Text>
      </Pressable>
      <Text style={[styles.ivValue, light && styles.textLight]}>{value == null ? 'Any' : `${value}/15`}</Text>
      <Pressable accessibilityRole="button" onPress={() => onChange(value == null ? 0 : Math.min(15, value + 1))} style={[styles.miniButton, light && styles.miniButtonLight]}>
        <Text style={[styles.miniButtonText, light && styles.textLight]}>+</Text>
      </Pressable>
    </View>
  </View>
);

const NativePokemonSearchFilterSheetImpl = ({
  assetBaseUrl,
  catalog,
  draft,
  embedded = false,
  error = null,
  initialSection = 'pokemon',
  isSearching = false,
  notice = null,
  onApply,
  onChange,
  onClose,
  onNotice,
  onReset,
  savedLocation = null,
  visible,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('slide');
  const reduceMotion = animationType === 'none';
  const { height } = useWindowDimensions();
  const [entryProgress] = useState(() => new Animated.Value(embedded ? 0 : 1));
  const closingRef = useRef(false);
  const [section, setSection] = useState<NativeSearchFilterSection>(initialSection);
  const sectionStartedAtRef = useRef<number | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  useEffect(() => {
    if (!embedded || !visible) return undefined;
    closingRef.current = false;
    if (reduceMotion) {
      entryProgress.setValue(1);
      return undefined;
    }
    entryProgress.setValue(0);
    const animation = Animated.timing(entryProgress, {
      duration: 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      isInteraction: false,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [embedded, entryProgress, reduceMotion, visible]);
  const requestClose = useCallback(() => {
    if (!embedded || Platform.OS === 'web') {
      onClose();
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.timing(entryProgress, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
      isInteraction: false,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [embedded, entryProgress, onClose, reduceMotion]);
  const applyAndClose = useCallback(() => {
    const shouldClose = onApply();
    if (shouldClose) requestClose();
  }, [onApply, requestClose]);
  useEffect(() => {
    if (Platform.OS === 'web' || !embedded || !visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [embedded, requestClose, visible]);
  useEffect(() => {
    const startedAt = sectionStartedAtRef.current;
    if (startedAt == null) return;
    sectionStartedAtRef.current = null;
    markNativeUiPerformanceAfterPaint('search_filter_section_painted', startedAt);
  }, [section]);
  const selectSection = (nextSection: NativeSearchFilterSection) => {
    if (nextSection === section) return;
    sectionStartedAtRef.current = Date.now();
    setSection(nextSection);
  };
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const pokemon = useMemo(() => catalog.find((candidate) => (
    candidate.pokemon_id === draft.pokemonId
    && (candidate.form ?? null) === draft.form
  )) ?? catalog.find((candidate) => candidate.pokemon_id === draft.pokemonId) ?? null, [catalog, draft.form, draft.pokemonId]);
  const imageUri = nativePokemonSearchPreviewImage(draft, pokemon);
  const background = pokemon?.backgrounds?.find((candidate) => candidate.background_id === draft.backgroundId);
  const selectedCostume = pokemon?.costumes?.find((candidate) => candidate.costume_id === draft.costumeId);
  const hasDynamax = Boolean(pokemon?.max?.some((entry) => entry.dynamax));
  const hasGigantamax = Boolean(pokemon?.max?.some((entry) => entry.gigantamax));
  const moves = pokemon?.moves ?? [];
  const fastMoves = moves.filter((move) => Boolean(move.is_fast));
  const chargedMoves = moves.filter((move) => !move.is_fast);
  const genderOptions = nativePokemonSearchGenderOptions(pokemon);
  const availableForms = pokemon ? catalog.filter((candidate) => (
    candidate.pokemon_id === pokemon.pokemon_id
    || candidate.name.toLocaleLowerCase() === pokemon.name.toLocaleLowerCase()
  )) : [];
  const perfectIvs = draft.attackIv === 15 && draft.defenseIv === 15 && draft.staminaIv === 15;
  const canReset = Boolean(
    countNativePokemonSearchFilters(draft)
    || draft.city
    || draft.useCurrentLocation
    || draft.ownership !== 'caught',
  );

  useEffect(() => {
    if (
      !visible
      || section !== 'location'
      || draft.useCurrentLocation
      || draft.city.trim().length < 3
      || (draft.latitude != null && draft.longitude != null)
    ) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void getNativeLocationSuggestions(draft.city)
        .then((suggestions) => { if (active) setLocationSuggestions(suggestions); })
        .catch(() => { if (active) setLocationSuggestions([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [draft.city, draft.latitude, draft.longitude, draft.useCurrentLocation, section, visible]);

  const openPicker = (next: NonNullable<PickerState>) => setPicker(next);
  const closePicker = () => setPicker(null);
  const chooseSimple = ({
    title,
    selectedKey,
    entries,
    onSelect,
  }: {
    title: string;
    selectedKey: string | null;
    entries: NativeOptionPickerEntry[];
    onSelect: (key: string) => void;
  }) => openPicker({
    title,
    options: entries,
    selectedKey,
    onSelect: (option) => { onSelect(option.key); closePicker(); },
  });
  const moveOptions = (moveList: Move[]): NativeOptionPickerEntry[] => [
    { key: '', label: 'Any move' },
    ...moveList.map((move) => ({
      key: String(move.move_id),
      label: move.name,
      description: move.legacy ? `${move.type_name} · Legacy` : move.type_name,
    })),
  ];
  const moveName = (id: number | null) => moves.find((move) => move.move_id === id)?.name ?? 'Any move';

  const pokemonSection = (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>POKÉMON DETAILS</Text>
      <Text style={[styles.sectionTitle, light && styles.textLight]}>Choose the exact variant</Text>
      <Text style={[styles.sectionDescription, light && styles.secondaryLight]}>Every field is optional. Add only the details that matter.</Text>
      <View
        style={[
          styles.preview,
          light && styles.previewLight,
          background?.image_url ? { backgroundColor: '#14282c' } : null,
        ]}
      >
        {background?.image_url ? <Image fadeDuration={0} resizeMode="cover" source={{ uri: absoluteUri(background.image_url, assetBaseUrl) ?? '' }} style={StyleSheet.absoluteFill} /> : null}
        {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(imageUri, assetBaseUrl) ?? imageUri }} style={styles.previewImage} /> : <Text style={styles.previewPlaceholder}>Select a Pokémon</Text>}
        {draft.gigantamax || draft.dynamax ? (
          <Image fadeDuration={0}
            resizeMode="contain"
            source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/${draft.gigantamax ? 'gigantamax' : 'dynamax'}.png` }}
            style={styles.maxBadge}
          />
        ) : null}
      </View>
      <View style={[styles.card, light && styles.cardLight]}>
        <Text style={[styles.cardTitle, light && styles.textLight]}>Variant</Text>
        <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Shiny, Shadow, costume, form, and Max form.</Text>
        <View style={styles.choiceGrid}>
          <Choice active={draft.shiny} disabled={!pokemon} imageUri={`${assetBaseUrl.replace(/\/$/, '')}/images/shiny_icon.png`} label="Shiny" light={light} onPress={() => onChange({ ...draft, shiny: !draft.shiny })} />
          <Choice active={draft.shadow} disabled={!pokemon} imageUri={`${assetBaseUrl.replace(/\/$/, '')}/images/shadow_icon.png`} label="Shadow" light={light} onPress={() => {
            const shadow = !draft.shadow;
            onChange({ ...draft, shadow, ...(shadow ? { dynamax: false, gigantamax: false } : {}) });
          }} />
          <Choice active={draft.costumeId != null} disabled={!pokemon?.costumes?.length} imageUri={`${assetBaseUrl.replace(/\/$/, '')}/images/costume_icon.png`} label="Costume" light={light} detail={selectedCostume?.name ?? 'No costume'} onPress={() => pokemon && chooseSimple({
            title: 'Choose a costume', selectedKey: draft.costumeId == null ? '' : String(draft.costumeId),
            entries: [{ key: '', label: 'No costume' }, ...(pokemon.costumes ?? []).map((costume) => ({ key: String(costume.costume_id), label: costume.name }))],
            onSelect: (key) => onChange({ ...draft, costumeId: key ? Number(key) : null, backgroundId: null, dynamax: false, gigantamax: false }),
          })} />
        </View>
        {pokemon ? (
          <View style={styles.variantSelects}>
            <SelectField disabled={!availableForms.some((entry) => entry.form?.trim())} label="Form" light={light} value={draft.form || 'Any form'} onPress={() => chooseSimple({
              title: 'Choose a form', selectedKey: draft.form ?? '',
              entries: [
                { key: '', label: 'Any form' },
                ...availableForms.filter((entry) => entry.form?.trim()).map((entry) => ({
                  key: entry.form?.trim() ?? '',
                  label: entry.form?.trim() ?? '',
                })),
              ],
              onSelect: (key) => {
                const selected = availableForms.find((entry) => (entry.form?.trim() ?? '') === key)
                  ?? availableForms.find((entry) => !entry.form?.trim())
                  ?? pokemon;
                onChange(normalizeNativePokemonSelection(draft, selected));
              },
            })} />
            <SelectField disabled={!pokemon.costumes?.length} label="Costume" light={light} value={selectedCostume?.name ?? 'No costume'} onPress={() => chooseSimple({
              title: 'Choose a costume', selectedKey: draft.costumeId == null ? '' : String(draft.costumeId),
              entries: [{ key: '', label: 'No costume' }, ...(pokemon.costumes ?? []).map((costume) => ({ key: String(costume.costume_id), label: costume.name }))],
              onSelect: (key) => onChange({ ...draft, costumeId: key ? Number(key) : null, backgroundId: null, dynamax: false, gigantamax: false }),
            })} />
          </View>
        ) : null}
        {pokemon && (hasDynamax || hasGigantamax) ? (
          <>
            <Text style={[styles.fieldLabel, light && styles.secondaryLight]}>Max form</Text>
          <View style={styles.segmented}>
            <Choice active={!draft.dynamax && !draft.gigantamax} label="Standard" light={light} onPress={() => onChange(setNativePokemonSearchMaxMode(draft, 'standard'))} />
            {hasDynamax ? <Choice active={draft.dynamax} imageUri={`${assetBaseUrl.replace(/\/$/, '')}/images/dynamax.png`} label="Dynamax" light={light} onPress={() => onChange(setNativePokemonSearchMaxMode(draft, 'dynamax'))} /> : null}
            {hasGigantamax ? <Choice active={draft.gigantamax} imageUri={`${assetBaseUrl.replace(/\/$/, '')}/images/gigantamax.png`} label="Gigantamax" light={light} onPress={() => onChange(setNativePokemonSearchMaxMode(draft, 'gigantamax'))} /> : null}
          </View>
          </>
        ) : null}
      </View>
      {pokemon ? (
        <>
          <View style={[styles.card, light && styles.cardLight]}>
            <Text style={[styles.cardTitle, light && styles.textLight]}>Gender and moves</Text>
            <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Match a gender or exact Pokémon GO moveset.</Text>
            {genderOptions.length > 0 ? <SelectField label="Gender" light={light} value={fieldLabel(draft.gender, genderOptions.includes('Any') ? 'Any' : genderOptions[0])} onPress={() => chooseSimple({
              title: 'Choose a gender', selectedKey: draft.gender ?? '',
              entries: genderOptions.map((label) => ({ key: label === 'Any' ? '' : label, label })),
              onSelect: (key) => onChange({ ...draft, gender: key || null }),
            })} /> : null}
            <SelectField disabled={fastMoves.length === 0} label="Fast move" light={light} value={moveName(draft.fastMoveId)} onPress={() => chooseSimple({
              title: 'Choose a fast move', selectedKey: draft.fastMoveId == null ? '' : String(draft.fastMoveId), entries: moveOptions(fastMoves),
              onSelect: (key) => onChange({ ...draft, fastMoveId: key ? Number(key) : null }),
            })} />
            <SelectField disabled={chargedMoves.length === 0} label="Charged move" light={light} value={moveName(draft.chargedMove1Id)} onPress={() => chooseSimple({
              title: 'Choose charged move 1', selectedKey: draft.chargedMove1Id == null ? '' : String(draft.chargedMove1Id), entries: moveOptions(chargedMoves.filter((move) => move.move_id !== draft.chargedMove2Id)),
              onSelect: (key) => onChange({ ...draft, chargedMove1Id: key ? Number(key) : null }),
            })} />
            <SelectField disabled={chargedMoves.length === 0} label="Second charged move" light={light} value={moveName(draft.chargedMove2Id)} onPress={() => chooseSimple({
              title: 'Choose charged move 2', selectedKey: draft.chargedMove2Id == null ? '' : String(draft.chargedMove2Id), entries: moveOptions(chargedMoves.filter((move) => move.move_id !== draft.chargedMove1Id)),
              onSelect: (key) => onChange({ ...draft, chargedMove2Id: key ? Number(key) : null }),
            })} />
          </View>
          <View style={[styles.card, light && styles.cardLight]}>
            <Text style={[styles.cardTitle, light && styles.textLight]}>Location background</Text>
            <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Optionally match one of this Pokémon’s special backgrounds.</Text>
            <SelectField label="Background" light={light} value={background?.location || background?.name || 'Any background'} onPress={() => chooseSimple({
              title: 'Choose a location background', selectedKey: draft.backgroundId == null ? '' : String(draft.backgroundId),
              entries: [{ key: '', label: 'Any background' }, ...(pokemon.backgrounds ?? []).map((entry) => ({ key: String(entry.background_id), label: entry.location || entry.name, imageUri: absoluteUri(entry.image_url, assetBaseUrl) }))],
              onSelect: (key) => {
                const selection = selectNativePokemonSearchBackground(draft, pokemon, key ? Number(key) : null);
                onChange(selection.draft);
                onNotice(selection.notice);
              },
            })} />
          </View>
        </>
      ) : null}
    </View>
  );

  const locationSection = (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>SEARCH AREA</Text>
      <Text style={[styles.sectionTitle, light && styles.textLight]}>Where should we look?</Text>
      <Text style={[styles.sectionDescription, light && styles.secondaryLight]}>Use your saved location or search around another city.</Text>
      <View style={[styles.card, light && styles.cardLight]}>
        <Text style={[styles.cardTitle, light && styles.textLight]}>Starting point</Text>
        <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Your exact coordinates are never shown in search results.</Text>
        <Pressable
          accessibilityLabel="Use saved location"
          accessibilityRole="button"
          accessibilityState={{ selected: draft.useCurrentLocation }}
          onPress={() => {
            if (draft.useCurrentLocation) {
              onChange({ ...draft, city: '', useCurrentLocation: false, latitude: null, longitude: null });
              setLocationError(null);
              return;
            }
            if (!savedLocation) {
              setLocationError('No saved location is available. Search for a city instead.');
              return;
            }
            onChange({
              ...draft,
              city: '',
              useCurrentLocation: true,
              latitude: savedLocation.latitude,
              longitude: savedLocation.longitude,
            });
            setLocationError(null);
            setLocationSuggestions([]);
          }}
          style={[
            styles.savedLocation,
            light && styles.savedLocationLight,
            draft.useCurrentLocation && styles.savedLocationActive,
            light && draft.useCurrentLocation && styles.savedLocationActiveLight,
          ]}
        >
          <View style={styles.iconLabelRow}>
            <NativeUiIcon color={light ? '#172124' : '#f3f8f9'} name="map" size={16} />
            <Text style={[styles.savedLocationTitle, light && styles.textLight]}>
              {draft.useCurrentLocation ? 'Using saved location' : 'Use saved location'}
            </Text>
          </View>
          <Text style={[styles.savedLocationCopy, light && styles.secondaryLight]}>Search from the location stored in your profile</Text>
        </Pressable>
        <View accessibilityElementsHidden style={styles.locationDivider}>
          <View style={[styles.locationDividerLine, light && styles.locationDividerLineLight]} />
          <Text style={[styles.locationDividerText, light && styles.secondaryLight]}>OR CHOOSE ANOTHER AREA</Text>
          <View style={[styles.locationDividerLine, light && styles.locationDividerLineLight]} />
        </View>
        <Text style={[styles.fieldLabel, light && styles.secondaryLight]}>City or place</Text>
        <TextInput
          accessibilityLabel="City or place"
          editable={!draft.useCurrentLocation}
          onChangeText={(city) => {
            setLocationSuggestions([]);
            setLocationError(null);
            onChange({ ...draft, city, useCurrentLocation: false, latitude: null, longitude: null });
          }}
          placeholder="Search for a city"
          placeholderTextColor={light ? '#667477' : '#8a999c'}
          style={[styles.locationInput, light && styles.locationInputLight, draft.useCurrentLocation && styles.disabled]}
          value={draft.city}
        />
        {locationSuggestions.map((suggestion, index) => {
          const latitude = toNumber(suggestion.latitude);
          const longitude = toNumber(suggestion.longitude);
          return (
            <Pressable
              accessibilityRole="button"
              disabled={latitude == null || longitude == null}
              key={`${suggestion.displayName}-${index}`}
              onPress={() => {
                if (latitude == null || longitude == null) return;
                onChange({ ...draft, city: suggestion.displayName, useCurrentLocation: false, latitude, longitude });
                setLocationError(null);
                setLocationSuggestions([]);
              }}
              style={[styles.locationSuggestion, light && styles.locationSuggestionLight]}
            >
              <View style={styles.iconLabelRow}>
                <NativeUiIcon color="#2f9cff" name="map" size={15} />
                <Text style={[styles.locationSuggestionText, light && styles.textLight]}>{suggestion.displayName}</Text>
              </View>
            </Pressable>
          );
        })}
        {locationError ? <Text accessibilityLiveRegion="polite" style={styles.locationError}>{locationError}</Text> : null}
        {draft.city && draft.latitude != null && draft.longitude != null ? (
          <Text style={styles.locationSelected}>✓ Search center selected</Text>
        ) : null}
      </View>
      <View style={[styles.card, light && styles.cardLight]}>
        <Text style={[styles.cardTitle, light && styles.textLight]}>Distance and results</Text>
        <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Balance nearby relevance with the number of listings returned.</Text>
        <RangeField label="Search radius" light={light} max={25} min={1} onChange={(rangeKm) => onChange({ ...draft, rangeKm })} suffix=" km" value={draft.rangeKm} />
        <RangeField label="Maximum results" light={light} max={100} min={5} onChange={(limit) => onChange({ ...draft, limit })} step={5} value={draft.limit} />
      </View>
    </View>
  );

  const matchingSection = (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>LISTING TYPE</Text>
      <Text style={[styles.sectionTitle, light && styles.textLight]}>What kind of match?</Text>
      <Text style={[styles.sectionDescription, light && styles.secondaryLight]}>Choose a listing type, then add only the filters relevant to it.</Text>
      <View style={styles.ownershipGrid}>
        {(['caught', 'trade', 'wanted'] as const).map((ownership) => (
          <Choice
            active={draft.ownership === ownership}
            detail={ownership === 'caught' ? 'Collections' : ownership === 'trade' ? 'Offers' : 'Wishlists'}
            key={ownership}
            label={ownership === 'caught' ? 'Caught' : ownership === 'trade' ? 'For Trade' : 'Wanted'}
            light={light}
            onPress={() => onChange(setNativePokemonSearchOwnership(draft, ownership))}
          />
        ))}
      </View>
      {draft.ownership === 'caught' ? (
        <View style={[styles.card, light && styles.cardLight]}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.cardHeadingCopy}>
              <Text style={[styles.cardTitle, light && styles.textLight]}>Individual values</Text>
              <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Leave a stat at Any to accept 0–15.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: perfectIvs }}
              onPress={() => onChange({
                ...draft,
                attackIv: perfectIvs ? null : 15,
                defenseIv: perfectIvs ? null : 15,
                staminaIv: perfectIvs ? null : 15,
              })}
              style={[styles.compactButton, light && styles.compactButtonLight, perfectIvs && styles.compactButtonActive]}
            >
              <Image source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/hundo.png` }} style={styles.compactButtonIcon} />
              <Text style={styles.compactButtonText}>Perfect IVs</Text>
            </Pressable>
          </View>
          <View style={styles.ivGrid}>
            <IvStepper label="Attack" light={light} onChange={(attackIv) => onChange({ ...draft, attackIv })} value={draft.attackIv} />
            <IvStepper label="Defense" light={light} onChange={(defenseIv) => onChange({ ...draft, defenseIv })} value={draft.defenseIv} />
            <IvStepper label="HP" light={light} onChange={(staminaIv) => onChange({ ...draft, staminaIv })} value={draft.staminaIv} />
          </View>
        </View>
      ) : null}
      {draft.ownership === 'trade' ? (
        <View style={[styles.card, light && styles.cardLight]}>
          <Text style={[styles.cardTitle, light && styles.textLight]}>Trade compatibility</Text>
          <ToggleRow
            description="They want at least one Pokémon from your For Trade list."
            label="Mutual matches only"
            light={light}
            onChange={(onlyMatchingTrades) => onChange({ ...draft, onlyMatchingTrades })}
            value={draft.onlyMatchingTrades}
          />
        </View>
      ) : null}
      {draft.ownership === 'wanted' ? (
        <>
          <View style={[styles.card, light && styles.cardLight]}>
            <Text style={[styles.cardTitle, light && styles.textLight]}>Friendship and trade type</Text>
            <Text style={[styles.cardCopy, light && styles.secondaryLight]}>Choose the exact friendship condition on the wanted listing.</Text>
            <View style={styles.hearts}>
              {Array.from({ length: 6 }, (_, level) => (
                <Pressable accessibilityRole="button"
                  accessibilityLabel={level === 0 ? 'Any friendship level' : `${level} hearts`}
                  key={level}
                  onPress={() => onChange({
                    ...draft,
                    friendshipLevel: level,
                    prefLucky: level < 4 ? false : draft.prefLucky,
                  })}
                  style={[
                    styles.heartButton,
                    light && styles.heartButtonLight,
                    draft.friendshipLevel === level && styles.heartButtonActive,
                  ]}
                >
                  <Text style={styles.heartText}>{level === 0 ? 'Any' : `${'♥'.repeat(level)}`}</Text>
                </Pressable>
              ))}
            </View>
            {draft.friendshipLevel === 5 ? <Text style={styles.remoteNotice}>Remote trade eligible</Text> : null}
            <ToggleRow
              description="Requires at least four hearts."
              label="Lucky trade preferred"
              light={light}
              onChange={(prefLucky) => onChange({ ...draft, prefLucky, friendshipLevel: prefLucky ? Math.max(4, draft.friendshipLevel) : draft.friendshipLevel })}
              value={draft.prefLucky}
            />
          </View>
          <View style={[styles.card, light && styles.cardLight]}>
            <Text style={[styles.cardTitle, light && styles.textLight]}>Collection compatibility</Text>
            <ToggleRow description="Only show Pokémon already registered in your Pokédex." label="Already registered" light={light} onChange={(alreadyRegistered) => onChange({ ...draft, alreadyRegistered })} value={draft.alreadyRegistered} />
            <ToggleRow description="They offer at least one Pokémon from your Wanted list." label="Wishlist matches only" light={light} onChange={(tradeInWantedList) => onChange({ ...draft, tradeInWantedList })} value={draft.tradeInWantedList} />
          </View>
        </>
      ) : null}
    </View>
  );

  const content = (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.screen, light && styles.screenLight]}
        testID="native-pokemon-search-filter-sheet"
      >
        <View style={[styles.header, light && styles.headerLight]}>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <NativeUiIcon color="#2f9cff" name="filters" size={13} />
              <Text style={styles.eyebrow}>SEARCH FILTERS</Text>
            </View>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Refine your search</Text>
          </View>
          <Pressable accessibilityLabel="Close search filters" accessibilityRole="button" onPress={requestClose} style={[styles.close, light && styles.closeLight]}>
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
        </View>
        <View accessibilityRole="tablist" style={[styles.tabs, light && styles.tabsLight]}>
          <SectionButton active={section === 'pokemon'} icon="pokeball" label="Pokémon" light={light} onPress={() => selectSection('pokemon')} />
          <SectionButton active={section === 'location'} icon="map" label="Location" light={light} onPress={() => selectSection('location')} />
          <SectionButton active={section === 'matching'} icon="trade" label="Matching" light={light} onPress={() => selectSection('matching')} />
        </View>
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {section === 'pokemon' ? pokemonSection : section === 'location' ? locationSection : matchingSection}
        </ScrollView>
        <View style={[styles.footer, light && styles.footerLight]}>
          {canReset ? <Pressable accessibilityRole="button" onPress={onReset} style={[styles.resetButton, light && styles.resetButtonLight]}>
            <Text style={[styles.resetButtonText, light && styles.textLight]}>Reset filters</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" disabled={isSearching} onPress={applyAndClose} style={[styles.applyButton, !canReset && styles.applyButtonOnly, isSearching && styles.disabled]}>
            <Text style={styles.applyButtonText}>{isSearching ? 'Searching…' : `Apply & search${countNativePokemonSearchFilters(draft) ? ` · ${countNativePokemonSearchFilters(draft)}` : ''}`}</Text>
          </Pressable>
        </View>
        {picker ? (
          <NativeOptionPicker
            onClose={closePicker}
            onSelect={picker.onSelect}
            options={picker.options}
            searchable={picker.searchable}
            selectedKey={picker.selectedKey}
            title={picker.title}
            visible
          />
        ) : null}
      </SafeAreaView>
  );

  if (embedded) {
    return (
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.embeddedOverlay,
          {
            opacity: entryProgress,
            transform: [{
              translateY: entryProgress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
            }],
          },
        ]}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <Modal animationType={animationType} hardwareAccelerated onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      {content}
    </Modal>
  );
};

export const NativePokemonSearchFilterSheet = memo(
  NativePokemonSearchFilterSheetImpl,
  (previous, next) => Boolean(
    previous.embedded
    && next.embedded
    && !previous.visible
    && !next.visible
  ),
);

const styles = StyleSheet.create({
  embeddedOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, elevation: 50 },
  screen: { flex: 1, minHeight: 0, backgroundColor: '#090d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#334347', backgroundColor: '#0e1416' },
  headerLight: { borderBottomColor: '#b8cbc5', backgroundColor: '#f8fff9' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { marginTop: 1, color: '#f8fcfd', fontSize: 21, fontWeight: '900' },
  close: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#58696c', borderRadius: 23 },
  closeLight: { borderColor: '#b2c5bf', backgroundColor: '#eef7f1' },
  closeText: { color: '#ffffff', fontSize: 28 },
  tabs: { minHeight: 58, flexDirection: 'row', gap: 7, padding: 8, borderBottomWidth: 1, borderBottomColor: '#28383b', backgroundColor: '#0e1416' },
  tabsLight: { borderBottomColor: '#b8cbc5', backgroundColor: '#f8fff9' },
  sectionButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 9 },
  sectionButtonLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sectionButtonLight: { backgroundColor: 'transparent' },
  sectionButtonActive: { borderColor: '#2f9cff', backgroundColor: '#12375c' },
  sectionButtonActiveLight: { borderColor: '#5ca9e8', backgroundColor: '#d9ecf8' },
  sectionButtonText: { color: '#a5b0b2', fontSize: 13, fontWeight: '800' },
  sectionButtonTextActive: { color: '#ffffff' },
  sectionButtonTextActiveLight: { color: '#2f4744' },
  notice: { marginHorizontal: 10, marginTop: 8, padding: 9, color: '#c9fff3', fontSize: 12, textAlign: 'center', borderWidth: 1, borderColor: '#27866e', borderRadius: 8, backgroundColor: '#123128' },
  error: { marginHorizontal: 10, marginTop: 8, padding: 10, color: '#ffd5db', fontSize: 13, fontWeight: '800', textAlign: 'center', borderWidth: 1, borderColor: '#b74d60', borderRadius: 8, backgroundColor: '#401c25' },
  scrollContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 12, paddingBottom: 30 },
  section: { gap: 12 },
  sectionEyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: '#f7fbfc', fontSize: 22, fontWeight: '900' },
  sectionDescription: { marginTop: -8, color: '#a6b1b3', fontSize: 13, lineHeight: 19 },
  preview: { height: 178, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#506064', borderRadius: 14, backgroundColor: '#151b1d' },
  previewLight: { borderColor: '#b2c5bf', backgroundColor: '#eef7f1' },
  previewImage: { width: '82%', height: '82%' },
  previewPlaceholder: { color: '#8d9a9d', fontWeight: '800' },
  maxBadge: { position: 'absolute', width: 52, height: 52, top: 18, right: '14%' },
  choiceGrid: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minWidth: 0, minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: 7, borderWidth: 1, borderColor: '#506064', borderRadius: 10, backgroundColor: '#202729' },
  choiceLight: { borderColor: '#b2c5bf', backgroundColor: '#e8f1eb' },
  choiceActive: { borderColor: '#2f9cff', backgroundColor: '#174474' },
  choiceActiveLight: { backgroundColor: '#dceeff' },
  choiceIcon: { width: 29, height: 29 },
  choiceLabel: { color: '#f3f8f9', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  choiceDetail: { marginTop: 2, color: '#b6c0c2', fontSize: 10, textAlign: 'center' },
  card: { gap: 10, padding: 12, borderWidth: 1, borderColor: '#4d5b5e', borderRadius: 12, backgroundColor: '#24292b' },
  cardLight: { borderColor: '#b2c5bf', backgroundColor: '#e3eee7' },
  cardTitle: { color: '#f6fafb', fontSize: 16, fontWeight: '900' },
  cardCopy: { color: '#a9b4b6', fontSize: 12, lineHeight: 17 },
  segmented: { flexDirection: 'row', gap: 7 },
  variantSelects: { gap: 8 },
  selectField: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: '#59686b', borderRadius: 9, backgroundColor: '#181e20' },
  selectFieldLight: { borderColor: '#b2c5bf', backgroundColor: '#edf5ef' },
  selectFieldCopy: { flex: 1, minWidth: 0 },
  fieldLabel: { color: '#aebabc', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  selectValue: { marginTop: 3, color: '#f3f8f9', fontSize: 14, fontWeight: '800' },
  chevron: { color: '#dce5e6', fontSize: 22 },
  savedLocation: { padding: 14, borderWidth: 1, borderColor: '#4d666a', borderRadius: 11, backgroundColor: '#162023' },
  savedLocationLight: { borderColor: '#a6b7ba', backgroundColor: '#ffffff' },
  savedLocationActive: { borderColor: '#36c5a4', backgroundColor: '#15342d' },
  savedLocationActiveLight: { borderColor: '#2aa485', backgroundColor: '#e5f8f2' },
  savedLocationTitle: { color: '#f3f8f9', fontSize: 15, fontWeight: '900' },
  savedLocationCopy: { marginTop: 3, color: '#aab7b9', fontSize: 12 },
  locationInput: { minHeight: 50, paddingHorizontal: 12, color: '#ffffff', fontSize: 15, borderWidth: 1, borderColor: '#647477', borderRadius: 9, backgroundColor: '#141a1c' },
  locationInputLight: { color: '#172124', borderColor: '#98a8ab', backgroundColor: '#ffffff' },
  locationSuggestion: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: '#46575a', borderRadius: 8, backgroundColor: '#182022' },
  locationSuggestionLight: { borderColor: '#a7b4b7', backgroundColor: '#f4f7f7' },
  locationSuggestionText: { color: '#eaf1f2', fontSize: 13, fontWeight: '700' },
  locationError: { color: '#ff8a9a', fontSize: 12, fontWeight: '800' },
  iconLabelRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationSelected: { color: '#62dfbc', fontSize: 12, fontWeight: '900' },
  locationDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  locationDividerLine: { flex: 1, height: 1, backgroundColor: '#435155' },
  locationDividerLineLight: { backgroundColor: '#d1d9da' },
  locationDividerText: { color: '#9eabad', fontSize: 9, fontWeight: '900' },
  rangeField: { gap: 2, paddingVertical: 2 },
  rangeHeading: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rangeLabel: { flex: 1, color: '#dce5e6', fontSize: 13, fontWeight: '800' },
  rangeValue: { minWidth: 70, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3, color: '#bfe5ff', fontSize: 12, fontWeight: '900', textAlign: 'center', borderRadius: 999, backgroundColor: '#183b52' },
  rangeValueLight: { color: '#36525b', backgroundColor: '#d8eaf2' },
  rangeSlider: { width: '100%', height: 30 },
  rangeLimits: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeLimit: { color: '#9fadaf', fontSize: 10, fontWeight: '800' },
  ownershipGrid: { flexDirection: 'row', gap: 7 },
  toggleRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  toggleCopy: { flex: 1, minWidth: 0 },
  toggleLabel: { color: '#f1f6f7', fontSize: 14, fontWeight: '900' },
  toggleDescription: { marginTop: 3, color: '#aab5b7', fontSize: 11, lineHeight: 16 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeadingCopy: { flex: 1, minWidth: 0 },
  compactButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: '#2f9cff', borderRadius: 8 },
  compactButtonLight: { backgroundColor: '#e7f3ff' },
  compactButtonActive: { backgroundColor: '#173e66' },
  compactButtonIcon: { width: 18, height: 18 },
  compactButtonText: { color: '#8fc9ff', fontSize: 11, fontWeight: '900' },
  ivGrid: { gap: 7 },
  ivField: { flexDirection: 'row', alignItems: 'center' },
  ivControls: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7 },
  miniButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#667579', borderRadius: 8 },
  miniButtonLight: { borderColor: '#9eadaf', backgroundColor: '#f4f7f7' },
  miniButtonText: { color: '#ffffff', fontSize: 20 },
  ivValue: { width: 58, color: '#ffffff', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  hearts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  heartButton: { minWidth: 46, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderWidth: 1, borderColor: '#5b696c', borderRadius: 9, backgroundColor: '#171e20' },
  heartButtonLight: { borderColor: '#a0adaf', backgroundColor: '#f4f7f7' },
  heartButtonActive: { borderColor: '#ff6849', backgroundColor: '#593329' },
  heartText: { color: '#ff7459', fontSize: 12, fontWeight: '900' },
  remoteNotice: { color: '#75d7ff', fontSize: 12, fontWeight: '900' },
  footer: { minHeight: 72, flexDirection: 'row', gap: 9, padding: 10, borderTopWidth: 1, borderTopColor: '#344448', backgroundColor: '#0e1416' },
  footerLight: { borderTopColor: '#b8cbc5', backgroundColor: '#f8fff9' },
  resetButton: { flex: 0.72, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#59686b', borderRadius: 10 },
  resetButtonLight: { borderColor: '#8e9c9f' },
  resetButtonText: { color: '#d9e2e3', fontSize: 13, fontWeight: '900' },
  applyButton: { flex: 1.35, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#138cff' },
  applyButtonOnly: { flex: 1 },
  applyButtonText: { color: '#051421', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  textLight: { color: '#172124' },
  secondaryLight: { color: '#566467' },
});
