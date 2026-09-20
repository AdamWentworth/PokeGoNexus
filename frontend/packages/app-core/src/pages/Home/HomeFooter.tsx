import { FaArrowRight } from 'react-icons/fa';
import { Link } from 'react-router';

import './HomeFooter.css';

const HomeFooter = () => (
  <footer className="homeFooter">
    <div className="homeFooter__inner home-shell">
      <section className="homeFooter__cta" aria-labelledby="home-footer-cta-title">
        <img
          className="homeFooter__lockup"
          src="/images/logo/lockup.png"
          alt="Pokémon Go Nexus"
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="homeFooter__cta-copy">
          <span className="home-eyebrow">Ready to trade smarter?</span>
          <h2 id="home-footer-cta-title">Bring your collection. Find the right trainer.</h2>
          <p>
            Create your free account to organize exact Pokémon, publish your trade
            list, and discover exchanges that work for both trainers.
          </p>
        </div>
        <div className="homeFooter__cta-actions">
          <Link className="home-primary-action" to="/register">
            Create account <FaArrowRight aria-hidden="true" />
          </Link>
          <Link className="home-secondary-action" to="/getting-started">
            Quick start guide
          </Link>
        </div>
      </section>

      <div className="homeFooter__directory">
        <div className="homeFooter__about">
          <strong>Pokémon Go Nexus</strong>
          <p>
            A collection, discovery, and trading hub built around the details
            Pokémon GO trainers actually care about.
          </p>
        </div>

        <nav className="homeFooter__links" aria-label="Pokémon Go Nexus footer">
          <section>
            <h3>Get started</h3>
            <Link to="/download">Android beta</Link>
            <Link to="/help">Help &amp; information</Link>
            <Link to="/faq">Frequently asked questions</Link>
            <Link to="/about">About Pokémon Go Nexus</Link>
            <Link to="/getting-started">How it works</Link>
            <Link to="/pokemon">Collection</Link>
            <Link to="/search">Search &amp; discovery</Link>
            <Link to="/trades">Trades</Link>
            <Link to="/trade-board">Trade Board</Link>
          </section>
          <section>
            <h3>Trainer tools</h3>
            <Link to="/pokedex">Pokédex</Link>
            <Link to="/raid">Raids</Link>
            <Link to="/pvp">PvP</Link>
            <Link to="/max">Max Battles</Link>
            <Link to="/rankings">Rankings</Link>
          </section>
          <section>
            <h3>Account &amp; legal</h3>
            <Link to="/login">Log in</Link>
            <Link to="/register">Create account</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/data-deletion">Data deletion</Link>
            <Link to="/safety">Trade safety</Link>
          </section>
        </nav>
      </div>

      <div className="homeFooter__legal">
        <p>© {new Date().getFullYear()} Pokémon Go Nexus.</p>
        <p>
          Pokémon Go Nexus is an independent community project and is not affiliated
          with or endorsed by Niantic, The Pokémon Company, Nintendo, or other
          rights holders. Pokémon, Pokémon GO, related names, images, and
          trademarks belong to their respective owners.
        </p>
      </div>
    </div>
  </footer>
);

export default HomeFooter;
