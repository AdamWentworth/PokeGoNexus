import React from 'react';
import { FaSearch, FaUserFriends } from 'react-icons/fa';
import SegmentedControl from '@/components/layout/SegmentedControl';
import './SearchModeToggle.css';

export type SearchMode = 'pokemon' | 'trainer';

type SearchModeToggleProps = {
  searchMode: SearchMode;
  setSearchMode: React.Dispatch<React.SetStateAction<SearchMode>>;
};

const SearchModeToggle: React.FC<SearchModeToggleProps> = ({
  searchMode,
  setSearchMode,
}) => {
  const items = [
    {
      ariaControls: 'search-panel-pokemon',
      icon: <FaSearch />,
      id: 'search-tab-pokemon',
      label: 'Pokémon',
      value: 'pokemon',
    },
    {
      ariaControls: 'search-panel-trainer',
      icon: <FaUserFriends />,
      id: 'search-tab-trainer',
      label: 'Trainers',
      value: 'trainer',
    },
  ] as const;

  return (
    <SegmentedControl
      ariaLabel="Search category"
      className="search-mode-toggle"
      items={items}
      mode="tabs"
      onChange={setSearchMode}
      value={searchMode}
    />
  );
};

export default SearchModeToggle;
