import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaExchangeAlt,
  FaGlobeAmericas,
  FaSearch,
  FaShieldAlt,
  FaTags,
  FaUsers,
} from 'react-icons/fa';
import { Link } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import './InformationPage.css';
import usePublicPageMetadata from './usePublicPageMetadata';

type Principle = {
  description: string;
  icon: IconType;
  title: string;
};

const PRINCIPLES: Principle[] = [
  {
    icon: FaTags,
    title: 'Exact collections',
    description:
      'Forms, costumes, backgrounds, moves, sizes, tags, and ownership states stay attached to the Pokémon they describe.',
  },
  {
    icon: FaSearch,
    title: 'Reciprocal discovery',
    description:
      'Search is designed to find a trainer who has what you want and may also want something you can actually offer.',
  },
  {
    icon: FaShieldAlt,
    title: 'Authoritative trade workflows',
    description:
      'Trade proposals and state changes are validated by the server instead of being treated as successful only in one browser.',
  },
];

const PRODUCT_LINKS = [
  {
    icon: FaTags,
    title: 'Collection',
    description: 'Catalog exact Pokémon and organize them with flexible tags.',
    to: '/pokemon',
  },
  {
    icon: FaSearch,
    title: 'Discovery',
    description: 'Find trainers, listings, and reciprocal trade possibilities.',
    to: '/search',
  },
  {
    icon: FaExchangeAlt,
    title: 'Trading',
    description: 'Set preferences, propose exchanges, and follow their state.',
    to: '/trades',
  },
  {
    icon: FaUsers,
    title: 'Trainer network',
    description: 'Manage profiles, friends, visibility, and blocked trainers.',
    to: '/profile/friends',
  },
];

const About = () => {
  usePublicPageMetadata(
    'About | Pokémon Go Nexus',
    'Learn why Pokémon Go Nexus combines exact collection management, reciprocal discovery, and safer trade planning in one trainer hub.',
  );

  return (
    <AppPageShell
      className="information-page information-page--about"
      contentClassName="information-page__shell"
      maxWidth="workspace"
    >
      <ProductPageHeader
        align="center"
        description="A trainer-focused collection, discovery, and trade-planning hub built around the details that make each Pokémon distinct."
        eyebrow="Independent community project"
        icon={<FaGlobeAmericas aria-hidden="true" />}
        title="About Pokémon Go Nexus"
      />

      <section className="information-story" aria-labelledby="about-purpose-title">
        <img
          alt="Pokémon Go Nexus"
          className="information-story__logo"
          onContextMenu={(event) => event.preventDefault()}
          src="/images/logo/lockup.png"
        />
        <div>
          <span className="information-eyebrow">Why it exists</span>
          <h2 id="about-purpose-title">Trading starts with understanding what everyone actually has.</h2>
          <p>
            A Pokémon name alone rarely describes a useful trade. Pokémon Go Nexus connects
            exact collection records, personal Wanted and For Trade preferences, trainer
            discovery, and an explicit proposal workflow so both sides can understand an
            exchange before coordinating it in Pokémon GO.
          </p>
          <p>
            The goal is not to replace the game. It is to make the planning around collecting,
            finding, and trading far more organized.
          </p>
        </div>
      </section>

      <section className="information-section" aria-labelledby="about-principles-title">
        <header className="information-section__header">
          <span className="information-eyebrow">Product principles</span>
          <h2 id="about-principles-title">One connected model, not a pile of unrelated tools.</h2>
        </header>
        <div className="information-card-grid information-card-grid--three">
          {PRINCIPLES.map(({ description, icon: Icon, title }) => (
            <article className="information-card" key={title}>
              <span className="information-card__icon"><Icon aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="information-section" aria-labelledby="about-hub-title">
        <header className="information-section__header">
          <span className="information-eyebrow">The trainer hub</span>
          <h2 id="about-hub-title">Move naturally from a collection to the right trainer.</h2>
        </header>
        <div className="information-link-grid">
          {PRODUCT_LINKS.map(({ description, icon: Icon, title, to }) => (
            <Link className="information-link-card" key={to} to={to}>
              <span><Icon aria-hidden="true" /></span>
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
              <FaArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <aside className="information-callout information-callout--independent">
        <FaShieldAlt aria-hidden="true" />
        <div>
          <strong>Independent by design</strong>
          <p>
            Pokémon Go Nexus is an independent community project. It is not affiliated with
            or endorsed by Niantic, The Pokémon Company, Nintendo, or other rights holders.
            Pokémon, Pokémon GO, related names, images, and trademarks belong to their
            respective owners.
          </p>
        </div>
      </aside>

      <section className="information-cta" aria-labelledby="about-next-title">
        <div>
          <span className="information-eyebrow">See it in context</span>
          <h2 id="about-next-title">Follow the collection-to-trade workflow.</h2>
          <p>The illustrated guide shows how the major parts of Pokémon Go Nexus fit together.</p>
        </div>
        <div className="information-cta__actions">
          <Link className="information-button information-button--primary" to="/getting-started">
            Getting Started <FaArrowRight aria-hidden="true" />
          </Link>
          <Link className="information-button" to="/faq">Read the FAQ</Link>
        </div>
      </section>
    </AppPageShell>
  );
};

export default About;
