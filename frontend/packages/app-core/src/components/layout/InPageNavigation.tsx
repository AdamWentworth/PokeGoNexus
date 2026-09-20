import type { CSSProperties } from 'react';

import './InPageNavigation.css';

export type InPageNavigationItem = {
  href: string;
  label: string;
};

type InPageNavigationProps = {
  ariaLabel: string;
  className?: string;
  items: readonly InPageNavigationItem[];
  style?: CSSProperties;
};

const InPageNavigation = ({
  ariaLabel,
  className = '',
  items,
  style,
}: InPageNavigationProps) => (
  <nav
    aria-label={ariaLabel}
    className={`in-page-navigation ${className}`.trim()}
    style={style}
  >
    {items.map((item) => (
      <a href={item.href} key={item.href}>
        {item.label}
      </a>
    ))}
  </nav>
);

export default InPageNavigation;
