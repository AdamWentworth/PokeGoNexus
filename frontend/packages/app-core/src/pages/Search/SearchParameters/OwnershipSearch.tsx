import React, { useEffect } from 'react';
import { FaBoxOpen, FaExchangeAlt, FaHeart } from 'react-icons/fa';

import {
  normalizeOwnershipMode,
  type SearchOwnershipMode,
  type SearchOwnershipModeInput,
} from '../utils/ownershipMode';

import './OwnershipSearch.css';

type IvKey = 'Attack' | 'Defense' | 'Stamina';
type IvValues = Record<IvKey, number | '' | null>;

type OwnershipSearchProps = {
  ownershipMode: SearchOwnershipModeInput;
  setOwnershipMode: React.Dispatch<React.SetStateAction<SearchOwnershipMode>>;
  ivs: IvValues;
  setIvs: React.Dispatch<React.SetStateAction<IvValues>>;
  isHundo: boolean;
  setIsHundo: React.Dispatch<React.SetStateAction<boolean>>;
  onlyMatchingTrades: boolean;
  setOnlyMatchingTrades: React.Dispatch<React.SetStateAction<boolean>>;
  prefLucky: boolean;
  setPrefLucky: React.Dispatch<React.SetStateAction<boolean>>;
  alreadyRegistered: boolean;
  setAlreadyRegistered: React.Dispatch<React.SetStateAction<boolean>>;
  trade_in_wanted_list?: boolean;
  tradeInWantedList?: boolean;
  setTradeInWantedList: React.Dispatch<React.SetStateAction<boolean>>;
  friendshipLevel: number;
  setFriendshipLevel: React.Dispatch<React.SetStateAction<number>>;
};

type SearchSwitchProps = {
  checked: boolean;
  description: string;
  icon?: string;
  label: string;
  onChange: (checked: boolean) => void;
};

const SearchSwitch: React.FC<SearchSwitchProps> = ({
  checked,
  description,
  icon,
  label,
  onChange,
}) => (
  <button
    aria-checked={checked}
    className="search-option-switch"
    onClick={() => onChange(!checked)}
    role="switch"
    type="button"
  >
    {icon ? <img alt="" className="search-option-switch__icon" src={icon} /> : null}
    <span className="search-option-switch__copy">
      <strong>{label}</strong>
      <small>{description}</small>
    </span>
    <span aria-hidden="true" className="search-option-switch__track">
      <span />
    </span>
  </button>
);

const ownershipOptions: Array<{
  description: string;
  icon: React.ReactNode;
  label: string;
  value: SearchOwnershipMode;
}> = [
  {
    value: 'caught',
    label: 'Caught',
    description: 'Pokémon in trainer collections',
    icon: <FaBoxOpen aria-hidden="true" />,
  },
  {
    value: 'trade',
    label: 'For Trade',
    description: 'Pokémon trainers are offering',
    icon: <FaExchangeAlt aria-hidden="true" />,
  },
  {
    value: 'wanted',
    label: 'Wanted',
    description: 'Pokémon trainers are seeking',
    icon: <FaHeart aria-hidden="true" />,
  },
];

const OwnershipSearch: React.FC<OwnershipSearchProps> = ({
  ownershipMode,
  setOwnershipMode,
  ivs,
  setIvs,
  isHundo,
  setIsHundo,
  onlyMatchingTrades,
  setOnlyMatchingTrades,
  prefLucky,
  setPrefLucky,
  alreadyRegistered,
  setAlreadyRegistered,
  trade_in_wanted_list,
  tradeInWantedList,
  setTradeInWantedList,
  friendshipLevel,
  setFriendshipLevel,
}) => {
  const activeMode = normalizeOwnershipMode(ownershipMode);
  const activeTradeInWantedList =
    tradeInWantedList ?? trade_in_wanted_list ?? false;

  useEffect(() => {
    if (activeMode !== 'caught') {
      setIvs({ Attack: null, Defense: null, Stamina: null });
      setIsHundo(false);
    }
  }, [activeMode, setIvs, setIsHundo]);

  useEffect(() => {
    if (activeMode !== 'trade') setOnlyMatchingTrades(false);
  }, [activeMode, setOnlyMatchingTrades]);

  useEffect(() => {
    if (activeMode === 'wanted') return;
    setPrefLucky(false);
    setAlreadyRegistered(false);
    setTradeInWantedList(false);
    setFriendshipLevel(0);
  }, [
    activeMode,
    setAlreadyRegistered,
    setFriendshipLevel,
    setPrefLucky,
    setTradeInWantedList,
  ]);

  const setIv = (stat: IvKey, rawValue: string) => {
    const nextValue =
      rawValue === ''
        ? null
        : Math.max(0, Math.min(15, Number.parseInt(rawValue, 10)));
    setIsHundo(false);
    setIvs({ ...ivs, [stat]: nextValue });
  };

  const togglePerfectIvs = () => {
    const nextHundo = !isHundo;
    setIsHundo(nextHundo);
    setIvs(
      nextHundo
        ? { Attack: 15, Defense: 15, Stamina: 15 }
        : { Attack: null, Defense: null, Stamina: null },
    );
  };

  const selectFriendshipLevel = (level: number) => {
    setFriendshipLevel(level);
    if (level < 4) setPrefLucky(false);
  };

  const toggleLucky = (nextValue: boolean) => {
    setPrefLucky(nextValue);
    if (nextValue) setFriendshipLevel(Math.max(friendshipLevel, 4));
  };

  return (
    <div className="search-filter-panel ownership-search">
      <header className="search-filter-panel__intro">
        <div>
          <span>Listing type</span>
          <h3>What kind of match?</h3>
          <p>Choose a listing type, then add only the filters relevant to it.</p>
        </div>
      </header>

      <div className="ownership-mode-grid" role="radiogroup" aria-label="Listing type">
        {ownershipOptions.map((option) => (
          <button
            aria-checked={activeMode === option.value}
            className={`ownership-mode-card ownership-mode-card--${option.value}`}
            key={option.value}
            onClick={() => setOwnershipMode(option.value)}
            role="radio"
            type="button"
          >
            {option.icon}
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </div>

      {activeMode === 'caught' ? (
        <section className="search-filter-card ownership-detail-card">
          <div className="search-filter-card__heading">
            <div>
              <h4>Individual values</h4>
              <p>Leave a stat blank to accept any value from 0–15.</p>
            </div>
            <button
              aria-pressed={isHundo}
              className="ownership-perfect-button"
              onClick={togglePerfectIvs}
              type="button"
            >
              <img alt="" src="/images/hundo.png" /> Perfect IVs
            </button>
          </div>
          <div className="ownership-iv-grid">
            {(['Attack', 'Defense', 'Stamina'] as IvKey[]).map((stat) => (
              <label key={stat}>
                <span>{stat === 'Stamina' ? 'HP' : stat}</span>
                <input
                  aria-label={`${stat === 'Stamina' ? 'HP' : stat} IV`}
                  disabled={isHundo}
                  max="15"
                  min="0"
                  onChange={(event) => setIv(stat, event.target.value)}
                  placeholder="Any"
                  type="number"
                  value={ivs[stat] ?? ''}
                />
                <small>{ivs[stat] == null || ivs[stat] === '' ? 'Any' : `${ivs[stat]} / 15`}</small>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {activeMode === 'trade' ? (
        <section className="search-filter-card ownership-detail-card">
          <div className="search-filter-card__heading">
            <div>
              <h4>Trade compatibility</h4>
              <p>Narrow offers to trainers with an immediate reciprocal match.</p>
            </div>
          </div>
          <SearchSwitch
            checked={onlyMatchingTrades}
            description="They want at least one Pokémon from your For Trade list."
            label="Mutual matches only"
            onChange={setOnlyMatchingTrades}
          />
        </section>
      ) : null}

      {activeMode === 'wanted' ? (
        <>
          <section className="search-filter-card ownership-detail-card">
            <div className="search-filter-card__heading">
              <div>
                <h4>Friendship and trade type</h4>
                <p>Choose the minimum friendship level for the wanted listing.</p>
              </div>
            </div>
            <fieldset className="friendship-level-picker">
              <legend>Minimum friendship</legend>
              {Array.from({ length: 6 }, (_, level) => (
                <button
                  aria-pressed={friendshipLevel === level}
                  key={level}
                  onClick={() => selectFriendshipLevel(level)}
                  type="button"
                >
                  {level === 0 ? (
                    <strong>Any</strong>
                  ) : (
                    <>
                      <img alt="" src="/images/heart-filled.png" />
                      <strong>{level}</strong>
                    </>
                  )}
                </button>
              ))}
            </fieldset>
            <div className="friendship-selection-note">
              <span>{friendshipLevel === 0 ? 'Any friendship level' : `${friendshipLevel} of 5 hearts`}</span>
              {friendshipLevel === 5 ? (
                <strong>
                  <img alt="" src="/images/remote_trade_icon.png" />
                  Remote trade eligible
                </strong>
              ) : null}
            </div>
            <SearchSwitch
              checked={prefLucky}
              description="Requires at least four hearts; five hearts may also trade remotely."
              icon="/images/lucky_friend_icon.png"
              label="Lucky trade preferred"
              onChange={toggleLucky}
            />
          </section>

          <section className="search-filter-card ownership-detail-card">
            <div className="search-filter-card__heading">
              <div>
                <h4>Collection compatibility</h4>
                <p>Use your catalog to focus the results.</p>
              </div>
            </div>
            <div className="ownership-switch-stack">
              <SearchSwitch
                checked={alreadyRegistered}
                description="Only show Pokémon already registered in your Pokédex."
                label="Already registered"
                onChange={setAlreadyRegistered}
              />
              <SearchSwitch
                checked={activeTradeInWantedList}
                description="They offer at least one Pokémon from your Wanted list."
                label="Wishlist matches only"
                onChange={setTradeInWantedList}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default OwnershipSearch;
