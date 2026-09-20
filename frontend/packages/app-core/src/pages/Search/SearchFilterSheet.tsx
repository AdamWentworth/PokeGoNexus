import React, { ReactNode, useEffect, useState } from 'react';
import {
  FaExclamationCircle,
  FaExchangeAlt,
  FaMapMarkerAlt,
  FaSlidersH,
  FaTimes,
} from 'react-icons/fa';
import { TbPokeball } from 'react-icons/tb';

import OverlayDismissButton from '@/components/OverlayDismissButton';
import OverlayPortal, { useOverlayMotion } from '@/components/OverlayPortal';

import './SearchFilterSheet.css';

export type FilterSection = 'appearance' | 'location' | 'matching';

type SearchFilterSheetProps = {
  appearance: ReactNode;
  canReset: boolean;
  location: ReactNode;
  matching: ReactNode;
  initialSection?: FilterSection;
  errorMessage?: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  onSearch: () => boolean | Promise<boolean>;
};

type SearchFilterApplyButtonProps = Pick<
  SearchFilterSheetProps,
  'isLoading' | 'onClose' | 'onSearch'
>;

const SearchFilterApplyButton: React.FC<SearchFilterApplyButtonProps> = ({
  isLoading,
  onClose,
  onSearch,
}) => {
  const overlayMotion = useOverlayMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isLoading || isSubmitting;

  const handleApply = async () => {
    if (isBusy) return;
    setIsSubmitting(true);
    try {
      const shouldClose = await onSearch();
      if (!shouldClose) return;

      if (overlayMotion) overlayMotion.requestClose(onClose);
      else onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      className="search-filter-sheet__apply"
      disabled={isBusy}
      onClick={() => void handleApply()}
      type="button"
    >
      {isBusy ? 'Searching…' : 'Apply and search'}
    </button>
  );
};

const sections: Array<{
  id: FilterSection;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: 'appearance',
    label: 'Pokémon',
    icon: <TbPokeball aria-hidden="true" data-testid="pokemon-filter-icon" />,
  },
  {
    id: 'location',
    label: 'Location',
    icon: <FaMapMarkerAlt aria-hidden="true" />,
  },
  {
    id: 'matching',
    label: 'Matching',
    icon: <FaExchangeAlt aria-hidden="true" />,
  },
];

const SearchFilterSheet: React.FC<SearchFilterSheetProps> = ({
  appearance,
  canReset,
  location,
  matching,
  errorMessage,
  isLoading,
  isOpen,
  initialSection = 'appearance',
  onClose,
  onReset,
  onSearch,
}) => {
  const [activeSection, setActiveSection] = useState<FilterSection>('appearance');

  useEffect(() => {
    if (isOpen) setActiveSection(initialSection);
  }, [initialSection, isOpen]);

  if (!isOpen) return null;

  const activeContent =
    activeSection === 'appearance'
      ? appearance
      : activeSection === 'location'
        ? location
        : matching;

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div className="search-filter-overlay">
        <section
          aria-labelledby="search-filter-title"
          aria-modal="true"
          className="search-filter-sheet"
          role="dialog"
        >
          <header className="search-filter-sheet__header">
            <div>
              <span>
                <FaSlidersH aria-hidden="true" /> Search filters
              </span>
              <h2 id="search-filter-title">Refine your search</h2>
            </div>
            <OverlayDismissButton
              aria-label="Close search filters"
              className="search-filter-sheet__close"
              onDismiss={onClose}
            >
              <FaTimes aria-hidden="true" />
            </OverlayDismissButton>
          </header>

          <div
            aria-label="Filter sections"
            className="search-filter-sheet__tabs"
            role="tablist"
          >
            {sections.map((section) => (
              <button
                aria-controls={`search-filter-panel-${section.id}`}
                aria-selected={activeSection === section.id}
                className={activeSection === section.id ? 'active' : ''}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                role="tab"
                type="button"
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          <div
            aria-label={`${sections.find((section) => section.id === activeSection)?.label} filters`}
            className="search-filter-sheet__body"
            id={`search-filter-panel-${activeSection}`}
            role="tabpanel"
          >
            {activeContent}
          </div>

          <footer className="search-filter-sheet__footer">
            {errorMessage ? (
              <div className="search-filter-sheet__error" role="alert">
                <FaExclamationCircle aria-hidden="true" />
                <div>
                  <strong>Check these filters</strong>
                  <p>{errorMessage}</p>
                </div>
              </div>
            ) : null}
            {canReset ? (
              <button
                className="search-filter-sheet__reset"
                onClick={onReset}
                type="button"
              >
                Reset filters
              </button>
            ) : null}
            <SearchFilterApplyButton
              isLoading={isLoading}
              onClose={onClose}
              onSearch={onSearch}
            />
          </footer>
        </section>
      </div>
    </OverlayPortal>
  );
};

export default SearchFilterSheet;
