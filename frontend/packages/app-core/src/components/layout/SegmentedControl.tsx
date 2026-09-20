import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import './SegmentedControl.css';

export type SegmentedControlItem<Value extends string> = {
  ariaControls?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  id?: string;
  label: ReactNode;
  value: Value;
};

type SegmentedControlProps<Value extends string> = {
  ariaLabel: string;
  className?: string;
  items: readonly SegmentedControlItem<Value>[];
  mode?: 'buttons' | 'tabs';
  onChange: (value: Value) => void;
  value: Value;
};

type SegmentedStyle = CSSProperties & {
  '--segmented-columns': number;
};

const SegmentedControl = <Value extends string>({
  ariaLabel,
  className = '',
  items,
  mode = 'buttons',
  onChange,
  value,
}: SegmentedControlProps<Value>) => {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (mode !== 'tabs') return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) %
            items.length;
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    onChange(nextItem.value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      aria-label={ariaLabel}
      className={`segmented-control ${className}`.trim()}
      role={mode === 'tabs' ? 'tablist' : 'group'}
      style={{ '--segmented-columns': items.length } as SegmentedStyle}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            aria-controls={mode === 'tabs' ? item.ariaControls : undefined}
            aria-pressed={mode === 'buttons' ? active : undefined}
            aria-selected={mode === 'tabs' ? active : undefined}
            className={active ? 'is-active' : undefined}
            id={item.id}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            role={mode === 'tabs' ? 'tab' : undefined}
            tabIndex={mode === 'tabs' ? (active ? 0 : -1) : undefined}
            type="button"
          >
            {item.icon ? (
              <span className="segmented-control__icon" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span className="segmented-control__label">{item.label}</span>
            {item.badge ? (
              <span className="segmented-control__badge">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
