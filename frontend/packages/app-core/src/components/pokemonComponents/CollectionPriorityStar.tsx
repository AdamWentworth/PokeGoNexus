import './CollectionPriorityStar.css';

type CollectionPriorityStarProps = {
  className?: string;
  filled: boolean;
  label?: string;
  tone?: 'favorite' | 'most-wanted' | 'inherit';
};

const CollectionPriorityStar = ({
  className = '',
  filled,
  label,
  tone = 'inherit',
}: CollectionPriorityStarProps) => {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={[
        'collection-priority-star',
        `collection-priority-star--${tone}`,
        className,
      ].filter(Boolean).join(' ')}
      focusable="false"
      role={label ? 'img' : undefined}
      viewBox="0 0 24 24"
    >
      <path
        d="m12 2.75 2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.35l-5.72 3.01 1.09-6.37-4.63-4.51 6.4-.93L12 2.75Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
};

export default CollectionPriorityStar;
