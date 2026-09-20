import React, { useEffect, useState } from 'react';
import { FaTag, FaTimes, FaTrashAlt } from 'react-icons/fa';

import OverlayDismissButton from '@/components/OverlayDismissButton';
import OverlayPortal from '@/components/OverlayPortal';
import { feedback } from '@/components/feedback';
import { useModal } from '@/contexts/ModalContext';
import type { TagDef } from '@/db/tagsDB';
import type { CustomTagParent } from '@shared-contracts/users';

import './CustomTagEditorSheet.css';

const TAG_COLORS = [
  '#2563EB', '#0D9488', '#16A34A', '#CA8A04',
  '#EA580C', '#E11D48', '#DB2777', '#7C3AED',
];

type CustomTagEditorSheetProps = {
  parent: CustomTagParent;
  tag?: TagDef | null;
  onClose: () => void;
  onCreate: (input: { parent: CustomTagParent; name: string; color: string }) => Promise<void>;
  onDelete: (tagId: string) => Promise<void>;
  onUpdate: (tagId: string, input: { name: string; color: string }) => Promise<void>;
};

const CustomTagEditorSheet: React.FC<CustomTagEditorSheetProps> = ({
  parent,
  tag,
  onClose,
  onCreate,
  onDelete,
  onUpdate,
}) => {
  const { confirm } = useModal();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? (parent === 'wanted' ? '#E11D48' : '#2563EB'));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(tag?.name ?? '');
    setColor(tag?.color ?? (parent === 'wanted' ? '#E11D48' : '#2563EB'));
  }, [parent, tag]);

  const run = async (operation: () => Promise<void>) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await operation();
      onClose();
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Could not save this tag.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      feedback.warning('Give this tag a name.');
      return;
    }
    void run(async () => {
      if (tag) {
        await onUpdate(tag.tag_id, { name: normalizedName, color });
        feedback.success(`${normalizedName} was updated.`);
      } else {
        await onCreate({ parent, name: normalizedName, color });
        feedback.success(`${normalizedName} was created.`);
      }
    });
  };

  const handleDelete = async () => {
    if (!tag || isSaving) return;
    const accepted = await confirm(
      `Delete ${tag.name}? Pokémon will keep their collection status, but this custom tag will be removed from them.`,
    );
    if (!accepted) return;
    void run(async () => {
      await onDelete(tag.tag_id);
      feedback.info(`${tag.name} was deleted.`);
    });
  };

  return (
    <OverlayPortal closeOnBackdrop onClose={onClose}>
      <div className="custom-tag-editor-overlay">
        <section aria-labelledby="custom-tag-editor-title" aria-modal="true" className="custom-tag-editor" role="dialog">
          <header className="custom-tag-editor__header">
            <div>
              <span><FaTag aria-hidden="true" /> Custom tag</span>
              <h2 id="custom-tag-editor-title">{tag ? 'Edit tag' : `New ${parent === 'wanted' ? 'Wanted' : 'Inventory'} tag`}</h2>
            </div>
            <OverlayDismissButton aria-label="Close tag editor" className="custom-tag-editor__close" onDismiss={onClose}>
              <FaTimes aria-hidden="true" />
            </OverlayDismissButton>
          </header>

          <div className="custom-tag-editor__body">
            <p>Organize your {parent === 'wanted' ? 'wishlist' : 'collection'} without changing a Pokémon’s built-in status.</p>
            <label>
              <span>Tag name</span>
              <input autoFocus maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="e.g. Community Day" value={name} />
            </label>
            <fieldset>
              <legend>Color</legend>
              <div className="custom-tag-editor__colors">
                {TAG_COLORS.map((option) => (
                  <button
                    aria-label={`Use ${option}`}
                    aria-pressed={color === option}
                    key={option}
                    onClick={() => setColor(option)}
                    style={{ '--tag-swatch': option } as React.CSSProperties}
                    type="button"
                  />
                ))}
              </div>
            </fieldset>
            <div className="custom-tag-editor__preview" style={{ '--tag-preview': color } as React.CSSProperties}>
              <span aria-hidden="true" />
              <strong>{name.trim() || 'Tag preview'}</strong>
            </div>
          </div>

          <footer className="custom-tag-editor__footer">
            {tag ? (
              <button className="custom-tag-editor__delete" disabled={isSaving} onClick={() => void handleDelete()} type="button">
                <FaTrashAlt aria-hidden="true" /> Delete
              </button>
            ) : <span />}
            <button className="custom-tag-editor__save" disabled={isSaving} onClick={handleSave} type="button">
              {isSaving ? 'Saving…' : tag ? 'Save changes' : 'Create tag'}
            </button>
          </footer>
        </section>
      </div>
    </OverlayPortal>
  );
};

export default CustomTagEditorSheet;
