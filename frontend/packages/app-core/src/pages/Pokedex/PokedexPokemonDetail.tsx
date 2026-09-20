import React, { useEffect, useMemo, useState } from 'react';

import CloseButton from '@/components/CloseButton';
import { useModal } from '@/contexts/ModalContext';

import { PokedexDetailPokemonImage } from './PokedexDetailPokemonImage';
import { PokedexBattleTab, PokedexInfoTab } from './PokedexPokemonDetailInfo';
import {
  formatDexNumber,
  getDisplayName,
  getSpeciesName,
  getTypeChips,
  getVariantCategory,
} from './pokedexPokemonDetailModel';
import './PokedexPokemonDetail.css';

import {
  type PokedexGenderValue,
  type PokedexPokemonDetailTab,
  type PokedexComboFilterKey,
  type PokedexPokemonDetailProps,
  type PokedexRegistrationSlot,
  type PokedexComboFilter,
  type PokedexRegistrationCombo,
  type PokedexComboSection,
  EMPTY_REGISTRATION_COMBOS,
  COMBO_FILTERS,
  EXCLUSIVE_COMBO_FILTER_GROUPS,
  getSlotThemeKey,
  getIconClassName,
  getSizedImageClassName,
  createManualRegistrationForSlot,
  createManualRegistrationForCombo,
  formatReleaseDate,
  getGenderOptions,
  getRegistrationCombos,
  getComboRootSlots,
  getComboRootKeyForSlot,
  filterRegistrationCombos,
  getRegistrationSlots,
} from './pokedexRegistrationModel';

function PokedexPokemonDetailCard({
  slot,
  gender,
  selected,
  onSelect,
  onToggleRegistration,
}: {
  slot: PokedexRegistrationSlot;
  gender?: PokedexGenderValue;
  selected: boolean;
  onSelect: () => void;
  onToggleRegistration?: () => void;
}) {
  return (
    <article
      className={`pokedex-pokemon-detail-card ${selected ? 'is-selected' : ''} ${
        slot.registered ? 'is-registered' : 'is-missing'
      } ${slot.releaseDate ? 'has-release-date' : ''}`}
    >
      <button className="pokedex-pokemon-detail-card__select" type="button" onClick={onSelect}>
        {slot.icon ? (
          <img
            className={`${getIconClassName('pokedex-pokemon-detail-card__icon', slot.icon)} ${
              slot.iconPlacement === 'right' ? 'pokedex-pokemon-detail-card__icon--right' : ''
            }`}
            src={slot.icon}
            alt=""
            draggable={false}
          />
        ) : null}
        <PokedexDetailPokemonImage
          className={getSizedImageClassName('pokedex-pokemon-detail-card__image', slot.facets)}
          pokemon={slot.pokemon}
          gender={gender}
          purified={slot.purifiedImage}
        />
        <span className="pokedex-pokemon-detail-card__label">{slot.label}</span>
        {slot.releaseDate ? (
          <span className="pokedex-pokemon-detail-card__date">
            {formatReleaseDate(slot.releaseDate)}
          </span>
        ) : null}
        <span className="pokedex-pokemon-detail-card__state">
          {slot.registered ? 'Registered' : 'Missing'}
        </span>
      </button>
      {onToggleRegistration ? (
        <button
          className="pokedex-pokemon-detail-card__registration-toggle"
          type="button"
          aria-label={`${slot.registered ? 'Clear' : 'Register'} ${slot.label}`}
          aria-pressed={slot.registered}
          onClick={onToggleRegistration}
        >
          {slot.registered ? '✓' : '+'}
        </button>
      ) : null}
    </article>
  );
}

function PokedexPokemonComboCard({
  combo,
  gender,
  onToggle,
}: {
  combo: PokedexRegistrationCombo;
  gender?: PokedexGenderValue;
  onToggle: () => void;
}) {
  const leftBadges = combo.badges.filter((badge) => badge.placement === 'left');
  const rightBadges = combo.badges.filter((badge) => badge.placement === 'right');
  const comboGender =
    combo.facets.gender === 'Male' || combo.facets.gender === 'Female'
      ? combo.facets.gender
      : gender;

  return (
    <button
      className={`pokedex-pokemon-combo-card ${combo.registered ? 'is-registered' : ''}`}
      type="button"
      aria-pressed={combo.registered}
      onClick={onToggle}
    >
      <div className="pokedex-pokemon-combo-card__image-frame">
        <PokedexDetailPokemonImage
          className={getSizedImageClassName('pokedex-pokemon-combo-card__image', combo.facets)}
          pokemon={combo.pokemon}
          gender={comboGender}
          purified={combo.purifiedImage}
        />
        {leftBadges.length > 0 ? (
          <span className="pokedex-pokemon-combo-card__badges pokedex-pokemon-combo-card__badges--left">
            {leftBadges.map((badge) =>
              badge.icon ? (
                <img
                  className={getIconClassName('pokedex-pokemon-combo-card__badge-icon', badge.icon)}
                  key={badge.key}
                  src={badge.icon}
                  alt={badge.label}
                  draggable={false}
                />
              ) : null,
            )}
          </span>
        ) : null}
        {rightBadges.length > 0 ? (
          <span className="pokedex-pokemon-combo-card__badges pokedex-pokemon-combo-card__badges--right">
            {rightBadges.map((badge) =>
              badge.icon ? (
                <img
                  className={getIconClassName('pokedex-pokemon-combo-card__badge-icon', badge.icon)}
                  key={badge.key}
                  src={badge.icon}
                  alt={badge.label}
                  draggable={false}
                />
              ) : null,
            )}
          </span>
        ) : null}
      </div>
      <span className="pokedex-pokemon-combo-card__label">{combo.label}</span>
      <span className="pokedex-pokemon-combo-card__state">
        {combo.registered ? 'Registered' : 'Missing'}
      </span>
    </button>
  );
}

function PokedexPokemonDetail({
  pokemon,
  variants,
  registrations,
  gender,
  onRegister,
  onUnregister,
  onClose,
}: PokedexPokemonDetailProps) {
  const [activeTab, setActiveTab] = useState<PokedexPokemonDetailTab>('registered');
  const [comboSearch, setComboSearch] = useState('');
  const [activeComboFilterKeys, setActiveComboFilterKeys] = useState<PokedexComboFilterKey[]>([]);
  const [openComboSectionKey, setOpenComboSectionKey] = useState<string | null>(null);
  const { confirm } = useModal();
  const slots = useMemo(
    () => getRegistrationSlots(pokemon, variants, registrations),
    [pokemon, registrations, variants],
  );
  const defaultSlot =
    slots.find(
      (slot) =>
        slot.section === 'primary' &&
        !slot.facets &&
        getVariantCategory(slot.pokemon) === 'pokemon',
    ) ??
    slots.find((slot) => !slot.facets) ??
    slots[0];
  const initialSlotKey = defaultSlot?.key ?? '';
  const [selectedSlotKey, setSelectedSlotKey] = useState(initialSlotKey);
  const [selectedGender, setSelectedGender] = useState<PokedexGenderValue | undefined>(gender);

  useEffect(() => {
    setSelectedSlotKey((current) =>
      slots.some((slot) => slot.key === current) ? current : initialSlotKey,
    );
  }, [initialSlotKey, slots]);

  const selectedSlot = slots.find((slot) => slot.key === selectedSlotKey) ?? slots[0];
  const comboRootSlots = useMemo(() => getComboRootSlots(slots), [slots]);
  const comboSections = useMemo(
    () =>
      comboRootSlots.map((slot) => {
        const sectionCombos = getRegistrationCombos({ selectedSlot: slot, variants, registrations });
        return {
          slot,
          combos: sectionCombos,
          registeredCount: sectionCombos.filter((combo) => combo.registered).length,
        };
      }),
    [comboRootSlots, registrations, variants],
  );
  const activeComboSection = comboSections.find(
    (section) => section.slot.key === openComboSectionKey,
  );
  const activeCombos = activeComboSection?.combos ?? EMPTY_REGISTRATION_COMBOS;
  const filteredCombos = useMemo(
    () => filterRegistrationCombos(activeCombos, comboSearch, activeComboFilterKeys),
    [activeComboFilterKeys, activeCombos, comboSearch],
  );
  const registeredSlotCount = slots.filter((slot) => slot.registered).length;
  const primarySlots = slots.filter((slot) => slot.section === 'primary');
  const costumeSlots = slots.filter((slot) => slot.section === 'costume');
  const shadowSlots = slots.filter((slot) => slot.section === 'shadow');
  const megaSlots = slots.filter((slot) => slot.section === 'mega');
  const maxSlots = slots.filter((slot) => slot.section === 'max');
  const fusionSlots = slots.filter((slot) => slot.section === 'fusion');
  const specialSlots = slots.filter((slot) => slot.section === 'special');
  const registeredSlotSections = [
    { key: 'registered', label: 'Registered', slots: primarySlots },
    { key: 'costumes', label: 'Costumes', slots: costumeSlots },
    { key: 'shadow', label: 'Shadow', slots: shadowSlots },
    { key: 'mega', label: 'Mega forms', slots: megaSlots },
    { key: 'max', label: 'Max forms', slots: maxSlots },
    { key: 'fusion', label: 'Fusion forms', slots: fusionSlots },
    { key: 'special', label: 'Other forms', slots: specialSlots },
  ].filter((section) => section.slots.length > 0);
  const heroSlot = selectedSlot ?? defaultSlot;
  const heroPokemon = heroSlot?.pokemon ?? pokemon;
  const heroThemeKey = getSlotThemeKey(heroSlot);
  const genderOptions = getGenderOptions(heroPokemon);
  const typeChips = getTypeChips(heroPokemon);
  const selectedSlotLabel =
    activeTab === 'more'
      ? activeComboSection?.slot.label ?? 'Index'
      : selectedSlot?.label ?? getDisplayName(pokemon);
  const canUseRegistrationActions = Boolean(onRegister && onUnregister);

  const handleSlotSelect = (slot: PokedexRegistrationSlot) => {
    setSelectedSlotKey(slot.key);
    setOpenComboSectionKey(getComboRootKeyForSlot(slot, comboRootSlots));
  };

  const handleRegisterSlots = (targetSlots: PokedexRegistrationSlot[]) => {
    if (!onRegister) return;
    void onRegister(targetSlots.map(createManualRegistrationForSlot));
  };

  const handleConfirmRegisterSlots = async (
    targetSlots: PokedexRegistrationSlot[],
    scopeLabel = 'this section',
  ) => {
    if (!onRegister || targetSlots.length === 0) return;

    const confirmed = await confirm(
      `Register all ${targetSlots.length} entries in ${scopeLabel}?\nThis will mark them as registered in your Pokedex.`,
    );
    if (!confirmed) return;

    handleRegisterSlots(targetSlots);
  };

  const handleUnregisterSlots = (targetSlots: PokedexRegistrationSlot[]) => {
    if (!onUnregister) return;
    void onUnregister(
      targetSlots.map((slot) => createManualRegistrationForSlot(slot).registration_id),
    );
  };

  const handleConfirmUnregisterSlots = async (
    targetSlots: PokedexRegistrationSlot[],
    scopeLabel = 'this section',
  ) => {
    if (!onUnregister || targetSlots.length === 0) return;

    const confirmed = await confirm(
      `Unregister all ${targetSlots.length} entries in ${scopeLabel}?\nThis only removes manual Pokedex registrations. Your caught Pokemon instances stay unchanged.`,
    );
    if (!confirmed) return;

    handleUnregisterSlots(targetSlots);
  };

  const handleToggleSlotRegistration = (slot: PokedexRegistrationSlot) => {
    if (slot.registered) {
      handleUnregisterSlots([slot]);
      return;
    }

    handleRegisterSlots([slot]);
  };

  const handleRegisterCombos = (combos: PokedexRegistrationCombo[]) => {
    if (!onRegister) return;
    void onRegister(combos.map(createManualRegistrationForCombo));
  };

  const handleConfirmRegisterCombos = async (combos: PokedexRegistrationCombo[]) => {
    if (!onRegister || combos.length === 0) return;

    const confirmed = await confirm(
      `Register all ${combos.length} shown combinations?\nThis applies to the currently open variant, search, and filters.`,
    );
    if (!confirmed) return;

    handleRegisterCombos(combos);
  };

  const handleUnregisterCombos = (combos: PokedexRegistrationCombo[]) => {
    if (!onUnregister) return;
    void onUnregister(combos.map((combo) => createManualRegistrationForCombo(combo).registration_id));
  };

  const handleConfirmUnregisterCombos = async (combos: PokedexRegistrationCombo[]) => {
    if (!onUnregister || combos.length === 0) return;

    const confirmed = await confirm(
      `Unregister all ${combos.length} shown combinations?\nThis only removes manual Pokedex registrations. Your caught Pokemon instances stay unchanged.`,
    );
    if (!confirmed) return;

    handleUnregisterCombos(combos);
  };

  const handleToggleCombo = (combo: PokedexRegistrationCombo) => {
    if (combo.registered) {
      handleUnregisterCombos([combo]);
      return;
    }

    handleRegisterCombos([combo]);
  };

  const handleComboFilterToggle = (filter: PokedexComboFilter) => {
    setActiveComboFilterKeys((current) => {
      if (current.includes(filter.key)) {
        return current.filter((key) => key !== filter.key);
      }

      const next = EXCLUSIVE_COMBO_FILTER_GROUPS.has(filter.group)
        ? current.filter(
            (key) => COMBO_FILTERS.find((option) => option.key === key)?.group !== filter.group,
          )
        : current;

      return [...next, filter.key];
    });
  };

  const clearComboIndex = () => {
    setComboSearch('');
    setActiveComboFilterKeys([]);
  };

  const handleComboSectionSelect = (section: PokedexComboSection) => {
    setSelectedSlotKey(section.slot.key);
    setOpenComboSectionKey((current) => (current === section.slot.key ? null : section.slot.key));
  };

  useEffect(() => {
    if (genderOptions.length === 0) {
      setSelectedGender(undefined);
      return;
    }

    setSelectedGender((current) => {
      if (current && genderOptions.includes(current)) return current;
      if (gender && genderOptions.includes(gender)) return gender;
      return genderOptions[0];
    });
  }, [gender, genderOptions]);

  useEffect(() => {
    setComboSearch('');
    setActiveComboFilterKeys([]);
  }, [openComboSectionKey]);

  useEffect(() => {
    if (
      openComboSectionKey &&
      !comboSections.some((section) => section.slot.key === openComboSectionKey)
    ) {
      setOpenComboSectionKey(null);
    }
  }, [comboSections, openComboSectionKey]);

  return (
    <div
      className={`pokedex-pokemon-detail pokedex-pokemon-detail--${heroThemeKey}`}
    >
      <div className="pokedex-pokemon-detail__shell">
        <section className="pokedex-pokemon-detail__hero">
          {heroSlot?.icon ? (
            <span
              className={`pokedex-pokemon-detail__hero-badge ${
                heroSlot.iconPlacement === 'right' ? 'pokedex-pokemon-detail__hero-badge--right' : ''
              }`}
              title={heroSlot.label}
            >
              <img
                className={getIconClassName('pokedex-pokemon-detail__hero-badge-icon', heroSlot.icon)}
                src={heroSlot.icon}
                alt=""
                draggable={false}
              />
            </span>
          ) : null}
          <PokedexDetailPokemonImage
            className={getSizedImageClassName('pokedex-pokemon-detail__hero-image', heroSlot?.facets)}
            pokemon={heroPokemon}
            gender={selectedGender}
            purified={heroSlot?.purifiedImage}
          />
          <h2 className="pokedex-pokemon-detail__name">
            <span className="pokedex-pokemon-detail__dex-mark">#</span>
            {formatDexNumber(pokemon)} {getSpeciesName(pokemon)}
          </h2>

          <div className="pokedex-pokemon-detail__traits" aria-label="Pokemon traits">
            {genderOptions.length > 0 ? (
              genderOptions.map((option) => (
                <button
                  className={`pokedex-pokemon-detail__gender pokedex-pokemon-detail__gender--${option.toLowerCase()} ${
                    selectedGender === option ? 'is-active' : ''
                  }`}
                  key={option}
                  type="button"
                  aria-pressed={selectedGender === option}
                  title={option}
                  onClick={() => setSelectedGender(option)}
                >
                  <img src={`/images/${option.toLowerCase()}-icon.png`} alt="" draggable={false} />
                </button>
              ))
            ) : (
              <span className="pokedex-pokemon-detail__genderless">Genderless</span>
            )}

            {typeChips.length > 0 ? (
              <span className="pokedex-pokemon-detail__trait-divider" aria-hidden="true" />
            ) : null}

            {typeChips.map((type) => (
              <span className="pokedex-pokemon-detail__type" key={type.label}>
                <img src={type.icon} alt="" draggable={false} />
                <span>{type.label}</span>
              </span>
            ))}
          </div>

          <div className="pokedex-pokemon-detail__registration-pill" aria-label="Registration summary">
            <div>
              <span>Registered</span>
              <strong>{registeredSlotCount}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong>{slots.length}</strong>
            </div>
          </div>
        </section>

        <div className="pokedex-pokemon-detail__tabs" role="tablist" aria-label="Pokemon detail tabs">
          <button
            className={activeTab === 'registered' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === 'registered'}
            onClick={() => setActiveTab('registered')}
          >
            Registered
          </button>
          <button
            className={activeTab === 'info' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === 'info'}
            onClick={() => setActiveTab('info')}
          >
            Info
          </button>
          <button
            className={activeTab === 'battle' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === 'battle'}
            onClick={() => setActiveTab('battle')}
          >
            Battle
          </button>
          <button
            className={activeTab === 'more' ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={activeTab === 'more'}
            onClick={() => {
              setActiveTab('more');
              setOpenComboSectionKey(getComboRootKeyForSlot(selectedSlot, comboRootSlots));
            }}
          >
            <span className="pokedex-pokemon-detail__tab-main">More</span>
            <span className="pokedex-pokemon-detail__tab-detail">{selectedSlotLabel}</span>
          </button>
        </div>

        {activeTab === 'registered' ? (
          <div className="pokedex-pokemon-detail__registered">
            {canUseRegistrationActions ? (
              <div
                className="pokedex-pokemon-detail__registered-bulk-actions"
                aria-label="Registered tab bulk actions"
              >
                <button
                  className="pokedex-pokemon-detail__registered-bulk-action pokedex-pokemon-detail__registered-bulk-action--register"
                  type="button"
                  disabled={slots.length === 0}
                  onClick={() => void handleConfirmRegisterSlots(slots, 'the Registered tab')}
                >
                  Register all
                </button>
                <button
                  className="pokedex-pokemon-detail__registered-bulk-action pokedex-pokemon-detail__registered-bulk-action--unregister"
                  type="button"
                  disabled={slots.length === 0}
                  onClick={() => void handleConfirmUnregisterSlots(slots, 'the Registered tab')}
                >
                  Unregister all
                </button>
              </div>
            ) : null}
            {registeredSlotSections.map((section) => (
              <section className="pokedex-pokemon-detail__slot-section" key={section.key}>
                <header className="pokedex-pokemon-detail__slot-section-header">
                  <h3>{section.label}</h3>
                </header>
                <div className="pokedex-pokemon-detail__grid">
                  {section.slots.map((slot) => (
                    <PokedexPokemonDetailCard
                      key={slot.key}
                      slot={slot}
                      gender={selectedGender}
                      selected={slot.key === selectedSlot?.key}
                      onSelect={() => handleSlotSelect(slot)}
                      onToggleRegistration={
                        canUseRegistrationActions
                          ? () => handleToggleSlotRegistration(slot)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : activeTab === 'more' ? (
          <section className="pokedex-pokemon-detail__more">
            <header className="pokedex-pokemon-detail__more-header">
              <PokedexDetailPokemonImage
                className="pokedex-pokemon-detail__more-image"
                pokemon={activeComboSection?.slot.pokemon ?? selectedSlot?.pokemon ?? pokemon}
                gender={selectedGender}
                purified={activeComboSection?.slot.purifiedImage ?? selectedSlot?.purifiedImage}
              />
              <div>
                <h3>Variant combinations</h3>
                <p>
                  {activeComboSection
                    ? `${activeComboSection.registeredCount} / ${activeCombos.length}`
                    : `${comboSections.length} variants`}
                </p>
              </div>
            </header>

            <div className="pokedex-pokemon-detail__combo-sections">
              {comboSections.map((section) => {
                const isOpen = section.slot.key === openComboSectionKey;

                return (
                  <section
                    className={`pokedex-pokemon-detail__combo-section ${isOpen ? 'is-open' : ''}`}
                    key={section.slot.key}
                  >
                  <button
                    className="pokedex-pokemon-detail__combo-section-button"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => handleComboSectionSelect(section)}
                  >
                    <PokedexDetailPokemonImage
                      className="pokedex-pokemon-detail__combo-section-image"
                      pokemon={section.slot.pokemon}
                      gender={selectedGender}
                      purified={section.slot.purifiedImage}
                    />
                    <span className="pokedex-pokemon-detail__combo-section-label">
                      {section.slot.label}
                    </span>
                    <span className="pokedex-pokemon-detail__combo-section-count">
                      {section.registeredCount} / {section.combos.length}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="pokedex-pokemon-detail__combo-section-body">
                      <div className="pokedex-pokemon-detail__combo-control-panel">
                        <div className="pokedex-pokemon-detail__combo-tools">
                          <label className="pokedex-pokemon-detail__combo-search">
                            <span>Search combinations</span>
                            <input
                              type="search"
                              value={comboSearch}
                              placeholder="Search shiny, female, XXL, lucky, 100%..."
                              onChange={(event) => setComboSearch(event.target.value)}
                            />
                          </label>

                          <div className="pokedex-pokemon-detail__combo-index-status" aria-live="polite">
                            <span>
                              Showing {filteredCombos.length} of {activeCombos.length}
                            </span>
                            {comboSearch || activeComboFilterKeys.length > 0 ? (
                              <button type="button" onClick={clearComboIndex}>
                                Clear
                              </button>
                            ) : null}
                          </div>

                          <div
                            className="pokedex-pokemon-detail__combo-filter-row"
                            aria-label="Combination filters"
                          >
                            {COMBO_FILTERS.map((filter) => (
                              <button
                                className={activeComboFilterKeys.includes(filter.key) ? 'is-active' : ''}
                                key={filter.key}
                                type="button"
                                aria-pressed={activeComboFilterKeys.includes(filter.key)}
                                onClick={() => handleComboFilterToggle(filter)}
                              >
                                {filter.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {canUseRegistrationActions ? (
                          <div
                            className="pokedex-pokemon-detail__combo-bulk-actions"
                            aria-label="Shown combination actions"
                          >
                            <button
                              className="pokedex-pokemon-detail__combo-bulk-action pokedex-pokemon-detail__combo-bulk-action--register"
                              type="button"
                              disabled={filteredCombos.length === 0}
                              onClick={() => void handleConfirmRegisterCombos(filteredCombos)}
                            >
                              Register all
                            </button>
                            <button
                              className="pokedex-pokemon-detail__combo-bulk-action pokedex-pokemon-detail__combo-bulk-action--unregister"
                              type="button"
                              disabled={filteredCombos.length === 0}
                              onClick={() => void handleConfirmUnregisterCombos(filteredCombos)}
                            >
                              Unregister all
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {filteredCombos.length > 0 ? (
                        <div className="pokedex-pokemon-combo-grid">
                          {filteredCombos.map((combo) => (
                            <PokedexPokemonComboCard
                              key={combo.key}
                              combo={combo}
                              gender={selectedGender}
                              onToggle={() => handleToggleCombo(combo)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="pokedex-pokemon-detail__combo-empty">
                          No combinations match this index.
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
            </div>
          </section>
        ) : activeTab === 'info' ? (
          <PokedexInfoTab
            pokemon={heroPokemon}
            variants={variants}
            gender={selectedGender}
            onShowMore={() => {
              setActiveTab('more');
              setOpenComboSectionKey(getComboRootKeyForSlot(selectedSlot, comboRootSlots));
            }}
          />
        ) : activeTab === 'battle' ? (
          <PokedexBattleTab pokemon={heroPokemon} />
        ) : null}
      </div>

      <CloseButton
        className="pokedex-pokemon-detail__close"
        onClick={onClose}
        title="Close Pokemon detail"
      />
    </div>
  );
}

export default PokedexPokemonDetail;
