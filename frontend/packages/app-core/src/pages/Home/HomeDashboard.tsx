import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FaArrowRight,
  FaCheckCircle,
  FaClock,
  FaExchangeAlt,
  FaHeart,
  FaSearch,
  FaShareAlt,
  FaStar,
  FaUserFriends,
} from 'react-icons/fa';
import { Link } from 'react-router';
import { homeExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import {
  resolvePokemonDisplayAttributes,
  resolvePokemonDisplayImageUrl,
} from '@/features/pokemonDisplay/pokemonDisplayPresentation';
import { useTradeStore } from '@/features/trades/store/useTradeStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { socialQueryKeys } from '@/services/queryClient';
import { fetchFriendsOverview } from '@/services/socialService';
import type { User } from '@/types/auth';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

import {
  buildHomeOnboardingProgress,
  getRecentHomeInstances,
  summarizeHomeCollection,
  summarizeHomeTrades,
} from './homeDashboardModel';
import HomeOnboarding from './HomeOnboarding';
import HomeActionMenuHint from './HomeActionMenuHint';

interface HomeDashboardProps {
  user: User;
}

interface RecentPokemonProps {
  instance: PokemonInstance;
  variant?: PokemonVariant;
}

const RecentPokemon = ({ instance, variant }: RecentPokemonProps) => {
  const name = instance.nickname || variant?.species_name || `Pokémon #${instance.pokemon_id}`;
  const pokemon = variant ? { ...variant, instanceData: instance } : null;
  const image = pokemon
    ? resolvePokemonDisplayImageUrl({
        pokemon,
        attributes: resolvePokemonDisplayAttributes(pokemon),
      })
    : '';

  return (
    <li>
      <Link
        to={homeExperienceParityContract.recentPokemonPath}
        aria-label={`Open ${name} in your Pokémon collection`}
      >
        <span className="home-recent-pokemon__image">
          {image ? <img src={image} alt="" /> : <span>#{instance.pokemon_id}</span>}
        </span>
        <span className="home-recent-pokemon__copy">
          <strong>{name}</strong>
          <small>
            {instance.is_for_trade
              ? 'For Trade'
              : instance.is_wanted
                ? instance.most_wanted
                  ? 'Most Wanted'
                  : 'Wanted'
                : instance.favorite
                  ? 'Favorite'
                  : 'Caught'}
          </small>
        </span>
        <FaArrowRight aria-hidden="true" />
      </Link>
    </li>
  );
};

const HomeDashboard = ({ user }: HomeDashboardProps) => {
  const instances = useInstancesStore((state) => state.instances);
  const instancesLoading = useInstancesStore((state) => state.instancesLoading);
  const trades = useTradeStore((state) => state.trades);
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);

  const friendsQuery = useQuery({
    queryKey: socialQueryKeys.friends,
    queryFn: fetchFriendsOverview,
  });

  const collection = useMemo(() => summarizeHomeCollection(instances), [instances]);
  const tradeSummary = useMemo(
    () => summarizeHomeTrades(trades, user.username),
    [trades, user.username],
  );
  const recentInstances = useMemo(() => getRecentHomeInstances(instances), [instances]);
  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_id, variant])),
    [variants],
  );
  const incomingFriends = friendsQuery.data?.incoming.length ?? 0;
  const friendConnections =
    (friendsQuery.data?.friends.length ?? 0) +
    (friendsQuery.data?.incoming.length ?? 0) +
    (friendsQuery.data?.outgoing.length ?? 0);
  const onboardingProgress = useMemo(
    () => buildHomeOnboardingProgress(collection, friendConnections + Object.keys(trades).length),
    [collection, friendConnections, trades],
  );
  const onboardingStorageKey = `pokegonexus-home-onboarding:${user.user_id || user.username}`;
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => window.localStorage.getItem(onboardingStorageKey) === 'dismissed',
  );
  const actionCount = tradeSummary.needsResponse + tradeSummary.readyToConfirm + incomingFriends;
  const firstName = user.pokemonGoName?.trim() || user.username;

  const dismissOnboarding = () => {
    window.localStorage.setItem(onboardingStorageKey, 'dismissed');
    setOnboardingDismissed(true);
  };

  const showOnboarding =
    !instancesLoading &&
    !onboardingDismissed &&
    onboardingProgress.completed < onboardingProgress.total;

  return (
    <div className="home-dashboard">
      <header className="home-dashboard__header">
        <Link className="home-brand" to="/" aria-label="Pokémon Go Nexus home">
          <img src="/images/logo/logo.png" alt="" />
          <span>Pokémon Go Nexus</span>
        </Link>
        <Link className="home-dashboard__profile-link" to="/profile">
          <span aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
          <strong>@{user.username}</strong>
        </Link>
      </header>

      <HomeActionMenuHint trainerKey={user.user_id || user.username} />

      {showOnboarding ? (
        <HomeOnboarding
          user={user}
          progress={onboardingProgress}
          onDismiss={dismissOnboarding}
        />
      ) : (
        <>

      <section className="home-dashboard__welcome" aria-labelledby="home-dashboard-title">
        <div>
          <span className="home-eyebrow">Trainer dashboard</span>
          <h1 id="home-dashboard-title">Welcome back, {firstName}</h1>
          <p>Your collection, trades, and trainer network—together in one place.</p>
        </div>
        <Link className="home-primary-action" to="/search">
          <FaSearch aria-hidden="true" /> Find Pokémon
        </Link>
      </section>

      <section className="home-next" aria-labelledby="home-next-heading">
        <header className="home-section-heading">
          <div>
            <span className="home-eyebrow">Up next</span>
            <h2 id="home-next-heading">
              {actionCount
                ? `${actionCount} item${actionCount === 1 ? '' : 's'} need your attention`
                : 'You’re all caught up'}
            </h2>
          </div>
          <Link to="/trades?section=activity">Open trade activity <FaArrowRight aria-hidden="true" /></Link>
        </header>

        <div className="home-action-grid">
          <Link
            className={`home-action-card home-action-card--trade ${tradeSummary.needsResponse ? 'has-action' : ''}`}
            to="/trades?section=activity"
          >
            <span className="home-action-card__icon"><FaExchangeAlt aria-hidden="true" /></span>
            <span>
              <strong>{tradeSummary.needsResponse ? `${tradeSummary.needsResponse} offer${tradeSummary.needsResponse === 1 ? '' : 's'} to review` : 'No new offers'}</strong>
              <small>{tradeSummary.needsResponse ? 'A trainer is waiting for your response.' : 'New trade proposals will appear here.'}</small>
            </span>
            <FaArrowRight aria-hidden="true" />
          </Link>

          <Link
            className={`home-action-card home-action-card--confirm ${tradeSummary.readyToConfirm ? 'has-action' : ''}`}
            to="/trades?section=activity"
          >
            <span className="home-action-card__icon"><FaCheckCircle aria-hidden="true" /></span>
            <span>
              <strong>{tradeSummary.readyToConfirm ? `${tradeSummary.readyToConfirm} trade${tradeSummary.readyToConfirm === 1 ? '' : 's'} ready to confirm` : 'No confirmations due'}</strong>
              <small>{tradeSummary.waiting ? `${tradeSummary.waiting} active trade${tradeSummary.waiting === 1 ? '' : 's'} waiting on another trainer.` : 'Accepted trades will show up here.'}</small>
            </span>
            <FaArrowRight aria-hidden="true" />
          </Link>

          <Link
            className={`home-action-card home-action-card--social ${incomingFriends ? 'has-action' : ''}`}
            to="/profile/friends"
          >
            <span className="home-action-card__icon"><FaUserFriends aria-hidden="true" /></span>
            <span>
              <strong>
                {friendsQuery.isLoading
                  ? 'Checking friend requests…'
                  : incomingFriends
                    ? `${incomingFriends} friend request${incomingFriends === 1 ? '' : 's'}`
                    : friendsQuery.isError
                      ? 'Friends are temporarily unavailable'
                      : 'No new friend requests'}
              </strong>
              <small>{friendsQuery.isError ? 'Open Friends to try again.' : 'Grow your trusted trainer network.'}</small>
            </span>
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="home-dashboard__main-grid">
        <section className="home-panel home-collection-panel" aria-labelledby="home-collection-heading">
          <header className="home-section-heading">
            <div>
              <span className="home-eyebrow">Your collection</span>
              <h2 id="home-collection-heading">At a glance</h2>
            </div>
            <Link to={homeExperienceParityContract.collectionPath}>Manage Pokémon <FaArrowRight aria-hidden="true" /></Link>
          </header>

          {instancesLoading ? (
            <div className="home-panel-state" role="status">Loading your collection…</div>
          ) : (
            <div className="home-stat-grid">
              <Link to={homeExperienceParityContract.collectionSummaryPaths.caught} className="home-stat home-stat--caught">
                <strong>{collection.caught.toLocaleString()}</strong><span>Caught</span>
              </Link>
              <Link to={homeExperienceParityContract.collectionSummaryPaths.favorites} className="home-stat home-stat--favorite">
                <strong>{collection.favorites.toLocaleString()}</strong><span><FaStar aria-hidden="true" /> Favorites</span>
              </Link>
              <Link to={homeExperienceParityContract.collectionSummaryPaths.trade} className="home-stat home-stat--trade">
                <strong>{collection.forTrade.toLocaleString()}</strong><span><FaExchangeAlt aria-hidden="true" /> For Trade</span>
              </Link>
              <Link to={homeExperienceParityContract.collectionSummaryPaths.wanted} className="home-stat home-stat--wanted">
                <strong>{collection.wanted.toLocaleString()}</strong><span><FaHeart aria-hidden="true" /> Wanted</span>
                {collection.mostWanted ? <small>{collection.mostWanted} most wanted</small> : null}
              </Link>
            </div>
          )}

          <div className="home-collection-panel__actions">
            <Link to={homeExperienceParityContract.collectionPath}><span>Open collection</span><FaArrowRight aria-hidden="true" /></Link>
            <Link to="/trade-board"><FaShareAlt aria-hidden="true" /><span>Share Trade Board</span></Link>
          </div>
        </section>

        <section className="home-panel home-trade-panel" aria-labelledby="home-trade-heading">
          <header className="home-section-heading">
            <div>
              <span className="home-eyebrow">Trading</span>
              <h2 id="home-trade-heading">Trade workspace</h2>
            </div>
          </header>
          <div className="home-trade-panel__summary">
            <span><strong>{tradeSummary.active}</strong> active</span>
            <span><strong>{tradeSummary.completed}</strong> completed</span>
          </div>
          <nav aria-label="Trade shortcuts">
            <Link to="/trades?section=preferences">
              <span><FaHeart aria-hidden="true" /><span><strong>Trade preferences</strong><small>Fine-tune what you offer and want.</small></span></span>
              <FaArrowRight aria-hidden="true" />
            </Link>
            <Link to="/trades?section=activity">
              <span><FaClock aria-hidden="true" /><span><strong>Trade activity</strong><small>Review proposals and complete trades.</small></span></span>
              <FaArrowRight aria-hidden="true" />
            </Link>
            <Link to="/trade-board">
              <span><FaShareAlt aria-hidden="true" /><span><strong>Share Trade Board</strong><small>Create a shareable snapshot or live link.</small></span></span>
              <FaArrowRight aria-hidden="true" />
            </Link>
          </nav>
        </section>
      </div>

      <section className="home-panel home-recent-panel" aria-labelledby="home-recent-heading">
        <header className="home-section-heading">
          <div>
            <span className="home-eyebrow">Recently updated</span>
            <h2 id="home-recent-heading">Your latest Pokémon</h2>
          </div>
          <Link to={homeExperienceParityContract.collectionPath}>View all <FaArrowRight aria-hidden="true" /></Link>
        </header>
        {instancesLoading || variantsLoading ? (
          <div className="home-panel-state" role="status">Loading recent Pokémon…</div>
        ) : recentInstances.length ? (
          <ul className="home-recent-pokemon">
            {recentInstances.map((instance) => (
              <RecentPokemon
                key={instance.instance_id}
                instance={instance}
                variant={variantById.get(instance.variant_id)}
              />
            ))}
          </ul>
        ) : (
          <div className="home-empty-state">
            <span aria-hidden="true">＋</span>
            <div><strong>Start your collection</strong><p>Add your first caught or wanted Pokémon to see recent updates here.</p></div>
            <Link to="/pokemon">Open Pokémon</Link>
          </div>
        )}
      </section>

      <section className="home-quick-links" aria-labelledby="home-explore-heading">
        <header className="home-section-heading">
          <div><span className="home-eyebrow">Explore</span><h2 id="home-explore-heading">More trainer tools</h2></div>
          <Link to="/help">Help &amp; guides <FaArrowRight aria-hidden="true" /></Link>
        </header>
        <div>
          <Link to="/pokedex"><img src="/images/btn_pokedex.png" alt="" /><span><strong>Pokédex</strong><small>Track registrations</small></span></Link>
          <Link to="/raid"><img src="/images/btn_raid.png" alt="" /><span><strong>Raids</strong><small>Build counters</small></span></Link>
          <Link to="/pvp"><img src="/images/btn_pvp.png" alt="" /><span><strong>PvP</strong><small>Explore rankings</small></span></Link>
          <Link to="/max"><img src="/images/btn_max.png" alt="" /><span><strong>Max Battles</strong><small>Plan your team</small></span></Link>
        </div>
      </section>
        </>
      )}
    </div>
  );
};

export default HomeDashboard;
