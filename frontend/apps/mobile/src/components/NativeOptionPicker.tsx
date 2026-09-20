import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNativeModalAnimation } from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

export type NativeOptionPickerEntry = {
  key: string;
  label: string;
  description?: string | null;
  imageUri?: string | null;
};

type Props = {
  emptyLabel?: string;
  onClose: () => void;
  onSelect: (entry: NativeOptionPickerEntry) => void;
  options: NativeOptionPickerEntry[];
  searchable?: boolean;
  selectedKey?: string | null;
  title: string;
  visible: boolean;
};

export const NativeOptionPicker = ({
  emptyLabel = 'No options available.',
  onClose,
  onSelect,
  options,
  searchable = false,
  selectedKey = null,
  title,
  visible,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('slide');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) => (
      option.label.toLocaleLowerCase().includes(normalized)
      || option.description?.toLocaleLowerCase().includes(normalized)
    ));
  }, [deferredQuery, options]);

  return (
    <Modal
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.screen, light && styles.screenLight]}
        testID="native-option-picker"
      >
        <View style={[styles.header, light && styles.headerLight]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SELECT AN OPTION</Text>
            <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, light && styles.textLight]}>
              {title}
            </Text>
          </View>
          <Pressable accessibilityLabel="Close options" accessibilityRole="button" onPress={onClose} style={[styles.close, light && styles.closeLight]}>
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
        </View>
        {searchable ? (
          <TextInput
            accessibilityLabel={`Search ${title}`}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={light ? '#657478' : '#829397'}
            style={[styles.search, light && styles.searchLight]}
            value={query}
          />
        ) : null}
        <FlatList
          contentContainerStyle={styles.content}
          data={filtered}
          keyboardShouldPersistTaps="always"
          keyExtractor={(option) => option.key}
          ListEmptyComponent={<Text style={[styles.empty, light && styles.secondaryLight]}>{emptyLabel}</Text>}
          renderItem={({ item }) => {
            const selected = item.key === selectedKey;
            return (
              <Pressable
                accessible
                accessibilityLabel={`Select ${item.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.option,
                  light && styles.optionLight,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                {item.imageUri ? (
                  <Image fadeDuration={0} resizeMode="contain" source={{ uri: item.imageUri }} style={styles.image} />
                ) : null}
                <View style={styles.optionCopy}>
                  <Text numberOfLines={2} style={[styles.optionLabel, light && styles.textLight]}>{item.label}</Text>
                  {item.description ? (
                    <Text numberOfLines={2} style={[styles.optionDescription, light && styles.secondaryLight]}>{item.description}</Text>
                  ) : null}
                </View>
                <View style={[styles.radio, light && styles.radioLight, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#090d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  header: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334448', backgroundColor: '#101719' },
  headerLight: { borderBottomColor: '#b5c2c4', backgroundColor: '#ffffff' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 2, color: '#f8fcfd', fontSize: 22, fontWeight: '900' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#53666a', borderRadius: 24 },
  closeLight: { borderColor: '#8c9b9e' },
  closeText: { color: '#ffffff', fontSize: 28, lineHeight: 30 },
  search: { minHeight: 50, margin: 12, marginBottom: 0, paddingHorizontal: 14, color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#53666a', borderRadius: 11, backgroundColor: '#12191b' },
  searchLight: { color: '#172124', borderColor: '#8d9ca0', backgroundColor: '#ffffff' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 12, paddingBottom: 80, gap: 8 },
  option: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: '#34484c', borderRadius: 11, backgroundColor: '#141c1e' },
  optionLight: { borderColor: '#b3c0c2', backgroundColor: '#ffffff' },
  optionSelected: { borderColor: '#2f9cff', backgroundColor: 'rgba(47, 156, 255, 0.14)' },
  image: { width: 54, height: 54 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { color: '#f5fafb', fontSize: 15, fontWeight: '900' },
  optionDescription: { marginTop: 3, color: '#9cabad', fontSize: 12 },
  radio: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6a7a7d', borderRadius: 12 },
  radioLight: { borderColor: '#829194' },
  radioSelected: { borderColor: '#2f9cff' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2f9cff' },
  empty: { padding: 28, color: '#9cabad', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  textLight: { color: '#172124' },
  secondaryLight: { color: '#566467' },
});
