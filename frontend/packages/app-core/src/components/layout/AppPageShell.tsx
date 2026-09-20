import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import './AppPageShell.css';

type AppPageShellProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode;
  contentClassName?: string;
  inset?: 'comfortable' | 'compact' | 'none';
  maxWidth?: 'reading' | 'workspace' | 'standard' | 'wide' | 'full';
};

const AppPageShell = ({
  children,
  className = '',
  contentClassName = '',
  inset = 'comfortable',
  maxWidth = 'standard',
  ...props
}: AppPageShellProps) => (
  <div
    className={`app-page-shell app-page-shell--inset-${inset} ${className}`.trim()}
    {...props}
  >
    <div
      className={`app-page-shell__content app-page-shell__content--${maxWidth} ${contentClassName}`.trim()}
    >
      {children}
    </div>
  </div>
);

export default AppPageShell;
