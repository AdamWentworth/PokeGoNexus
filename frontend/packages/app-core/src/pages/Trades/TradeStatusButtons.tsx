import type { TradeStatusFilter } from './types';

import './TradeStatusButtons.css';

interface TradeStatusButtonsProps {
  selectedStatus: TradeStatusFilter;
  setSelectedStatus: (status: TradeStatusFilter) => void;
  counts?: Partial<Record<TradeStatusFilter, number>>;
}

const statuses: ReadonlyArray<{
  value: TradeStatusFilter;
  label: string;
  mobileLabel: string;
  description: string;
}> = [
  {
    value: 'Accepting',
    label: 'Needs response',
    mobileLabel: 'Offers',
    description: 'Received offers',
  },
  {
    value: 'Proposed',
    label: 'Sent',
    mobileLabel: 'Sent',
    description: 'Awaiting a reply',
  },
  {
    value: 'Pending',
    label: 'Active',
    mobileLabel: 'Active',
    description: 'In progress',
  },
  {
    value: 'Completed',
    label: 'Completed',
    mobileLabel: 'Done',
    description: 'Successful',
  },
  {
    value: 'Cancelled',
    label: 'Closed',
    mobileLabel: 'Closed',
    description: 'Cancelled or denied',
  },
];

function TradeStatusButtons({
  selectedStatus,
  setSelectedStatus,
  counts = {},
}: TradeStatusButtonsProps) {
  return (
    <nav className="status-buttons" aria-label="Trade activity stage">
      {statuses.map(({ value, label, mobileLabel, description }) => (
        <button
          type="button"
          key={value}
          onClick={() => setSelectedStatus(value)}
          className={`status-button ${selectedStatus === value ? 'active' : ''} ${value.toLowerCase()}`}
          aria-current={selectedStatus === value ? 'page' : undefined}
          aria-label={`${label}, ${counts[value] ?? 0}`}
        >
          <span>
            <strong className="status-label-desktop">{label}</strong>
            <strong className="status-label-mobile" aria-hidden="true">
              {mobileLabel}
            </strong>
            <small>{description}</small>
          </span>
          <b>{counts[value] ?? 0}</b>
        </button>
      ))}
    </nav>
  );
}

export default TradeStatusButtons;
