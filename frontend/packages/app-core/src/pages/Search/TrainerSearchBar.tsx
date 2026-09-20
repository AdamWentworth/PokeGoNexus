import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FaArrowRight,
  FaBookOpen,
  FaSearch,
  FaTimes,
  FaUserFriends,
} from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router';

import { buildPokemonCatalogPath } from '@/pages/Pokemon/utils/pokemonCatalogNavigation';
import { fetchTrainerAutocomplete } from '@/services/userSearchService';
import { createScopedLogger } from '@/utils/logger';
import type { TrainerAutocompleteEntry } from '@shared-contracts/users';
import './TrainerSearchBar.css';

const log = createScopedLogger('TrainerSearchBar');

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 300;

const getInitialQuery = (search: string): string => {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'trainer' ? params.get('q')?.trim() ?? '' : '';
};

const getTeamClass = (team?: string | null): string => {
  const normalized = team?.trim().toLowerCase().replace(/^team\s+/, '');
  return normalized === 'mystic' || normalized === 'valor' || normalized === 'instinct'
    ? normalized
    : 'neutral';
};

const getTeamLabel = (team?: string | null): string | null => {
  const normalized = team?.trim().replace(/^team\s+/i, '');
  return normalized ? `Team ${normalized}` : null;
};

const TrainerSearchBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => getInitialQuery(location.search));
  const [results, setResults] = useState<TrainerAutocompleteEntry[]>([]);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);

  const runSearch = async (term: string, requestId: number) => {
    setLoading(true);
    setError('');

    try {
      const outcome = await fetchTrainerAutocomplete(term);
      if (requestId !== requestSequenceRef.current) return;

      if (outcome.type === 'error') {
        throw new Error(outcome.message);
      }

      setResults(outcome.results);
      setLastSearchTerm(term);
      setHasSearched(true);
    } catch (err) {
      if (requestId !== requestSequenceRef.current) return;
      log.error('Trainer search error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Trainer search is temporarily unavailable. Please try again.',
      );
      setResults([]);
      setLastSearchTerm(term);
      setHasSearched(true);
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestSequenceRef.current;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setError('');
    setHasSearched(false);

    if (term.length < MIN_QUERY_LEN) {
      setLoading(false);
      setResults([]);
      setLastSearchTerm('');
      return;
    }

    setResults([]);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runSearch(term, requestId);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  const searchNow = () => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LEN) {
      inputRef.current?.focus();
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const requestId = ++requestSequenceRef.current;
    void runSearch(term, requestId);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchNow();
  };

  const clearQuery = () => {
    requestSequenceRef.current += 1;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setQuery('');
    setResults([]);
    setError('');
    setLoading(false);
    setHasSearched(false);
    setLastSearchTerm('');
    inputRef.current?.focus();
  };

  const getSearchReturnPath = (): string => {
    const params = new URLSearchParams({ mode: 'trainer' });
    const term = query.trim();
    if (term) params.set('q', term);
    return `/search?${params.toString()}`;
  };

  const openProfile = (username: string) => {
    navigate(`/profile/${encodeURIComponent(username)}`, {
      state: { contextBackTo: getSearchReturnPath() },
    });
  };

  const openCatalog = (username: string) => {
    navigate(
      buildPokemonCatalogPath({
        username,
        filter: 'Caught',
      }),
      {
        state: {
          instanceData: 'Caught',
          contextBackTo: getSearchReturnPath(),
        },
      },
    );
  };

  const trimmedQuery = query.trim();
  const needsAnotherCharacter =
    trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LEN;

  return (
    <section
      className="trainer-search-container"
      aria-labelledby="trainer-search-heading"
    >
      <header className="trainer-search-header">
        <span className="trainer-search-header__icon" aria-hidden="true">
          <FaUserFriends />
        </span>
        <div>
          <span>Trainer search</span>
          <h2 id="trainer-search-heading">Find a trainer</h2>
          <p>Search by Nexus username or Pokémon GO name.</p>
        </div>
      </header>

      <form className="trainer-search-form" onSubmit={handleSubmit} role="search">
        <label className="trainer-search-label" htmlFor="trainer-search-input">
          Trainer name
        </label>
        <div className="trainer-search-form__row">
          <div className="trainer-search-input-shell">
            <FaSearch aria-hidden="true" />
            <input
              ref={inputRef}
              id="trainer-search-input"
              type="search"
              className="trainer-search-input"
              placeholder="Username or Pokémon GO name"
              value={query}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setQuery(event.target.value)
              }
            />
            {query ? (
              <button
                type="button"
                className="trainer-search-clear"
                aria-label="Clear trainer search"
                title="Clear search"
                onClick={clearQuery}
              >
                <FaTimes aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <button
            className="trainer-search-submit"
            disabled={trimmedQuery.length < MIN_QUERY_LEN}
            type="submit"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p
          className={`trainer-search-hint${needsAnotherCharacter ? ' is-warning' : ''}`}
          aria-live="polite"
        >
          {needsAnotherCharacter
            ? 'Enter one more character to search.'
            : 'Results update automatically as you type.'}
        </p>
      </form>

      <div className="trainer-search-results-stage">
        {loading ? (
          <div className="trainer-search-loading" aria-live="polite">
            <span className="trainer-search-loading__spinner" aria-hidden="true" />
            <div>
              <strong>Searching trainers</strong>
              <span>Looking for “{trimmedQuery}”…</span>
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="trainer-search-error" role="alert">
            <div>
              <strong>Trainer search couldn&apos;t be completed</strong>
              <p>{error}</p>
            </div>
            <button type="button" onClick={searchNow}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && results.length > 0 ? (
          <section
            className="trainer-results-section"
            aria-labelledby="trainer-results-heading"
          >
            <header className="trainer-results-header">
              <div>
                <span>Search results</span>
                <h3 id="trainer-results-heading">
                  Trainers matching “{lastSearchTerm}”
                </h3>
              </div>
              <span className="trainer-results-count">
                {results.length} {results.length === 1 ? 'trainer' : 'trainers'}
              </span>
            </header>

            <ul className="trainer-results">
              {results.map((trainer) => {
                const teamLabel = getTeamLabel(trainer.team);
                const pokemonGoName = trainer.pokemonGoName?.trim();

                return (
                  <li key={trainer.username}>
                    <article
                      className={`trainer-result-card trainer-result-card--${getTeamClass(
                        trainer.team,
                      )}`}
                    >
                      <div className="trainer-result-card__identity">
                        <span className="trainer-result-card__avatar" aria-hidden="true">
                          {trainer.username.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="trainer-result-card__names">
                          <h4 title={`Nexus username: ${trainer.username}`}>
                            Nexus · @{trainer.username}
                          </h4>
                          <span
                            title={
                              pokemonGoName
                                ? `Pokémon GO name: ${pokemonGoName}`
                                : undefined
                            }
                          >
                            Pokémon GO · {pokemonGoName || 'Not shared'}
                          </span>
                        </div>
                      </div>

                      {teamLabel || trainer.trainer_level ? (
                        <div className="trainer-result-card__metadata" aria-label="Trainer details">
                          {teamLabel ? <span>{teamLabel}</span> : null}
                          {trainer.trainer_level ? (
                            <span>Level {trainer.trainer_level}</span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="trainer-result-card__actions">
                        <button
                          type="button"
                          className="trainer-result-card__catalog-action"
                          onClick={() => openCatalog(trainer.username)}
                        >
                          <FaBookOpen aria-hidden="true" />
                          View Pokémon
                        </button>
                        <button
                          type="button"
                          className="trainer-result-card__profile-action"
                          onClick={() => openProfile(trainer.username)}
                        >
                          View profile
                          <FaArrowRight aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {!loading && !error && hasSearched && results.length === 0 ? (
          <div className="trainer-search-empty">
            <span aria-hidden="true"><FaSearch /></span>
            <div>
              <strong>No trainers found</strong>
              <p>Try a different Nexus username or Pokémon GO name.</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && !hasSearched && trimmedQuery.length === 0 ? (
          <div className="trainer-search-prompt">
            <span aria-hidden="true"><FaUserFriends /></span>
            <div>
              <strong>Find people you know</strong>
              <p>Enter at least two characters to search the trainer community.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default TrainerSearchBar;
