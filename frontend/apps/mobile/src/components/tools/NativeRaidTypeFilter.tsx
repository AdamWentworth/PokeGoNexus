import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NATIVE_BATTLE_TYPES } from '../../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';

type Props = {
  assetBaseUrl: string;
  onChange: (type: string) => void;
  selectedType: string;
};

const TYPE_COLORS: Record<string, string> = {
  bug: '#92c12a', dark: '#5a5366', dragon: '#0a6dc4', electric: '#f4d23c',
  fairy: '#ef8fe7', fighting: '#ce416b', fire: '#ff9d55', flying: '#8fa9de',
  ghost: '#5269ad', grass: '#63bc5a', ground: '#d97845', ice: '#73cec0',
  normal: '#919aa2', poison: '#aa6bc8', psychic: '#fa7179', rock: '#c5b78c',
  steel: '#5a8ea2', water: '#5090d6',
};

const assetUri = (base: string, type: string) => (
  `${base.replace(/\/$/, '')}/images/types/${type}.png`
);

export const NativeRaidTypeFilter = ({ assetBaseUrl, onChange, selectedType }: Props) => {
  const light = useNativeColorScheme() === 'light';
  return (
    <View
      accessibilityLabel="Attacker type filter"
      style={[styles.panel, light && styles.panelLight]}
    >
      <Pressable
        accessibilityLabel="All types"
        accessibilityRole="button"
        accessibilityState={{ selected: selectedType === '' }}
        onPress={() => onChange('')}
        style={[styles.all, light && styles.controlLight, selectedType === '' && styles.allActive]}
      >
        <Text style={[styles.allText, light && styles.textLight, selectedType === '' && styles.activeText]}>
          ALL TYPES
        </Text>
      </Pressable>
      <View style={styles.grid}>
        {NATIVE_BATTLE_TYPES.map((type) => {
          const selected = selectedType === type;
          return (
            <Pressable
              accessibilityLabel={type.charAt(0).toUpperCase() + type.slice(1)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={type}
              onPress={() => onChange(type)}
              style={[
                styles.type,
                light && styles.controlLight,
                { borderBottomColor: TYPE_COLORS[type] },
                selected && { backgroundColor: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] },
              ]}
            >
              <Image fadeDuration={0}
                accessibilityElementsHidden
                resizeMode="contain"
                source={{ uri: assetUri(assetBaseUrl, type) }}
                style={styles.icon}
              />
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={1}
                style={[styles.label, light && styles.textLight, selected && styles.activeText]}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    gap: 6,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#355052',
    borderRadius: 14,
    padding: 6,
    backgroundColor: '#101819',
  },
  panelLight: { borderColor: '#b9cdcd', backgroundColor: '#edf5f4' },
  all: {
    alignSelf: 'center',
    minWidth: 128,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#526264',
    borderRadius: 999,
    backgroundColor: '#20292a',
  },
  allActive: { borderColor: '#2fd6d0', backgroundColor: '#45dbc4' },
  allText: { color: '#eaf7f7', fontSize: 11, fontWeight: '900' },
  activeText: { color: '#071214' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  type: {
    width: '15.3%',
    minWidth: 43,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: '#445253',
    borderRadius: 9,
    backgroundColor: '#202728',
  },
  controlLight: { borderColor: '#b5c4c4', backgroundColor: '#fff' },
  icon: { width: 24, height: 24 },
  // The canonical compact raid grid is icon-only below the tablet
  // breakpoint. Each button retains its accessibilityLabel.
  label: { display: 'none', color: '#dceaea', fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase' },
  textLight: { color: '#142629' },
});
