import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  CreateCustomTagRequest,
  CustomTagDefinition,
  CustomTagParent,
  UpdateCustomTagRequest,
} from '@pokemongonexus/shared-contracts/users';
import { NativeConfirmationDialog } from '../../components/NativeConfirmationDialog';
import { useNativeModalAnimation } from '../settings/useNativeMotion';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

const TAG_COLORS = [
  '#2563EB', '#0D9488', '#16A34A', '#CA8A04',
  '#EA580C', '#E11D48', '#DB2777', '#7C3AED',
] as const;

type Props = {
  parent: CustomTagParent;
  tag?: CustomTagDefinition | null;
  visible: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (request: CreateCustomTagRequest) => Promise<unknown>;
  onDelete: (tagId: string) => Promise<unknown>;
  onUpdate: (tagId: string, request: UpdateCustomTagRequest) => Promise<unknown>;
};

const NativeCustomTagEditorForm = ({
  parent,
  tag = null,
  visible,
  isSaving,
  onClose,
  onCreate,
  onDelete,
  onUpdate,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('slide');
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? (parent === 'wanted' ? '#E11D48' : '#2563EB'));
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const surface = light ? '#f7faf9' : '#252525';
  const text = light ? '#243b37' : '#f7fffc';
  const secondary = light ? '#50645f' : '#b7c3c0';
  const field = light ? '#ffffff' : '#333333';
  const border = light ? '#b8c8c4' : '#565f5d';

  const save = async () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setError('Give this tag a name.');
      return;
    }
    setError(null);
    try {
      if (tag) await onUpdate(tag.tag_id, { name: normalizedName, color });
      else await onCreate({ parent, name: normalizedName, color });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this tag.');
    }
  };

  const confirmDelete = () => {
    if (!tag || isSaving || isDeleting) return;
    setDeleteConfirmationOpen(true);
  };

  const deleteTag = async () => {
    if (!tag || isSaving || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(tag.tag_id);
      setDeleteConfirmationOpen(false);
      onClose();
    } catch (caught) {
      setDeleteConfirmationOpen(false);
      setError(caught instanceof Error ? caught.message : 'Could not delete this tag.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityLabel={tag ? 'Edit tag' : `New ${parent === 'wanted' ? 'Wanted' : 'Inventory'} tag`}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}
        >
          <View style={[styles.header, { borderBottomColor: border }]}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>◆ CUSTOM TAG</Text>
              <Text style={[styles.title, { color: text }]}>
                {tag ? 'Edit tag' : `New ${parent === 'wanted' ? 'Wanted' : 'Inventory'} tag`}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close tag editor" onPress={onClose} style={[styles.close, { borderColor: border }]}>
              <Text style={[styles.closeText, { color: text }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.description, { color: secondary }]}>
              Organize your {parent === 'wanted' ? 'wishlist' : 'collection'} without changing a Pokémon’s built-in status.
            </Text>
            <Text style={[styles.label, { color: text }]}>Tag name</Text>
            <TextInput
              accessibilityLabel="Tag name"
              autoFocus
              maxLength={40}
              onChangeText={setName}
              placeholder="e.g. Community Day"
              placeholderTextColor={secondary}
              style={[styles.input, { backgroundColor: field, borderColor: border, color: text }]}
              value={name}
            />
            <Text style={[styles.label, styles.colorLabel, { color: text }]}>Color</Text>
            <View style={styles.colors}>
              {TAG_COLORS.map((option) => {
                const selected = option === color;
                return (
                  <Pressable
                    accessibilityLabel={`Use ${option}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option}
                    onPress={() => setColor(option)}
                    style={[
                      styles.swatch,
                      { backgroundColor: option },
                      selected ? { borderColor: text, shadowColor: option } : null,
                    ]}
                  />
                );
              })}
            </View>
            <View style={[styles.preview, { backgroundColor: `${color}21`, borderColor: `${color}8a` }]}>
              <View style={[styles.previewDot, { backgroundColor: color }]} />
              <Text style={[styles.previewText, { color: text }]}>{name.trim() || 'Tag preview'}</Text>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: border }]}>
            {tag ? (
              <Pressable accessibilityRole="button" disabled={isSaving || isDeleting} onPress={confirmDelete} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : <View />}
            <Pressable accessibilityRole="button"
              disabled={isSaving || isDeleting}
              onPress={() => void save()}
              style={[styles.saveButton, isSaving && styles.disabled]}
            >
              <Text style={styles.saveText}>
                {isSaving ? 'Saving…' : tag ? 'Save changes' : 'Create tag'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <NativeConfirmationDialog
        body="Pokémon will keep their collection status, but this custom tag will be removed from them."
        confirmLabel="Delete"
        isPending={isDeleting}
        onCancel={() => setDeleteConfirmationOpen(false)}
        onConfirm={() => void deleteTag()}
        title={`Delete ${tag?.name ?? 'tag'}?`}
        tone="danger"
        visible={deleteConfirmationOpen}
      />
    </Modal>
  );
};

export const NativeCustomTagEditorSheet = (props: Props) => {
  if (!props.visible) return null;
  return (
    <NativeCustomTagEditorForm
      {...props}
      key={`${props.parent}:${props.tag?.tag_id ?? 'new'}`}
      visible
    />
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0000009e',
  },
  sheet: {
    width: '100%',
    maxHeight: '96%',
    borderWidth: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: '#2196f3', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 3, fontSize: 24, fontWeight: '900' },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 22,
  },
  closeText: { fontSize: 30, lineHeight: 32 },
  body: { padding: 20 },
  description: { marginBottom: 18, fontSize: 14, lineHeight: 21 },
  label: { marginBottom: 7, fontSize: 14, fontWeight: '900' },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, fontSize: 16 },
  colorLabel: { marginTop: 18 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 48,
    height: 48,
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 24,
    shadowOpacity: 0.55,
    shadowRadius: 7,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 12, borderWidth: 1, borderRadius: 11 },
  previewDot: { width: 16, height: 16, borderRadius: 8 },
  previewText: { fontWeight: '900' },
  error: { marginTop: 14, color: '#ef5b72', fontWeight: '800' },
  footer: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  deleteButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#ef5b72', borderRadius: 10, backgroundColor: '#ef5b721c' },
  deleteText: { color: '#ef5b72', fontWeight: '900' },
  saveButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#2196f3' },
  saveText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
