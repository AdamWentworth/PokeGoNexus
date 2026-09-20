import React, { useEffect, useId, useRef, useState } from 'react';
import { FaCheck, FaChevronDown } from 'react-icons/fa';

export type InFrameSelectOption = {
  label: string;
  value: string;
};

type InFrameSelectProps = {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: InFrameSelectOption[];
  value: string;
};

type MenuPlacement = 'above' | 'below';

const MENU_MAX_HEIGHT = 280;
const MENU_MIN_HEIGHT = 120;
const MENU_EDGE_GAP = 8;

const InFrameSelect: React.FC<InFrameSelectProps> = ({
  disabled = false,
  label,
  onChange,
  options,
  value,
}) => {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<MenuPlacement>('below');
  const [menuMaxHeight, setMenuMaxHeight] = useState(MENU_MAX_HEIGHT);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex] ?? options[0];

  const updatePlacement = () => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const scrollFrame = root.closest('.search-filter-sheet__body');
    const frameRect = scrollFrame?.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const upperBoundary = Math.max(0, frameRect?.top ?? 0);
    const lowerBoundary = Math.min(
      viewportHeight,
      frameRect?.bottom ?? viewportHeight,
    );
    const availableBelow = Math.max(
      0,
      lowerBoundary - rootRect.bottom - MENU_EDGE_GAP,
    );
    const availableAbove = Math.max(
      0,
      rootRect.top - upperBoundary - MENU_EDGE_GAP,
    );
    const nextPlacement =
      availableBelow < MENU_MIN_HEIGHT && availableAbove > availableBelow
        ? 'above'
        : 'below';
    const availableHeight =
      nextPlacement === 'above' ? availableAbove : availableBelow;

    setPlacement(nextPlacement);
    setMenuMaxHeight(
      Math.max(
        MENU_MIN_HEIGHT,
        Math.min(MENU_MAX_HEIGHT, availableHeight || MENU_MAX_HEIGHT),
      ),
    );
  };

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeMenu();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    updatePlacement();
    const root = rootRef.current;
    const scrollFrame = root?.closest('.search-filter-sheet__body');
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) closeMenu();
    };
    const handleViewportChange = () => updatePlacement();

    document.addEventListener('pointerdown', handleOutsidePointer);
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    scrollFrame?.addEventListener('scroll', handleViewportChange);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      scrollFrame?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled && isOpen) closeMenu();
  }, [disabled, isOpen]);

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }

      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') {
          return current >= options.length - 1 ? 0 : current + 1;
        }
        return current <= 0 ? options.length - 1 : current - 1;
      });
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      selectOption(activeIndex >= 0 ? activeIndex : 0);
    }
  };

  return (
    <div
      className={`in-frame-select${isOpen ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <span className="in-frame-select__label" id={labelId}>
        {label}
      </span>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        className="in-frame-select__trigger"
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span>{selectedOption?.label ?? 'Unavailable'}</span>
        <FaChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          aria-labelledby={labelId}
          className={`in-frame-select__menu in-frame-select__menu--${placement}`}
          id={listboxId}
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
          style={{ maxHeight: menuMaxHeight }}
          tabIndex={-1}
        >
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={activeIndex === index ? 'is-active' : ''}
              key={`${option.value}-${option.label}`}
              onClick={() => selectOption(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? <FaCheck aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default InFrameSelect;
