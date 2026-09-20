import React, { useCallback } from 'react';
import { buildClearActiveTagMessage } from '@pokemongonexus/shared-ui-tokens';

import CollectionPriorityStar from '@/components/pokemonComponents/CollectionPriorityStar';
import { useModal } from '@/contexts/ModalContext';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { fromCustomTagFilter } from '@/features/tags/utils/customTagSelectors';

import './ActiveTagFilterChip.css';

type ActiveTagFilterChipProps = {
  tagFilter: string;
  onClearTagFilter?: () => void;
};

const toTagFilterClass = (tagFilter: string): string =>
  tagFilter
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ActiveTagFilterChip: React.FC<ActiveTagFilterChipProps> = ({
  tagFilter,
  onClearTagFilter,
}) => {
  const { confirm } = useModal();
  const trimmedTagFilter = tagFilter.trim();
  const customTagId = fromCustomTagFilter(trimmedTagFilter);
  const customTag = useTagsStore((state) => {
    if (!customTagId) return null;
    return state.customTags.caught[customTagId]?.tag ?? state.customTags.wanted[customTagId]?.tag ?? null;
  });
  const displayName = customTag?.name ?? trimmedTagFilter;

  const handleClearActiveTagFilter = useCallback(async () => {
    if (!onClearTagFilter) return;
    const confirmed = await confirm(buildClearActiveTagMessage(displayName));
    if (confirmed) {
      onClearTagFilter();
    }
  }, [confirm, displayName, onClearTagFilter]);

  if (!trimmedTagFilter) return null;

  const isFavoritesFilter = trimmedTagFilter === 'Favorites';
  const tagFilterClass = toTagFilterClass(trimmedTagFilter);

  return (
    <div
      className={[
        'active-tag-filter-row',
        `active-tag-filter-${tagFilterClass}`,
        'active-tag-filter-placement-search',
        isFavoritesFilter ? 'active-tag-filter-with-icon' : '',
        !onClearTagFilter ? 'active-tag-filter-required' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${displayName} tag filter${
        onClearTagFilter ? '' : ', required while viewing this catalog'
      }`}
      data-custom={customTag?.color ? 'true' : undefined}
      style={customTag?.color ? { '--active-custom-tag-color': customTag.color } as React.CSSProperties : undefined}
      title={
        onClearTagFilter
          ? undefined
          : 'A tag is required while viewing another trainer’s catalog.'
      }
    >
      {isFavoritesFilter && (
        <CollectionPriorityStar
          filled
          tone="favorite"
          className="active-tag-filter-icon"
        />
      )}
      <span className="active-tag-filter-name">{displayName}</span>
      {onClearTagFilter ? (
        <button
          type="button"
          className="active-tag-filter-clear"
          onClick={handleClearActiveTagFilter}
          aria-label={`Clear ${displayName} tag filter`}
          title={`Clear ${displayName} tag`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

export default React.memo(ActiveTagFilterChip);
