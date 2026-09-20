import { FaChartBar, FaCrosshairs } from 'react-icons/fa';

import SegmentedControl from '@/components/layout/SegmentedControl';
import type { RaidViewMode } from "../utils/raidViewModel";

interface RaidModeTabsProps {
  viewMode: RaidViewMode;
  onChange: (viewMode: RaidViewMode) => void;
}

const RAID_VIEW_ITEMS = [
  { icon: <FaChartBar />, label: 'Attacker rankings', value: 'rankings' },
  { icon: <FaCrosshairs />, label: 'Boss counters', value: 'boss' },
] as const;

const RaidModeTabs = ({ viewMode, onChange }: RaidModeTabsProps) => (
  <SegmentedControl
    ariaLabel="Raid planner views"
    className="raid-view-switcher"
    items={RAID_VIEW_ITEMS}
    onChange={onChange}
    value={viewMode}
  />
);

export default RaidModeTabs;
