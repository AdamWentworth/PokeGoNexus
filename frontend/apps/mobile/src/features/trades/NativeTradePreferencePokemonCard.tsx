import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativePokemonLocationBackdrop } from '../collection/parity/NativePokemonLocationBackdrop';
import type { NativeTradePreferenceCandidate } from './nativeTradePreferencesModel';

type Props = {
  assetBaseUrl: string;
  candidate: NativeTradePreferenceCandidate;
  editing: boolean;
  light: boolean;
  onPress: () => void;
  tone: 'trade' | 'wanted';
  width: number;
};

const toAssetUrl = (baseUrl: string, path: string): string => (
  /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
);

export const NativeTradePreferencePokemonCard = ({
  assetBaseUrl,
  candidate,
  editing,
  light,
  onPress,
  tone,
  width,
}: Props) => {
  const unavailable = candidate.excludedByRule;
  const denied = candidate.manuallyExcluded;
  const muted = unavailable || denied;
  return (
    <Pressable
      accessibilityLabel={`${candidate.displayName ?? candidate.row.name}, ${candidate.allowed ? 'allowed' : unavailable ? 'excluded by matching rules' : 'not allowed'}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !editing || unavailable, selected: candidate.allowed }}
      disabled={!editing || unavailable}
      onPress={onPress}
      style={[
        styles.card,
        light && styles.cardLight,
        tone === 'trade' ? styles.tradeBorder : styles.wantedBorder,
        editing && candidate.allowed && (tone === 'trade' ? styles.tradeSelected : styles.wantedSelected),
        muted && styles.muted,
        { width },
      ]}
      testID={`preference-candidate-${candidate.collectionKey}`}
    >
      <View style={styles.stage}>
        {candidate.row.locationBackgroundUri ? (
          <NativePokemonLocationBackdrop uri={candidate.row.locationBackgroundUri} />
        ) : null}
        {candidate.row.lucky ? (
          <Image fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, '/images/lucky.png') }}
            style={styles.luckyBackdrop}
          />
        ) : null}
        {candidate.row.imageUri ? (
          <Image fadeDuration={0}
            accessibilityElementsHidden
            resizeMode="contain"
            source={{ uri: candidate.row.imageUri }}
            style={styles.pokemon}
          />
        ) : (
          <Text style={[styles.noImage, light && styles.secondaryLight]}>No image</Text>
        )}
        {candidate.row.maxKind ? (
          <Image fadeDuration={0}
            accessibilityLabel={candidate.row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
            resizeMode="contain"
            source={{ uri: toAssetUrl(assetBaseUrl, `/images/${candidate.row.maxKind}.png`) }}
            style={styles.maxBadge}
          />
        ) : null}
      </View>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={3} style={[styles.name, light && styles.textLight]}>
        {candidate.displayName ?? candidate.row.name}
      </Text>
      <Text style={[styles.number, light && styles.secondaryLight]}>
        #{String(candidate.row.pokedexNumber).padStart(4, '0')}
      </Text>
      {editing ? (
        <View style={[
          styles.state,
          candidate.allowed
            ? (tone === 'trade' ? styles.tradeState : styles.wantedState)
            : styles.offState,
        ]}>
          <Text style={[styles.stateText, candidate.allowed && styles.activeStateText]}>
            {candidate.allowed ? 'Allowed' : unavailable ? 'Rule excluded' : 'Not allowed'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 154,
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#294548',
    backgroundColor: '#101c1e',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardLight: { backgroundColor: '#f7f9fa' },
  tradeBorder: { borderColor: 'rgba(58, 168, 95, 0.38)' },
  wantedBorder: { borderColor: 'rgba(221, 82, 96, 0.38)' },
  tradeSelected: { borderColor: '#37bf78', borderWidth: 2 },
  wantedSelected: { borderColor: '#ef5d72', borderWidth: 2 },
  muted: { opacity: 0.48 },
  stage: {
    width: '100%',
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luckyBackdrop: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  pokemon: { width: 72, height: 72 },
  maxBadge: {
    position: 'absolute',
    width: 24,
    height: 24,
    top: 4,
    right: '16%',
  },
  noImage: { color: '#9eb0b4', fontSize: 11 },
  name: {
    color: '#f4f9fa',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 30,
  },
  number: { color: '#9cb0b4', fontSize: 10, marginTop: 2 },
  textLight: { color: '#142329' },
  secondaryLight: { color: '#617178' },
  state: {
    minHeight: 22,
    marginTop: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeState: { backgroundColor: 'rgba(55, 191, 120, 0.2)' },
  wantedState: { backgroundColor: 'rgba(239, 93, 114, 0.2)' },
  offState: { backgroundColor: 'rgba(130, 145, 150, 0.18)' },
  stateText: { color: '#9eafb3', fontSize: 9, fontWeight: '800' },
  activeStateText: { color: '#eafcf3' },
});
