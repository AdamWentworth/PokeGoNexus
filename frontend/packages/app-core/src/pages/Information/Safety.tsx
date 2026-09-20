import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaBan,
  FaCheckCircle,
  FaComments,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaUserLock,
  FaUsers,
} from 'react-icons/fa';
import { Link } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import './InformationPage.css';
import usePublicPageMetadata from './usePublicPageMetadata';

type SafetyGuidance = {
  details: string[];
  icon: IconType;
  title: string;
};

const SAFETY_GUIDANCE: SafetyGuidance[] = [
  {
    icon: FaCheckCircle,
    title: 'Confirm the exact exchange',
    details: [
      'Review both Pokémon, forms, costumes, and other meaningful details before agreeing.',
      'Check the estimated Stardust and special-trade conditions, then confirm them again in Pokémon GO.',
    ],
  },
  {
    icon: FaUserLock,
    title: 'Protect every account',
    details: [
      'Never share a password, provider login, verification code, recovery link, or device access.',
      'Pokémon Go Nexus does not need your Pokémon GO login credentials to organize a trade.',
    ],
  },
  {
    icon: FaMapMarkerAlt,
    title: 'Meet with care',
    details: [
      'For local trades, use a familiar public place and avoid sharing more location detail than necessary.',
      'Tell someone where you are going when meeting an unfamiliar trainer, and leave if anything feels wrong.',
    ],
  },
  {
    icon: FaUsers,
    title: 'Treat trainers respectfully',
    details: [
      'Keep listings accurate, communicate changes, and do not pressure another trainer to continue.',
      'Harassment, impersonation, deceptive listings, and attempts to obtain money or credentials are not acceptable.',
    ],
  },
  {
    icon: FaComments,
    title: 'Coordinate outside the app carefully',
    details: [
      'Pokémon Go Nexus has no chat; accepted partners may share a Trainer Code and a preferred external method such as Campfire or Discord.',
      'External messages are not moderated by Pokémon Go Nexus. Share only what is necessary, and use each service’s own privacy, reporting, and blocking tools.',
    ],
  },
  {
    icon: FaBan,
    title: 'Use privacy and blocking controls',
    details: [
      'Limit profile, collection, trainer-code, and location visibility to the audience you are comfortable with.',
      'Cancel the interaction and block a trainer when continued contact is unwanted or unsafe.',
    ],
  },
  {
    icon: FaExclamationTriangle,
    title: 'Stop when the details change',
    details: [
      'Do not continue when the offered Pokémon, cost, account, meeting place, or other terms differ unexpectedly.',
      'Preserve relevant messages or screenshots if you may need to document harmful behavior elsewhere.',
    ],
  },
];

const Safety = () => {
  usePublicPageMetadata(
    'Trade Safety & Community Guidelines | Pokémon Go Nexus',
    'Review account, privacy, meetup, community, and trade-planning guidance for using Pokémon Go Nexus responsibly.',
  );

  return (
    <AppPageShell
      className="information-page information-page--safety"
      contentClassName="information-page__shell"
      maxWidth="workspace"
    >
      <ProductPageHeader
        align="center"
        description="Protect your account, personal information, and comfort while coordinating trades with other trainers."
        eyebrow="Trainer trust"
        icon={<FaShieldAlt aria-hidden="true" />}
        title="Trade Safety & Community Guidelines"
      />

      <aside className="information-callout information-callout--important">
        <FaExchangeAlt aria-hidden="true" />
        <div>
          <strong>Pokémon Go Nexus plans the exchange; Pokémon GO performs it.</strong>
          <p>
            A listing, match, proposal, friendship setting, or cost estimate in this app is
            planning information. Always verify the final Pokémon, eligibility, trade cost,
            and outcome in Pokémon GO before confirming the real trade.
          </p>
        </div>
      </aside>

      <section className="information-section" aria-labelledby="safety-guidance-title">
        <header className="information-section__header">
          <span className="information-eyebrow">Before and during a trade</span>
          <h2 id="safety-guidance-title">Keep the interaction clear, private, and voluntary.</h2>
        </header>
        <div className="information-card-grid information-card-grid--two">
          {SAFETY_GUIDANCE.map(({ details, icon: Icon, title }) => (
            <article className="information-card information-card--guidance" key={title}>
              <span className="information-card__icon"><Icon aria-hidden="true" /></span>
              <div>
                <h3>{title}</h3>
                <ul>
                  {details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="information-boundaries" aria-labelledby="safety-boundaries-title">
        <header className="information-section__header">
          <span className="information-eyebrow">Know the boundary</span>
          <h2 id="safety-boundaries-title">What the platform can—and cannot—establish.</h2>
        </header>
        <div className="information-boundaries__grid">
          <article>
            <strong>Pokémon Go Nexus can help you</strong>
            <ul>
              <li>Describe exact collection and wishlist records.</li>
              <li>Find compatible public listings and trainers.</li>
              <li>Review proposals and track agreed workflow states.</li>
              <li>Control visibility and block unwanted contact.</li>
            </ul>
          </article>
          <article>
            <strong>Pokémon Go Nexus cannot guarantee</strong>
            <ul>
              <li>Another person’s identity, conduct, or availability.</li>
              <li>That a stale listing still matches the trainer’s game account.</li>
              <li>A Lucky result, exact Stardust cost, or successful in-game trade.</li>
              <li>Safety outside the service or compliance with local rules.</li>
              <li>Messages, conduct, or moderation on Campfire, Discord, or another external service.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="information-cta" aria-labelledby="safety-controls-title">
        <div>
          <span className="information-eyebrow">Your controls</span>
          <h2 id="safety-controls-title">Review visibility and manage trainer access.</h2>
          <p>Privacy settings and the blocked-trainer list remain available from your account.</p>
        </div>
        <div className="information-cta__actions">
          <Link className="information-button information-button--primary" to="/settings">
            Privacy settings <FaArrowRight aria-hidden="true" />
          </Link>
          <Link className="information-button" to="/profile/friends">Friends &amp; blocked</Link>
          <Link className="information-button" to="/terms">Terms of Service</Link>
        </div>
      </section>
    </AppPageShell>
  );
};

export default Safety;
