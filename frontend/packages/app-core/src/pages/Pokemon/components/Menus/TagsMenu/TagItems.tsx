// TagItems.tsx
import React, {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FaGripVertical } from 'react-icons/fa';
import CollectionPriorityStar from '@/components/pokemonComponents/CollectionPriorityStar';
import type { TagItem } from '@/types/tags';
import './TagItems.css';

export interface TagSummary {
  count: number;
  preview: TagItem[];
}

export interface TagItemsProps {
  tagNames: string[];
  tagSummaries: Record<string, TagSummary>;
  onSelectTag: (tagName: string) => void;
  tagMetadata?: Record<string, {
    color?: string | null;
    displayName: string;
    isCustom?: boolean;
  }>;
  onEditTag?: (tagName: string) => void;
  reorderMode?: boolean;
  onReorderTag?: (
    sourceTagName: string,
    targetTagName: string,
    placement: 'before' | 'after',
  ) => void;
}

interface DragPreview {
  layer: HTMLDivElement;
  preview: HTMLElement;
  handle: HTMLButtonElement;
  sourceTag: string;
  pointerId: number;
  originLeft: number;
  originTop: number;
  offsetX: number;
  offsetY: number;
  scope: HTMLElement;
  indicator: HTMLElement | null;
  cleanupListeners: () => void;
}

interface DropTarget {
  element: HTMLElement;
  placement: 'before' | 'after';
  tagName: string;
}

function buildKey(p: TagItem, idx: number, bucket: string): string {
  if (p.instance_id) return p.instance_id;
  const idPart  = p.pokemon_id ?? p.instance_id ?? 'unk';
  const variant = p.variantType ?? 'base';
  return `${bucket}-${idPart}-${variant}-${idx}`;
}

const TagItems: React.FC<TagItemsProps> = ({
  tagNames,
  tagSummaries,
  onSelectTag,
  tagMetadata = {},
  onEditTag,
  reorderMode = false,
  onReorderTag,
}) => {
  const [draggingTag, setDraggingTag] = useState<string | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousPositionsRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nextPositions = new Map<string, number>();
    const cards = list.querySelectorAll<HTMLElement>(':scope > [data-tag-selector]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    cards.forEach((card) => {
      const tagName = card.dataset.tagSelector;
      if (!tagName) return;
      const currentTop = card.offsetTop;
      nextPositions.set(tagName, currentTop);
      const previousTop = previousPositionsRef.current.get(tagName);
      const deltaY = previousTop === undefined ? 0 : previousTop - currentTop;
      if (reduceMotion || Math.abs(deltaY) < 1 || typeof card.animate !== 'function') return;
      card.animate(
        [
          { transform: `translate3d(0, ${deltaY}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        },
      );
    });
    previousPositionsRef.current = nextPositions;
  }, [tagNames]);

  const clearDropIndicator = (drag: DragPreview) => {
    drag.indicator?.removeAttribute('data-drop-position');
    drag.indicator = null;
  };

  const clearDrag = (drag: DragPreview) => {
    if (dragPreviewRef.current !== drag) return;
    dragPreviewRef.current = null;
    drag.cleanupListeners();
    clearDropIndicator(drag);
    drag.layer.remove();
    document.body.classList.remove('tag-drag-active');
    lastDragTargetRef.current = null;
    setDraggingTag(null);
    if (drag.handle.hasPointerCapture?.(drag.pointerId)) {
      try {
        drag.handle.releasePointerCapture(drag.pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
    }
  };

  useEffect(() => () => {
    const drag = dragPreviewRef.current;
    if (!drag) return;
    dragPreviewRef.current = null;
    drag.cleanupListeners();
    drag.indicator?.removeAttribute('data-drop-position');
    drag.layer.remove();
    document.body.classList.remove('tag-drag-active');
  }, []);

  const findDropTarget = (
    clientX: number,
    clientY: number,
    drag: DragPreview,
  ): DropTarget | null => {
    const cards = [...drag.scope.querySelectorAll<HTMLElement>('[data-tag-selector]')]
      .filter((card) => (
        !card.closest('.tag-drag-layer')
        && card.dataset.tagSelector
        && card.dataset.tagSelector !== drag.sourceTag
      ));
    if (cards.length === 0) return null;

    const directCard = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-tag-selector]');
    if (
      directCard
      && drag.scope.contains(directCard)
      && !directCard.closest('.tag-drag-layer')
      && directCard.dataset.tagSelector
      && directCard.dataset.tagSelector !== drag.sourceTag
    ) {
      const bounds = directCard.getBoundingClientRect();
      return {
        element: directCard,
        placement: clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
        tagName: directCard.dataset.tagSelector,
      };
    }

    // A fast move or release can land in the gap between cards. Resolve that
    // position against the nearest card edge instead of leaving the preview
    // floating or snapping to an arbitrary bucket.
    let nearest: DropTarget | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const card of cards) {
      const bounds = card.getBoundingClientRect();
      const candidates = [
        { distance: Math.hypot(clientX - Math.min(Math.max(clientX, bounds.left), bounds.right), clientY - bounds.top), placement: 'before' as const },
        { distance: Math.hypot(clientX - Math.min(Math.max(clientX, bounds.left), bounds.right), clientY - bounds.bottom), placement: 'after' as const },
      ];
      for (const candidate of candidates) {
        if (candidate.distance >= nearestDistance) continue;
        nearestDistance = candidate.distance;
        nearest = {
          element: card,
          placement: candidate.placement,
          tagName: card.dataset.tagSelector as string,
        };
      }
    }
    return nearest;
  };

  const updateDrag = (event: globalThis.PointerEvent, commitPlacement: boolean) => {
    const drag = dragPreviewRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();

    const translateX = event.clientX - drag.offsetX - drag.originLeft;
    const translateY = event.clientY - drag.offsetY - drag.originTop;
    drag.preview.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(1.025) rotate(0.2deg)`;

    const target = findDropTarget(event.clientX, event.clientY, drag);
    clearDropIndicator(drag);
    if (!target) return;
    target.element.dataset.dropPosition = target.placement;
    drag.indicator = target.element;

    const targetKey = `${target.tagName}:${target.placement}`;
    if (!commitPlacement || targetKey === lastDragTargetRef.current) return;
    lastDragTargetRef.current = targetKey;
    onReorderTag?.(drag.sourceTag, target.tagName, target.placement);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, tagName: string) => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.closest<HTMLElement>('.tag-item');
    if (!card) return;
    const scope = card.closest<HTMLElement>('.tag-items-list') ?? card.parentElement;
    if (!scope) return;

    const bounds = card.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'tags-menu tag-drag-layer';
    layer.setAttribute('aria-hidden', 'true');

    const preview = card.cloneNode(true) as HTMLElement;
    preview.classList.add('tag-item-drag-preview');
    preview.dataset.floating = 'true';
    preview.removeAttribute('tabindex');
    preview.querySelectorAll<HTMLElement>('button').forEach((button) => {
      button.setAttribute('tabindex', '-1');
    });
    Object.assign(preview.style, {
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    });
    layer.appendChild(preview);
    document.body.appendChild(layer);

    const previousDrag = dragPreviewRef.current;
    if (previousDrag) clearDrag(previousDrag);
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const onPointerMove = (pointerEvent: globalThis.PointerEvent) => {
      updateDrag(pointerEvent, false);
    };
    const onPointerUp = (pointerEvent: globalThis.PointerEvent) => {
      const activeDrag = dragPreviewRef.current;
      if (!activeDrag || pointerEvent.pointerId !== activeDrag.pointerId) return;
      updateDrag(pointerEvent, true);
      clearDrag(activeDrag);
    };
    const onPointerCancel = (pointerEvent: globalThis.PointerEvent) => {
      const activeDrag = dragPreviewRef.current;
      if (!activeDrag || pointerEvent.pointerId !== activeDrag.pointerId) return;
      clearDrag(activeDrag);
    };
    const onLostPointerCapture = (pointerEvent: globalThis.PointerEvent) => {
      const activeDrag = dragPreviewRef.current;
      if (!activeDrag || pointerEvent.pointerId !== activeDrag.pointerId) return;
      clearDrag(activeDrag);
    };
    const onWindowBlur = () => {
      const activeDrag = dragPreviewRef.current;
      if (activeDrag) clearDrag(activeDrag);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const activeDrag = dragPreviewRef.current;
      if (activeDrag) clearDrag(activeDrag);
    };
    const cleanupListeners = () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      handle.removeEventListener('lostpointercapture', onLostPointerCapture);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const drag: DragPreview = {
      layer,
      preview,
      handle,
      sourceTag: tagName,
      pointerId,
      originLeft: bounds.left,
      originTop: bounds.top,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      scope,
      indicator: null,
      cleanupListeners,
    };
    dragPreviewRef.current = drag;
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    handle.addEventListener('lostpointercapture', onLostPointerCapture);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    try {
      handle.setPointerCapture?.(pointerId);
    } catch {
      // Document-level listeners still make the drag safe when an older mobile
      // browser declines pointer capture.
    }
    document.body.classList.add('tag-drag-active');
    lastDragTargetRef.current = null;
    setDraggingTag(tagName);
  };

  return (
    <div className="tag-items-list" ref={listRef}>
    {tagNames.map((tagName) => {
      const summary = tagSummaries[tagName] ?? { count: 0, preview: [] };
      const metadata = tagMetadata[tagName];
      const displayName = metadata?.displayName ?? tagName;

      // Build preview elements and filter out nulls so empty-state logic is accurate
      const previewEls = summary.preview
        .map((p, i) => {
          if (!p?.currentImage) return null;

          const key    = buildKey(p, i, tagName);
          const gmax   = p.variantType?.includes('gigantamax');
          const dmax   = p.variantType?.includes('dynamax');
          const isMiss = displayName === 'Missing';

          return (
            <div key={key} className="tag-sprite">
              <img
                src={p.currentImage}
                alt={p.name ?? 'Unknown Pokémon'}
                className={`preview-image ${isMiss ? 'missing' : ''}`}
                draggable={false}
              />
              {(gmax || dmax) && (
                <img
                  src={gmax ? '/images/gigantamax.png' : '/images/dynamax.png'}
                  alt={gmax ? 'Gigantamax' : 'Dynamax'}
                  className={`tag-variant-overlay ${isMiss ? 'missing' : ''}`}
                  aria-hidden
                  draggable={false}
                />
              )}
            </div>
          );
        })
        .filter(Boolean) as React.JSX.Element[];

      const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (reorderMode) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onSelectTag(tagName);
      };
      const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onEditTag?.(tagName);
      };

      // DOM order: footer THEN preview (so pseudo works)
      // Visual order: preview first via flex column-reverse in CSS
      return (
        <div
          key={tagName}
          className={`tag-item${reorderMode ? ' tag-item-reordering' : ''}`}
          data-tag={tagName}
          data-tag-selector={tagName}
          data-custom={metadata?.isCustom ? 'true' : undefined}
          data-dragging={(draggingTag === tagName).toString()}
          data-empty={(!previewEls.length).toString()}
          style={metadata?.color ? {
            '--custom-tag-color': metadata.color,
          } as CSSProperties : undefined}
          onClick={() => {
            if (!reorderMode) onSelectTag(tagName);
          }}
          tabIndex={reorderMode ? -1 : 0}
          onKeyDown={onKey}
        >
          <div className="tag-footer">
            <span className="tag-title">
              {metadata?.color ? <span className="tag-title-color" aria-hidden="true" /> : null}
              {displayName}
            </span>
            <span className="tag-subtitle">
              {summary.count} Pokémon have this tag.
            </span>
            {tagName === 'Favorites' && !reorderMode && (
              <CollectionPriorityStar
                filled
                tone="favorite"
                className="tag-footer-icon"
              />
            )}
            {metadata?.isCustom && onEditTag && !reorderMode ? (
              <button
                aria-label={`Edit ${displayName} tag`}
                className="tag-edit-button"
                onClick={handleEdit}
                type="button"
              >
                Edit
              </button>
            ) : null}
            {reorderMode ? (
              <div className="tag-reorder-controls">
                <button
                  aria-label={`Press and drag ${displayName} to reorder`}
                  className="tag-drag-handle"
                  onPointerDown={(event) => beginDrag(event, tagName)}
                  type="button"
                >
                  <FaGripVertical aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="tag-preview">
            {previewEls.length ? (
              previewEls
            ) : (
              <p className="tag-empty-text">No Pokémon in this tag.</p>
            )}
          </div>
        </div>
      );
    })}
    </div>
  );
};

export default React.memo(TagItems);
