import React, { useEffect, useState } from 'react';

import {
  EXCLUDE_IMAGES_trade,
  EXCLUDE_IMAGES_wanted,
  FILTER_NAMES,
  FILTER_NAMES_TRADE,
  INCLUDE_IMAGES_trade,
  INCLUDE_IMAGES_wanted,
} from '../../utils/constants';
import { TOOLTIP_TEXTS } from '../../utils/tooltipTexts';

import './TradePreferenceFilters.css';

type FilterContext = 'wanted' | 'trade';

interface TradePreferenceFiltersProps {
  context: FilterContext;
  editMode: boolean;
  isMirror?: boolean;
  mirrorControl?: React.ReactNode;
  selectedExcludeImages: boolean[];
  selectedIncludeOnlyImages: boolean[];
  toggleExcludeImageSelection: (index: number, editMode: boolean) => void;
  toggleIncludeOnlyImageSelection: (index: number, editMode: boolean) => void;
}

const SHORT_LABELS: Record<string, string> = {
  communityDayFilter: 'Community Day',
  researchDayFilter: 'Research Day',
  raidDayFilter: 'Raid Day',
  legendaryMythicalUltraBeastRaidFilter: 'Legendary raid',
  megaRaidFilter: 'Mega raid',
  permaboostedFilter: 'Permaboosted',
  shinyIconFilter: 'Shiny',
  costumeIconFilter: 'Costume',
  legendaryIconFilter: 'Legendary',
  regionalIconFilter: 'Regional',
  locationIconFilter: 'Location card',
};

type RuleGroupProps = {
  title: string;
  description: string;
  tone: 'require' | 'exclude';
  images: readonly string[];
  names: readonly string[];
  selected: boolean[];
  editMode: boolean;
  onToggle: (index: number, editMode: boolean) => void;
};

const RuleGroup: React.FC<RuleGroupProps> = ({
  title,
  description,
  tone,
  images,
  names,
  selected,
  editMode,
  onToggle,
}) => (
  <section className={`preference-rule-group preference-rule-group--${tone}`}>
    <header>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <span>{selected.filter(Boolean).length} selected</span>
    </header>
    <div className="preference-rule-options">
      {images.map((image, index) => {
        const name = names[index] ?? '';
        const isSelected = Boolean(selected[index]);
        const label = SHORT_LABELS[name] ?? TOOLTIP_TEXTS[name] ?? name;
        return (
          <button
            type="button"
            key={`${tone}:${name}`}
            className={isSelected ? 'is-selected' : ''}
            disabled={!editMode}
            aria-pressed={isSelected}
            title={TOOLTIP_TEXTS[name]}
            onClick={() => onToggle(index, editMode)}
          >
            <img src={image} alt="" />
            <span>{label}</span>
            <span className="preference-rule-check" aria-hidden="true">
              {isSelected ? '✓' : '+'}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

const TradePreferenceFilters: React.FC<TradePreferenceFiltersProps> = ({
  context,
  editMode,
  isMirror = false,
  mirrorControl,
  selectedExcludeImages,
  selectedIncludeOnlyImages,
  toggleExcludeImageSelection,
  toggleIncludeOnlyImageSelection,
}) => {
  const excludeImages =
    context === 'trade' ? EXCLUDE_IMAGES_trade : EXCLUDE_IMAGES_wanted;
  const includeImages =
    context === 'trade' ? INCLUDE_IMAGES_trade : INCLUDE_IMAGES_wanted;
  const names = context === 'trade' ? FILTER_NAMES_TRADE : FILTER_NAMES;
  const excludeNames = names.slice(0, excludeImages.length);
  const includeNames = names.slice(excludeImages.length);
  const activeRuleCount =
    selectedExcludeImages.filter(Boolean).length +
    selectedIncludeOnlyImages.filter(Boolean).length;
  const [isOpen, setIsOpen] = useState(isMirror || activeRuleCount > 0);

  useEffect(() => {
    if (isMirror || (editMode && activeRuleCount > 0)) setIsOpen(true);
  }, [activeRuleCount, editMode, isMirror]);

  return (
    <div className={`trade-preference-rules ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="trade-preference-rules__toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <div>
          <span>Advanced matching rules</span>
          <strong>
            {isMirror
              ? 'Mirror trade enabled'
              : activeRuleCount === 0
              ? 'No additional rules'
              : `${activeRuleCount} active ${activeRuleCount === 1 ? 'rule' : 'rules'}`}
          </strong>
        </div>
        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen ? <div className="trade-preference-rules__groups">
        {mirrorControl ? (
          <section className={`preference-mirror-rule ${isMirror ? 'is-selected' : ''}`}>
            <div>
              <h4>Mirror trade</h4>
              <p>
                Only match this Pokémon with another copy of the same Pokémon.
              </p>
              {isMirror ? <small>Standard matching rules are paused.</small> : null}
            </div>
            {mirrorControl}
          </section>
        ) : null}
        {!isMirror ? (
          <>
        <RuleGroup
          title="Must match"
          description={
            context === 'trade'
              ? 'Only consider wanted Pokémon with these qualities.'
              : 'Only consider your offers from these encounter groups.'
          }
          tone="require"
          images={includeImages}
          names={includeNames}
          selected={selectedIncludeOnlyImages}
          editMode={editMode}
          onToggle={toggleIncludeOnlyImageSelection}
        />
        <RuleGroup
          title="Leave out"
          description={
            context === 'trade'
              ? 'Remove Pokémon from these common shiny sources.'
              : 'Remove offers with these qualities.'
          }
          tone="exclude"
          images={excludeImages}
          names={excludeNames}
          selected={selectedExcludeImages}
          editMode={editMode}
          onToggle={toggleExcludeImageSelection}
        />
          </>
        ) : null}
      </div> : null}
    </div>
  );
};

export default TradePreferenceFilters;
