import React, { useMemo, useState } from 'react';
import {
  FaArrowRight,
  FaCheck,
  FaExchangeAlt,
  FaHeart,
  FaPlus,
  FaStar,
  FaTags,
  FaTimes,
  FaTrashAlt,
} from 'react-icons/fa';

import OverlayDismissButton from '@/components/OverlayDismissButton';
import OverlayPortal from '@/components/OverlayPortal';
import { feedback } from '@/components/feedback';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import CustomTagEditorSheet from '@/pages/Pokemon/components/Menus/TagsMenu/CustomTagEditorSheet';
import type { ConfirmInstanceStatusOptions } from '@/pages/Pokemon/services/changeInstanceTag/hooks/useHandleChangeTags';
import type {
  InstanceStatus,
  InstanceStatusMutationOutcome,
  InstanceStatusResultPatch,
} from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { CustomTagParent } from '@shared-contracts/users';
import {
  applyCustomTagChanges,
  getBulkToggleState,
  summarizeOrganizerSelection,
  type BulkToggleState,
} from '../utils/pokemonOrganizer';
import { toCustomTagFilter } from '../utils/customTagSelectors';

import './PokemonOrganizerSheet.css';

type OrganizerStage = 'main' | 'wanted-copy' | 'caught-conversion';
type BuiltInKey = 'favorite' | 'forTrade' | 'mostWanted';

type PokemonOrganizerSheetProps = {
  selectionKeys: Set<string>;
  onChangeStatus: (
    filter: InstanceStatus,
    options?: ConfirmInstanceStatusOptions,
  ) => Promise<InstanceStatusMutationOutcome[]>;
  onClearSelection: () => void;
  onClose: () => void;
};

const destinationCopy: Record<Exclude<InstanceStatus, 'Missing'>, { title: string; detail: string }> = {
  Caught: { title: 'Caught', detail: 'Add new collection instances.' },
  Trade: { title: 'For Trade', detail: 'Add caught instances listed for trade.' },
  Wanted: { title: 'Wanted', detail: 'Add new wishlist entries.' },
};

const toggleFromState = (state: BulkToggleState): boolean => state !== 'checked';

const PokemonOrganizerSheet: React.FC<PokemonOrganizerSheetProps> = ({
  selectionKeys,
  onChangeStatus,
  onClearSelection,
  onClose,
}) => {
  const instances = useInstancesStore((state) => state.instances);
  const updateDetails = useInstancesStore((state) => state.updateInstanceDetails);
  const customTags = useTagsStore((state) => state.customTags);
  const createCustomTag = useTagsStore((state) => state.createCustomTag);
  const updateCustomTag = useTagsStore((state) => state.updateCustomTag);
  const deleteCustomTag = useTagsStore((state) => state.deleteCustomTag);

  const summary = useMemo(
    () => summarizeOrganizerSelection(selectionKeys, instances),
    [instances, selectionKeys],
  );
  const [stage, setStage] = useState<OrganizerStage>('main');
  const [catalogDestination, setCatalogDestination] = useState<Exclude<InstanceStatus, 'Missing'>>('Caught');
  const [conversionDestination, setConversionDestination] = useState<'Caught' | 'Trade'>('Caught');
  const [builtInChanges, setBuiltInChanges] = useState<Partial<Record<BuiltInKey, boolean>>>({});
  const [customChanges, setCustomChanges] = useState<Record<string, boolean>>({});
  const [creatingParent, setCreatingParent] = useState<CustomTagParent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetChoices = () => {
    setBuiltInChanges({});
    setCustomChanges({});
  };

  const openStage = (nextStage: OrganizerStage) => {
    resetChoices();
    setStage(nextStage);
  };

  const parentInstanceIds = (parent: CustomTagParent): string[] => {
    if (stage === 'wanted-copy') return parent === 'wanted' ? summary.caughtInstanceIds : [];
    if (stage === 'caught-conversion') return parent === 'caught' ? summary.wantedInstanceIds : [];
    if (summary.kind === 'catalog') return [];
    return parent === 'caught' ? summary.caughtInstanceIds : summary.wantedInstanceIds;
  };

  const isCatalogDestinationParent = (parent: CustomTagParent) =>
    summary.kind === 'catalog' && stage === 'main' &&
    (parent === 'wanted' ? catalogDestination === 'Wanted' : catalogDestination !== 'Wanted');

  const isProspectiveParent = (parent: CustomTagParent) =>
    isCatalogDestinationParent(parent) ||
    (stage === 'wanted-copy' && parent === 'wanted') ||
    (stage === 'caught-conversion' && parent === 'caught');

  const getBuiltInState = (key: BuiltInKey): BulkToggleState => {
    if (key in builtInChanges) return builtInChanges[key] ? 'checked' : 'unchecked';
    if (isProspectiveParent(key === 'mostWanted' ? 'wanted' : 'caught')) return 'unchecked';
    const ids = key === 'mostWanted' ? summary.wantedInstanceIds : summary.caughtInstanceIds;
    return getBulkToggleState(ids, instances, (instance) => {
      if (key === 'favorite') return Boolean(instance.favorite);
      if (key === 'forTrade') return Boolean(instance.is_for_trade);
      return Boolean(instance.most_wanted);
    });
  };

  const setBuiltIn = (key: BuiltInKey) => {
    const state = getBuiltInState(key);
    setBuiltInChanges((current) => ({ ...current, [key]: toggleFromState(state) }));
  };

  const customTagState = (parent: CustomTagParent, tagId: string): BulkToggleState => {
    if (tagId in customChanges) return customChanges[tagId] ? 'checked' : 'unchecked';
    if (isProspectiveParent(parent)) return 'unchecked';
    const ids = parentInstanceIds(parent);
    return getBulkToggleState(ids, instances, (instance) => {
      const tags = parent === 'caught' ? instance.caught_tags : instance.wanted_tags;
      return Array.isArray(tags) && tags.includes(tagId);
    });
  };

  const toggleCustomTag = (parent: CustomTagParent, tagId: string) => {
    const state = customTagState(parent, tagId);
    setCustomChanges((current) => ({ ...current, [tagId]: toggleFromState(state) }));
  };

  const customChangesForParent = (parent: CustomTagParent): Record<string, boolean> => {
    const validIds = new Set(Object.keys(customTags[parent]));
    return Object.fromEntries(
      Object.entries(customChanges).filter(([tagId]) => validIds.has(tagId)),
    );
  };

  const selectedCustomTagsForParent = (parent: CustomTagParent) =>
    Object.values(customTags[parent])
      .map((bucket) => bucket.tag)
      .filter((tag) => customChanges[tag.tag_id] === true);

  const organizationOptions = (parent: CustomTagParent) => {
    const selectedTags = selectedCustomTagsForParent(parent);
    const details = selectedTags.map((tag) => `Add to tag: ${tag.name}`);
    if (parent === 'caught' && builtInChanges.favorite) details.push('Mark as Favorite');
    if (parent === 'wanted' && builtInChanges.mostWanted) details.push('Mark as Most Wanted');

    return {
      additionalConfirmationDetails: details,
      destinationFilter:
        selectedTags.length === 1
          ? toCustomTagFilter(selectedTags[0].tag_id)
          : undefined,
    };
  };

  const buildParentPatch = (
    parent: CustomTagParent,
    instance: PokemonInstance,
  ): Partial<PokemonInstance> => {
    const patch: Partial<PokemonInstance> = {};
    if (parent === 'caught') {
      if (builtInChanges.favorite !== undefined) patch.favorite = builtInChanges.favorite;
      const changes = customChangesForParent('caught');
      if (Object.keys(changes).length > 0) {
        patch.caught_tags = applyCustomTagChanges(instance.caught_tags, changes);
      }
    } else {
      if (builtInChanges.mostWanted !== undefined) patch.most_wanted = builtInChanges.mostWanted;
      const changes = customChangesForParent('wanted');
      if (Object.keys(changes).length > 0) {
        patch.wanted_tags = applyCustomTagChanges(instance.wanted_tags, changes);
      }
    }
    return patch;
  };

  const prospectivePatch = (parent: CustomTagParent): InstanceStatusResultPatch =>
    (_outcome, instance) => {
      const patch = buildParentPatch(parent, instance);
      const selectedTagIds = Object.entries(customChangesForParent(parent))
        .filter(([, selected]) => selected)
        .map(([tagId]) => tagId);
      if (parent === 'caught') {
        patch.favorite = builtInChanges.favorite ?? false;
        patch.caught_tags = selectedTagIds;
      } else {
        patch.most_wanted = builtInChanges.mostWanted ?? false;
        patch.wanted_tags = selectedTagIds;
      }
      return patch;
    };

  const finish = (message: string) => {
    feedback.success(message);
    onClearSelection();
    onClose();
  };

  const applyExistingLabels = async () => {
    let statusChanged = false;

    if (summary.caughtInstanceIds.length > 0 && builtInChanges.forTrade !== undefined) {
      const target = builtInChanges.forTrade ? 'Trade' : 'Caught';
      const outcomes = await onChangeStatus(target, {
        targets: summary.caughtInstanceIds,
        resultPatch: (_outcome, instance) => buildParentPatch('caught', instance),
      });
      if (outcomes.length === 0) return false;
      statusChanged = outcomes.some((outcome) => outcome.changed);
    }

    const patchMap: Record<string, Partial<PokemonInstance>> = {};
    if (summary.caughtInstanceIds.length > 0 && builtInChanges.forTrade === undefined) {
      for (const instanceId of summary.caughtInstanceIds) {
        const instance = instances[instanceId];
        if (!instance) continue;
        const patch = buildParentPatch('caught', instance);
        if (Object.keys(patch).length > 0) patchMap[instanceId] = patch;
      }
    }
    for (const instanceId of summary.wantedInstanceIds) {
      const instance = instances[instanceId];
      if (!instance) continue;
      const patch = buildParentPatch('wanted', instance);
      if (Object.keys(patch).length > 0) patchMap[instanceId] = patch;
    }

    if (Object.keys(patchMap).length > 0) await updateDetails(patchMap);

    if (Object.keys(patchMap).length === 0 && !statusChanged) {
      feedback.info('No changes selected.');
      return false;
    }
    return true;
  };

  const handleApply = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (summary.kind === 'catalog' && stage === 'main') {
        const parent: CustomTagParent = catalogDestination === 'Wanted' ? 'wanted' : 'caught';
        const outcomes = await onChangeStatus(catalogDestination, {
          targets: summary.catalogKeys,
          resultPatch: prospectivePatch(parent),
          ...organizationOptions(parent),
        });
        const changedCount = outcomes.filter((outcome) => outcome.changed).length;
        if (changedCount === 0) return;
        const selectedTags = selectedCustomTagsForParent(parent);
        const tagMessage = selectedTags.length === 1
          ? ` and added to ${selectedTags[0].name}`
          : selectedTags.length > 1
            ? ` and added to ${selectedTags.length} tags`
            : '';
        finish(`${changedCount} Pokémon created as ${destinationCopy[catalogDestination].title}${tagMessage}.`);
        return;
      }

      if (stage === 'wanted-copy') {
        const outcomes = await onChangeStatus('Wanted', {
          targets: summary.caughtInstanceIds,
          resultPatch: prospectivePatch('wanted'),
          ...organizationOptions('wanted'),
        });
        const cloneCount = outcomes.filter(
          (outcome) => outcome.changed && outcome.operation === 'cloned',
        ).length;
        if (cloneCount === 0) return;
        finish(`${cloneCount} Wanted ${cloneCount === 1 ? 'copy' : 'copies'} created.`);
        return;
      }

      if (stage === 'caught-conversion') {
        const outcomes = await onChangeStatus(conversionDestination, {
          targets: summary.wantedInstanceIds,
          resultPatch: prospectivePatch('caught'),
          ...organizationOptions('caught'),
        });
        const changedCount = outcomes.filter((outcome) => outcome.changed).length;
        if (changedCount === 0) return;
        finish(`${changedCount} Pokémon moved to Caught.`);
        return;
      }

      if (await applyExistingLabels()) {
        finish(`Organization updated for ${summary.caughtInstanceIds.length + summary.wantedInstanceIds.length} Pokémon.`);
      }
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Could not organize these Pokémon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (targets: string[], label: string) => {
    if (isSaving || targets.length === 0) return;
    setIsSaving(true);
    try {
      const outcomes = await onChangeStatus('Missing', { targets });
      if (outcomes.length > 0) finish(label);
    } finally {
      setIsSaving(false);
    }
  };

  const renderToggle = ({
    icon,
    keyName,
    label,
    description,
    tone,
  }: {
    icon: React.ReactNode;
    keyName: BuiltInKey;
    label: string;
    description: string;
    tone: string;
  }) => {
    const state = getBuiltInState(keyName);
    const counterpartState = keyName === 'favorite'
      ? getBuiltInState('forTrade')
      : keyName === 'forTrade'
        ? getBuiltInState('favorite')
        : 'unchecked';
    const disabled =
      (keyName === 'favorite' || keyName === 'forTrade') &&
      toggleFromState(state) &&
      counterpartState !== 'unchecked';
    const resolvedDescription = disabled
      ? keyName === 'favorite'
        ? 'Remove For Trade first.'
        : 'Remove Favorite first.'
      : description;
    return (
      <button
        aria-pressed={state === 'checked'}
        className={`pokemon-organizer__toggle ${state === 'mixed' ? 'mixed' : ''}`}
        disabled={disabled}
        onClick={() => setBuiltIn(keyName)}
        style={{ '--organizer-tag-color': tone } as React.CSSProperties}
        title={disabled ? resolvedDescription : undefined}
        type="button"
      >
        <span className="pokemon-organizer__toggle-icon" aria-hidden="true">{icon}</span>
        <span><strong>{label}</strong><small>{resolvedDescription}</small></span>
        <span className="pokemon-organizer__check" aria-hidden="true">
          {state === 'checked' ? <FaCheck /> : state === 'mixed' ? '−' : ''}
        </span>
      </button>
    );
  };

  const renderCustomTags = (parent: CustomTagParent) => {
    const definitions = Object.values(customTags[parent])
      .map((bucket) => bucket.tag)
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name));
    return (
      <div className="pokemon-organizer__custom">
        <div className="pokemon-organizer__section-heading">
          <div><strong>Your tags</strong><small>{parent === 'wanted' ? 'Wanted Pokémon only' : 'Caught Pokémon only'}</small></div>
          <button onClick={() => setCreatingParent(parent)} type="button"><FaPlus aria-hidden="true" /> New tag</button>
        </div>
        {definitions.length > 0 ? (
          <div className="pokemon-organizer__tag-grid">
            {definitions.map((tag) => {
              const state = customTagState(parent, tag.tag_id);
              return (
                <button
                  aria-pressed={state === 'checked'}
                  className={state === 'mixed' ? 'mixed' : ''}
                  key={tag.tag_id}
                  onClick={() => toggleCustomTag(parent, tag.tag_id)}
                  style={{ '--organizer-tag-color': tag.color } as React.CSSProperties}
                  type="button"
                >
                  <span className="pokemon-organizer__swatch" aria-hidden="true" />
                  <strong>{tag.name}</strong>
                  <span className="pokemon-organizer__check" aria-hidden="true">
                    {state === 'checked' ? <FaCheck /> : state === 'mixed' ? '−' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="pokemon-organizer__empty-tags">No custom tags in this section yet.</p>
        )}
      </div>
    );
  };

  const renderCaughtChoices = (includeForTrade: boolean, includeFavorite = true) => (
    <section className="pokemon-organizer__section pokemon-organizer__section--caught">
      <div className="pokemon-organizer__eyebrow">Caught Pokémon</div>
      <div className="pokemon-organizer__built-ins">
        {includeFavorite && renderToggle({ icon: <FaStar />, keyName: 'favorite', label: 'Favorite', description: 'Keep important catches easy to find.', tone: '#FACC15' })}
        {includeForTrade && renderToggle({ icon: <FaExchangeAlt />, keyName: 'forTrade', label: 'For Trade', description: 'Make these available in trade matching.', tone: '#22C55E' })}
      </div>
      {renderCustomTags('caught')}
    </section>
  );

  const renderWantedChoices = () => (
    <section className="pokemon-organizer__section pokemon-organizer__section--wanted">
      <div className="pokemon-organizer__eyebrow">Wanted Pokémon</div>
      <div className="pokemon-organizer__built-ins">
        {renderToggle({ icon: <FaHeart />, keyName: 'mostWanted', label: 'Most Wanted', description: 'Highlight your highest-priority wishlist entries.', tone: '#F05A45' })}
      </div>
      {renderCustomTags('wanted')}
    </section>
  );

  const title = summary.kind === 'catalog' && stage === 'main'
    ? 'Add Pokémon'
    : stage === 'wanted-copy'
      ? 'Create Wanted copies'
      : stage === 'caught-conversion'
        ? 'Mark as Caught'
        : 'Organize Pokémon';
  const catalogParent: CustomTagParent = catalogDestination === 'Wanted' ? 'wanted' : 'caught';
  const catalogHasLabels =
    selectedCustomTagsForParent(catalogParent).length > 0 ||
    (catalogParent === 'caught' && Boolean(builtInChanges.favorite)) ||
    (catalogParent === 'wanted' && Boolean(builtInChanges.mostWanted));
  const actionLabel = isSaving
    ? summary.kind === 'catalog'
      ? 'Creating & tagging…'
      : 'Saving changes…'
    : summary.kind === 'catalog' && stage === 'main'
      ? `${catalogHasLabels ? 'Create & tag' : 'Create'} ${summary.catalogKeys.length} Pokémon`
      : stage === 'wanted-copy'
        ? `Create ${summary.caughtInstanceIds.length} Wanted ${summary.caughtInstanceIds.length === 1 ? 'copy' : 'copies'}`
        : stage === 'caught-conversion'
          ? `Move ${summary.wantedInstanceIds.length} to ${conversionDestination === 'Trade' ? 'For Trade' : 'Caught'}`
          : `Apply to ${summary.caughtInstanceIds.length + summary.wantedInstanceIds.length}`;

  return (
    <OverlayPortal closeOnBackdrop dismissible={!isSaving} onClose={onClose}>
      <div className="pokemon-organizer-overlay">
        <section aria-busy={isSaving} aria-labelledby="pokemon-organizer-title" aria-modal="true" className="pokemon-organizer" role="dialog">
          <header className="pokemon-organizer__header">
            <div>
              <span><FaTags aria-hidden="true" /> Pokémon organizer</span>
              <h2 id="pokemon-organizer-title">{title}</h2>
              <p>{summary.selectedCount} selected{summary.unavailableKeys.length ? ` · ${summary.unavailableKeys.length} unavailable` : ''}</p>
            </div>
            <OverlayDismissButton aria-label="Close Pokémon organizer" className="pokemon-organizer__close" disabled={isSaving} onDismiss={onClose}>
              <FaTimes aria-hidden="true" />
            </OverlayDismissButton>
          </header>

          <div className="pokemon-organizer__body">
            {summary.unavailableKeys.length > 0 ? (
              <p className="pokemon-organizer__notice">Disabled fusion components will not be changed.</p>
            ) : null}

            {summary.kind === 'catalog' && stage === 'main' ? (
              <section className="pokemon-organizer__destination">
                <div className="pokemon-organizer__eyebrow">Create as</div>
                <div className="pokemon-organizer__destination-grid">
                  {(Object.keys(destinationCopy) as Array<Exclude<InstanceStatus, 'Missing'>>).map((destination) => (
                    <button
                      aria-pressed={catalogDestination === destination}
                      key={destination}
                      onClick={() => { setCatalogDestination(destination); resetChoices(); }}
                      type="button"
                    >
                      <strong>{destinationCopy[destination].title}</strong>
                      <small>{destinationCopy[destination].detail}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {stage === 'caught-conversion' ? (
              <section className="pokemon-organizer__destination">
                <div className="pokemon-organizer__eyebrow">Caught status</div>
                <div className="pokemon-organizer__destination-grid pokemon-organizer__destination-grid--two">
                  {(['Caught', 'Trade'] as const).map((destination) => (
                    <button aria-pressed={conversionDestination === destination} key={destination} onClick={() => { setConversionDestination(destination); resetChoices(); }} type="button">
                      <strong>{destination === 'Trade' ? 'Caught and For Trade' : 'Caught'}</strong>
                      <small>{destination === 'Trade' ? 'Add to your collection and trade listings.' : 'Add to your collection.'}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {(stage === 'wanted-copy' ||
              (summary.kind === 'catalog' && catalogDestination === 'Wanted') ||
              (stage === 'main' && summary.wantedInstanceIds.length > 0))
              ? renderWantedChoices()
              : null}
            {(stage === 'caught-conversion' ||
              (summary.kind === 'catalog' && catalogDestination !== 'Wanted') ||
              (stage === 'main' && summary.caughtInstanceIds.length > 0))
              ? renderCaughtChoices(
                  summary.kind !== 'catalog' && stage === 'main',
                  !(
                    (summary.kind === 'catalog' && catalogDestination === 'Trade') ||
                    (stage === 'caught-conversion' && conversionDestination === 'Trade')
                  ),
                )
              : null}

            {stage === 'main' && summary.kind !== 'catalog' ? (
              <section className="pokemon-organizer__lifecycle">
                <div className="pokemon-organizer__section-heading">
                  <div><strong>Other actions</strong><small>These create, convert, or remove instances.</small></div>
                </div>
                {summary.caughtInstanceIds.length > 0 ? (
                  <button className="pokemon-organizer__lifecycle-action" onClick={() => openStage('wanted-copy')} type="button">
                    <span><strong>Create Wanted {summary.caughtInstanceIds.length === 1 ? 'copy' : 'copies'}</strong><small>Your caught Pokémon remain unchanged.</small></span><FaArrowRight aria-hidden="true" />
                  </button>
                ) : null}
                {summary.wantedInstanceIds.length > 0 ? (
                  <button className="pokemon-organizer__lifecycle-action" onClick={() => openStage('caught-conversion')} type="button">
                    <span><strong>Mark as Caught</strong><small>Convert the existing Wanted {summary.wantedInstanceIds.length === 1 ? 'entry' : 'entries'}.</small></span><FaArrowRight aria-hidden="true" />
                  </button>
                ) : null}
                {summary.kind !== 'mixed' && summary.caughtInstanceIds.length > 0 ? (
                  <button className="pokemon-organizer__lifecycle-action pokemon-organizer__lifecycle-action--danger" onClick={() => void handleRemove(summary.caughtInstanceIds, `${summary.caughtInstanceIds.length} Pokémon transferred.`)} type="button">
                    <span><strong>Transfer selected</strong><small>Remove these caught instances from your collection.</small></span><FaTrashAlt aria-hidden="true" />
                  </button>
                ) : null}
                {summary.kind !== 'mixed' && summary.wantedInstanceIds.length > 0 ? (
                  <button className="pokemon-organizer__lifecycle-action pokemon-organizer__lifecycle-action--danger" onClick={() => void handleRemove(summary.wantedInstanceIds, `${summary.wantedInstanceIds.length} Pokémon removed from Wanted.`)} type="button">
                    <span><strong>Remove from Wanted</strong><small>Delete these wishlist entries.</small></span><FaTrashAlt aria-hidden="true" />
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>

          {isSaving ? (
            <div aria-live="assertive" className="pokemon-organizer__saving" role="status">
              <span aria-hidden="true" className="pokemon-organizer__spinner" />
              <strong>{summary.kind === 'catalog' ? 'Creating your Pokémon…' : 'Saving your changes…'}</strong>
              <small>Keep this window open. Your collection will update automatically.</small>
            </div>
          ) : null}

          <footer className="pokemon-organizer__footer">
            {stage !== 'main' ? (
              <button className="pokemon-organizer__back" disabled={isSaving} onClick={() => openStage('main')} type="button">Back</button>
            ) : (
              <OverlayDismissButton className="pokemon-organizer__back" disabled={isSaving} onDismiss={onClose}>Cancel</OverlayDismissButton>
            )}
            <button className="pokemon-organizer__apply" disabled={isSaving} onClick={() => void handleApply()} type="button">{actionLabel}</button>
          </footer>
        </section>
      </div>

      {creatingParent ? (
        <CustomTagEditorSheet
          parent={creatingParent}
          onClose={() => setCreatingParent(null)}
          onCreate={async (input) => {
            const created = await createCustomTag(input);
            setCustomChanges((current) => ({ ...current, [created.tag_id]: true }));
          }}
          onDelete={deleteCustomTag}
          onUpdate={async (tagId, input) => { await updateCustomTag(tagId, input); }}
        />
      ) : null}
    </OverlayPortal>
  );
};

export default PokemonOrganizerSheet;
