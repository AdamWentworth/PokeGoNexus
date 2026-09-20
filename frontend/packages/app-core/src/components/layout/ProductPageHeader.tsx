import type { ReactNode } from 'react';

import './ProductPageHeader.css';

type ProductPageHeaderProps = {
  actions?: ReactNode;
  align?: 'left' | 'center';
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
  titleId?: string;
};

const ProductPageHeader = ({
  actions,
  align = 'left',
  children,
  className = '',
  description,
  eyebrow,
  icon,
  meta,
  title,
  titleId,
}: ProductPageHeaderProps) => {
  const trailing = actions || meta;

  return (
    <header
      className={`product-page-header product-page-header--${align} ${className}`.trim()}
    >
      {icon ? <div className="product-page-header__icon">{icon}</div> : null}
      <div className="product-page-header__copy">
        {eyebrow ? (
          <span className="product-page-header__eyebrow">{eyebrow}</span>
        ) : null}
        <h1 id={titleId}>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {trailing ? (
        <div className="product-page-header__trailing">
          {actions}
          {meta}
        </div>
      ) : null}
      {children ? (
        <div className="product-page-header__navigation">{children}</div>
      ) : null}
    </header>
  );
};

export default ProductPageHeader;
