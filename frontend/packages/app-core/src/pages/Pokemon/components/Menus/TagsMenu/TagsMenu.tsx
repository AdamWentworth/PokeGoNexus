// TagsMenu.tsx

import React, { useState, useMemo } from 'react';
import { FaCheck, FaPlus, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import './TagsMenu.css';
import useFavoriteList from '@/hooks/sort/useFavoriteList';
import TagItems, { type TagSummary } from './TagItems';
import type { TagBuckets, TagItem } from '@/types/tags';
import type { AllVariants } from '@/types/pokemonVariants';
import CustomTagEditorSheet from './CustomTagEditorSheet';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import {
  fromCustomTagFilter,
  toCustomTagFilter,
} from '@/features/tags/utils/customTagSelectors';
import type { TagDef } from '@/db/tagsDB';
import type { CustomTagParent } from '@shared-contracts/users';
import type { PokemonTagOrderKey } from '@shared-contracts/users';
import { feedback } from '@/components/feedback';

export interface TagsMenuProps {
  onSelectTag: (tagName: string) => void;
  activeTags : TagBuckets;
  variants   : AllVariants;
  panel?: 'inventory' | 'wishlist' | 'all';
  tagFilter?: string;
  onClearTagFilter?: () => void;
  isEditable?: boolean;
}

const PREVIEW_LIMIT = 18;
const SYSTEM_TAG_SELECTORS: Record<CustomTagParent, Record<string, string>> = {
  caught: {
    'system:caught': 'Caught',
    'system:favorites': 'Favorites',
    'system:trade': 'Trade',
  },
  wanted: {
    'system:wanted': 'Wanted',
    'system:most-wanted': 'Most Wanted',
  },
};

const selectorForOrderKey = (
  parent: CustomTagParent,
  key: PokemonTagOrderKey,
): string | null => {
  if (key.startsWith('custom:')) return key;
  return SYSTEM_TAG_SELECTORS[parent][key] ?? null;
};

const orderKeyForSelector = (
  parent: CustomTagParent,
  selector: string,
): PokemonTagOrderKey | null => {
  if (selector.startsWith('custom:')) return selector as PokemonTagOrderKey;
  const entry = Object.entries(SYSTEM_TAG_SELECTORS[parent])
    .find(([, systemSelector]) => systemSelector === selector);
  return entry?.[0] as PokemonTagOrderKey | undefined ?? null;
};

function summarizeRecord(record: Record<string, TagItem> | undefined): TagSummary {
  if (!record) return { count: 0, preview: [] };

  const preview: TagItem[] = [];
  let count = 0;

  for (const item of Object.values(record)) {
    count += 1;
    if (preview.length < PREVIEW_LIMIT && item?.currentImage) {
      preview.push(item);
    }
  }

  return { count, preview };
}

function summarizeArray(items: TagItem[]): TagSummary {
  const preview: TagItem[] = [];
  let count = 0;

  for (const item of items) {
    count += 1;
    if (preview.length < PREVIEW_LIMIT && item?.currentImage) {
      preview.push(item);
    }
  }

  return { count, preview };
}

const TagsMenu: React.FC<TagsMenuProps> = ({
  onSelectTag,
  activeTags,
  panel = 'all',
  tagFilter = '',
  onClearTagFilter,
  isEditable = false,
}) => {
  const customTags = useTagsStore((state) => state.customTags);
  const createCustomTag = useTagsStore((state) => state.createCustomTag);
  const updateCustomTag = useTagsStore((state) => state.updateCustomTag);
  const deleteCustomTag = useTagsStore((state) => state.deleteCustomTag);
  const tagOrders = useTagsStore((state) => state.tagOrders);
  const saveTagOrder = useTagsStore((state) => state.saveTagOrder);
  const [editingTag, setEditingTag] = useState<TagDef | null>(null);
  const [creatingFor, setCreatingFor] = useState<CustomTagParent | null>(null);
  const [reorderingParent, setReorderingParent] = useState<CustomTagParent | null>(null);
  const [draftOrder, setDraftOrder] = useState<PokemonTagOrderKey[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  // Derive system-children from the currently active buckets (own or foreign).
  // This prevents foreign profile views from accidentally using local-user children.
  const derivedChildren = useMemo(() => {
    const caught = activeTags.caught ?? {};
    const wanted = activeTags.wanted ?? {};

    const favorite: Record<string, TagItem> = {};
    const trade: Record<string, TagItem> = {};
    const mostWanted: Record<string, TagItem> = {};

    for (const [id, item] of Object.entries(caught)) {
      if (item.favorite) favorite[id] = item;
      if (item.is_for_trade) trade[id] = item;
    }

    for (const [id, item] of Object.entries(wanted)) {
      if (item.most_wanted) mostWanted[id] = item;
    }

    return { caught: { favorite, trade }, wanted: { mostWanted } };
  }, [activeTags]);

  /* ----- tag summaries -------------------------------------------- */
  const favoriteItems = useMemo(
    () => Object.values(derivedChildren.caught.favorite),
    [derivedChildren],
  );
  const sortedFavorites = useFavoriteList(favoriteItems);

  const customTagEntries = useMemo(() => {
    if (!isEditable) return { caught: [], wanted: [] } as Record<CustomTagParent, Array<[string, typeof customTags.caught[string]]>>;
    const sortEntries = (entries: Array<[string, typeof customTags.caught[string]]>) =>
      entries.sort(([, left], [, right]) =>
        (left.tag.sort ?? 0) - (right.tag.sort ?? 0) || left.tag.name.localeCompare(right.tag.name),
      );
    return {
      caught: sortEntries(Object.entries(customTags.caught)),
      wanted: sortEntries(Object.entries(customTags.wanted)),
    };
  }, [customTags, isEditable]);

  const tagSummaries = useMemo<Record<string, TagSummary>>(
    () => {
      const summaries: Record<string, TagSummary> = {
      Favorites: summarizeArray(sortedFavorites), // keep favorite ordering
      Caught: summarizeRecord(activeTags.caught),
      Trade: summarizeRecord(derivedChildren.caught.trade),
      Wanted: summarizeRecord(activeTags.wanted),
      'Most Wanted': summarizeRecord(derivedChildren.wanted.mostWanted),
      };
      for (const entries of Object.values(customTagEntries)) {
        for (const [tagId, bucket] of entries) {
          summaries[toCustomTagFilter(tagId)] = summarizeRecord(bucket.items);
        }
      }
      return summaries;
    },
    [
      activeTags.caught,
      activeTags.wanted,
      derivedChildren.caught.trade,
      derivedChildren.wanted.mostWanted,
      sortedFavorites,
      customTagEntries,
    ]
  );

  const tagMetadata = useMemo(() => {
    const metadata: Record<string, { color?: string | null; displayName: string; isCustom: boolean }> = {};
    metadata.Caught = { displayName: 'All Caught', isCustom: false };
    metadata.Trade = { displayName: 'For Trade', isCustom: false };
    metadata.Favorites = { displayName: 'Favorites', isCustom: false };
    metadata.Wanted = { displayName: 'All Wanted', isCustom: false };
    metadata['Most Wanted'] = { displayName: 'Most Wanted', isCustom: false };
    for (const entries of Object.values(customTagEntries)) {
      for (const [tagId, bucket] of entries) {
        metadata[toCustomTagFilter(tagId)] = {
          color: bucket.tag.color,
          displayName: bucket.tag.name,
          isCustom: true,
        };
      }
    }
    return metadata;
  }, [customTagEntries]);

  const handleSelectTagInternal = (name: string) => onSelectTag(name);

  /* ----- counts for footers --------------------------------------- */
  const counts = {
    caught : tagSummaries.Caught?.count ?? 0,
    wanted : tagSummaries.Wanted?.count ?? 0,
  };

  const showInventory = panel === 'all' || panel === 'inventory';
  const showWishlist = panel === 'all' || panel === 'wishlist';
  const visibleOrders = useMemo<Record<CustomTagParent, PokemonTagOrderKey[]>>(() => {
    const build = (parent: CustomTagParent) => {
      const available = [
        ...Object.keys(SYSTEM_TAG_SELECTORS[parent]) as PokemonTagOrderKey[],
        ...customTagEntries[parent].map(([tagId]) => toCustomTagFilter(tagId) as PokemonTagOrderKey),
      ];
      const allowed = new Set(available);
      const ordered = tagOrders[parent].filter((key) => allowed.has(key));
      for (const key of available) {
        if (!ordered.includes(key)) ordered.push(key);
      }
      return ordered;
    };
    return { caught: build('caught'), wanted: build('wanted') };
  }, [customTagEntries, tagOrders]);

  const currentOrder = (parent: CustomTagParent): PokemonTagOrderKey[] =>
    reorderingParent === parent ? draftOrder : visibleOrders[parent];

  const orderedTagNames = (parent: CustomTagParent): string[] =>
    currentOrder(parent)
      .map((key) => selectorForOrderKey(parent, key))
      .filter((selector): selector is string => Boolean(selector));

  const startReordering = (parent: CustomTagParent) => {
    setDraftOrder([...visibleOrders[parent]]);
    setReorderingParent(parent);
  };

  const cancelReordering = () => {
    if (isSavingOrder) return;
    setDraftOrder([]);
    setReorderingParent(null);
  };

  const reorderTag = (
    parent: CustomTagParent,
    sourceSelector: string,
    targetSelector: string,
    placement: 'before' | 'after',
  ) => {
    if (reorderingParent !== parent) return;
    const source = orderKeyForSelector(parent, sourceSelector);
    const target = orderKeyForSelector(parent, targetSelector);
    if (!source || !target || source === target) return;
    setDraftOrder((current) => {
      const sourceIndex = current.indexOf(source);
      const targetIndex = current.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      const targetAfterRemoval = next.indexOf(target);
      const insertionIndex = targetAfterRemoval + (placement === 'after' ? 1 : 0);
      next.splice(insertionIndex, 0, source);
      return next;
    });
  };

  const commitReordering = async (parent: CustomTagParent) => {
    if (isSavingOrder || reorderingParent !== parent) return;
    setIsSavingOrder(true);
    try {
      await saveTagOrder(parent, draftOrder);
      setDraftOrder([]);
      setReorderingParent(null);
      feedback.success('Tag order saved.');
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Could not save your tag order.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const renderTagGroup = ({
    tagNames,
    onSelect,
    onEdit,
    parent,
  }: {
    tagNames: string[];
    onSelect: (name: string) => void;
    onEdit?: (name: string) => void;
    parent: CustomTagParent;
  }) => (
    <TagItems
      tagNames={tagNames}
      tagSummaries={tagSummaries}
      onSelectTag={onSelect}
      tagMetadata={tagMetadata}
      onEditTag={onEdit}
      reorderMode={reorderingParent === parent}
      onReorderTag={(source, target, placement) => reorderTag(parent, source, target, placement)}
    />
  );

  const closeEditor = () => {
    setEditingTag(null);
    setCreatingFor(null);
  };

  const editBySelector = (selector: string) => {
    const entry = [...customTagEntries.caught, ...customTagEntries.wanted]
      .find(([tagId]) => toCustomTagFilter(tagId) === selector);
    if (entry) setEditingTag(entry[1].tag);
  };

  const handleDeleteCustomTag = async (tagId: string) => {
    await deleteCustomTag(tagId);
    if (fromCustomTagFilter(tagFilter) === tagId) {
      onClearTagFilter?.();
    }
  };

  /* ----- render ---------------------------------------------------- */
  return (
    <div className={`tags-menu tags-menu-${panel}`}>
      <>
          {/* TAG TREE */}
          <div className="tag-tree">
            {/* Inventory (Caught) */}
            {showInventory && (
              <section className="tag-order-section" aria-label="Inventory tags">
                <header className="tag-order-toolbar">
                  <div>
                    {panel === 'all' ? <h2>Inventory tags</h2> : null}
                    <span>{counts.caught} Pokémon</span>
                  </div>
                  {isEditable ? (
                    reorderingParent === 'caught' ? (
                      <div className="tag-order-actions">
                        <button onClick={cancelReordering} type="button">
                          <FaTimes aria-hidden="true" /> Cancel
                        </button>
                        <button
                          className="tag-order-save"
                          disabled={isSavingOrder}
                          onClick={() => void commitReordering('caught')}
                          type="button"
                        >
                          <FaCheck aria-hidden="true" />
                          {isSavingOrder ? 'Saving…' : 'Save order'}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="tag-order-start"
                        onClick={() => startReordering('caught')}
                        type="button"
                      >
                        <FaSortAmountDown aria-hidden="true" /> Arrange
                      </button>
                    )
                  ) : null}
                </header>
                {reorderingParent === 'caught' ? (
                  <p className="tag-order-help">Press and drag a grip to move its tag.</p>
                ) : null}
                <div className="tag-sublist">
                  {renderTagGroup({
                    parent: 'caught',
                    tagNames: orderedTagNames('caught'),
                    onSelect: handleSelectTagInternal,
                    onEdit: editBySelector,
                  })}
                  {isEditable && reorderingParent !== 'caught' ? (
                    <button className="tag-create-button" onClick={() => setCreatingFor('caught')} type="button">
                      <FaPlus aria-hidden="true" /> New inventory tag
                    </button>
                  ) : null}
                </div>
              </section>
            )}

            {/* Wanted */}
            {showWishlist && (
              <section className="tag-order-section tag-order-section-wanted" aria-label="Wanted tags">
                <header className="tag-order-toolbar">
                  <div>
                    {panel === 'all' ? <h2>Wanted tags</h2> : null}
                    <span>{counts.wanted} Pokémon</span>
                  </div>
                  {isEditable ? (
                    reorderingParent === 'wanted' ? (
                      <div className="tag-order-actions">
                        <button onClick={cancelReordering} type="button">
                          <FaTimes aria-hidden="true" /> Cancel
                        </button>
                        <button
                          className="tag-order-save"
                          disabled={isSavingOrder}
                          onClick={() => void commitReordering('wanted')}
                          type="button"
                        >
                          <FaCheck aria-hidden="true" />
                          {isSavingOrder ? 'Saving…' : 'Save order'}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="tag-order-start"
                        onClick={() => startReordering('wanted')}
                        type="button"
                      >
                        <FaSortAmountDown aria-hidden="true" /> Arrange
                      </button>
                    )
                  ) : null}
                </header>
                {reorderingParent === 'wanted' ? (
                  <p className="tag-order-help">Press and drag a grip to move its tag.</p>
                ) : null}
                <div className="tag-sublist">
                  {renderTagGroup({
                    parent: 'wanted',
                    tagNames: orderedTagNames('wanted'),
                    onSelect: handleSelectTagInternal,
                    onEdit: editBySelector,
                  })}
                  {isEditable && reorderingParent !== 'wanted' ? (
                    <button className="tag-create-button tag-create-button-wanted" onClick={() => setCreatingFor('wanted')} type="button">
                      <FaPlus aria-hidden="true" /> New wanted tag
                    </button>
                  ) : null}
                </div>
              </section>
            )}
          </div>
          {(editingTag || creatingFor) ? (
            <CustomTagEditorSheet
              parent={(editingTag?.parent === 'wanted' ? 'wanted' : creatingFor ?? 'caught')}
              tag={editingTag}
              onClose={closeEditor}
              onCreate={async (input) => { await createCustomTag(input); }}
              onUpdate={async (tagId, input) => { await updateCustomTag(tagId, input); }}
              onDelete={handleDeleteCustomTag}
            />
          ) : null}
        </>
    </div>
  );
};

export default TagsMenu;
