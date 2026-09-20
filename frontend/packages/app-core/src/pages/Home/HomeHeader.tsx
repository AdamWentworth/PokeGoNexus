import { FaArrowDown, FaCheckCircle, FaExchangeAlt } from 'react-icons/fa';
import { Link } from 'react-router';

import PokemonArtwork from '@/components/pokemonComponents/PokemonArtwork';

import HomeActionMenuHint from './HomeActionMenuHint';
import './HomeHeader.css';

interface HomeHeaderProps {
  logoUrl: string;
  lockupUrl: string;
  isLoggedIn: boolean;
}

const HomeHeader = ({ logoUrl, lockupUrl, isLoggedIn }: HomeHeaderProps) => {
  const handleExploreFeatures = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const directory = document.getElementById('feature-directory');
    if (!directory) return;

    const prefersReducedMotion =
      document.documentElement.dataset.reducedMotion === 'true' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    directory.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    window.history.replaceState(
      window.history.state,
      '',
      '#feature-directory',
    );
  };

  return (
    <header className="homeHeader">
      <nav className="homeHeader__nav" aria-label="Home navigation">
        <Link className="home-brand" to="/" aria-label="Pokémon Go Nexus home">
          <img src={logoUrl} alt="" onContextMenu={(event) => event.preventDefault()} />
          <span>Pokémon Go Nexus</span>
        </Link>
        <div className="homeHeader__nav-links">
          <Link to="/getting-started">How it works</Link>
          <Link to="/help">Help</Link>
          <Link to="/download">Android beta</Link>
          {!isLoggedIn ? <Link className="homeHeader__login" to="/login">Log in</Link> : null}
          {!isLoggedIn ? <Link className="homeHeader__register" to="/register">Create account</Link> : null}
        </div>
      </nav>

      <div className="homeHeader__hero home-shell">
        <div className="homeHeader__copy">
          <img
            className="homeHeader__hero-logo"
            src={lockupUrl}
            alt="Pokémon Go Nexus"
            onContextMenu={(event) => event.preventDefault()}
          />
          <span className="home-eyebrow">The ultimate trainer hub</span>
          <h1>Build your collection.<br /><em>Find the right trade.</em></h1>
          <p>
            Pokémon Go Nexus is the go-to platform for Pokémon GO trainers to catalog Pokémon,
            showcase rare catches, and find players whose For Trade and Wanted lists actually line up.
          </p>
          {!isLoggedIn ? (
            <div className="homeHeader__actions">
              <Link className="home-primary-action" to="/register">Create your free account</Link>
              <a className="home-secondary-action" href="#feature-directory" onClick={handleExploreFeatures}>
                Explore the app <FaArrowDown aria-hidden="true" />
              </a>
            </div>
          ) : null}
          {!isLoggedIn ? <HomeActionMenuHint trainerKey="guest" audience="guest" /> : null}
          <ul className="homeHeader__proof" aria-label="Product highlights">
            <li><FaCheckCircle aria-hidden="true" /> Exact variants and custom tags</li>
            <li><FaCheckCircle aria-hidden="true" /> Reciprocal trade matching</li>
            <li><FaCheckCircle aria-hidden="true" /> Built for mobile and desktop</li>
          </ul>
        </div>

        <div className="homeHeader__match-preview" aria-label="Example reciprocal trade match">
          <div className="homeHeader__match-heading">
            <span>Reciprocal match</span>
            <strong>You each have what the other trainer wants</strong>
          </div>
          <div className="homeHeader__exchange">
            <article className="homeHeader__exchange-pokemon homeHeader__exchange-pokemon--trade">
              <small>You offer</small>
              <PokemonArtwork
                alt="Shiny Gigantamax Charizard"
                className="homeHeader__exchange-artwork"
                gigantamax
                imageUrl="/images/shiny_gigantamax/shiny_gigantamax_6.png"
              />
              <strong>Shiny Gigantamax Charizard</strong>
              <span>On your For Trade list</span>
            </article>
            <span className="homeHeader__exchange-icon" aria-hidden="true">
              <img src="/images/pogo_trade_icon.png" alt="" />
            </span>
            <article className="homeHeader__exchange-pokemon homeHeader__exchange-pokemon--wanted">
              <small>You want</small>
              <PokemonArtwork
                alt="Shiny Detective Pikachu"
                className="homeHeader__exchange-artwork"
                imageUrl="/images/costumes_shiny/pokemon_25_detective_shiny.png"
              />
              <strong>Shiny Detective Pikachu</strong>
              <span>On your Wanted list</span>
            </article>
          </div>
          <div className="homeHeader__match-result">
            <FaExchangeAlt aria-hidden="true" />
            <span><strong>Ready to review</strong><small>Compare the exact Pokémon, friendship, eligibility, and Stardust cost.</small></span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default HomeHeader;
