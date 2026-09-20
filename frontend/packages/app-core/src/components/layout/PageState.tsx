import type { ReactNode } from 'react';

import './PageState.css';

type PageStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3';
  live?: 'assertive' | 'off' | 'polite';
  title: ReactNode;
  tone?: 'danger' | 'info' | 'neutral';
};

const PageState = ({
  action,
  className = '',
  description,
  icon,
  headingLevel = 'h2',
  live = 'off',
  title,
  tone = 'neutral',
}: PageStateProps) => {
  const Heading = headingLevel;

  return (
    <section
      aria-live={live}
      className={`page-state page-state--${tone} ${className}`.trim()}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      {icon ? <div className="page-state__icon">{icon}</div> : null}
      <div className="page-state__copy">
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-state__action">{action}</div> : null}
    </section>
  );
};

export default PageState;
