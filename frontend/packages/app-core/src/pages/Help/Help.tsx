import type { IconType } from 'react-icons';
import {
  FaArrowRight,
  FaAndroid,
  FaBookOpen,
  FaCompass,
  FaFileContract,
  FaGlobeAmericas,
  FaQuestionCircle,
  FaShieldAlt,
  FaTrashAlt,
  FaTrophy,
  FaUserShield,
  FaUsers,
} from 'react-icons/fa';
import { Link } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import './Help.css';

type HelpLink = {
  description: string;
  icon: IconType;
  label: string;
  to: string;
};

type HelpSection = {
  description: string;
  links: HelpLink[];
  title: string;
};

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Start using Pokémon Go Nexus',
    description: 'Learn the collection-to-trade workflow in the same order you will use it.',
    links: [
      {
        description: 'Try the native Android beta, install updates, and share feedback. iPhone testing opens later.',
        icon: FaAndroid,
        label: 'Android beta',
        to: '/download',
      },
      {
        description: 'Quick answers about accounts, collections, tags, trades, Search, privacy, and sharing.',
        icon: FaQuestionCircle,
        label: 'Frequently asked questions',
        to: '/faq',
      },
      {
        description: 'Build a collection, create Wanted and For Trade entries, find a match, and propose safely.',
        icon: FaCompass,
        label: 'Getting started',
        to: '/getting-started',
      },
    ],
  },
  {
    title: 'About and community',
    description: 'Understand the project and review the expectations that support safer trainer interactions.',
    links: [
      {
        description: 'Why the collection, discovery, and trade-planning tools belong in one trainer hub.',
        icon: FaGlobeAmericas,
        label: 'About Pokémon Go Nexus',
        to: '/about',
      },
      {
        description: 'Protect your account, privacy, and comfort while coordinating with other trainers.',
        icon: FaUsers,
        label: 'Trade safety & community guidelines',
        to: '/safety',
      },
    ],
  },
  {
    title: 'Understand the trainer tools',
    description: 'See what the app calculates, what each ranking answers, and where the limits are.',
    links: [
      {
        description: 'How general strength, type rankings, boss counters, battle simulation, and raid metrics work.',
        icon: FaShieldAlt,
        label: 'Raid methodology',
        to: '/raid/methodology',
      },
      {
        description: 'How rankings, IV Rank, Team Builder, Battle Lab, and published source data fit together.',
        icon: FaTrophy,
        label: 'PvP methodology',
        to: '/pvp/methodology',
      },
    ],
  },
  {
    title: 'Privacy and account information',
    description: 'Review the policies that apply to your account and the data controls available to you.',
    links: [
      {
        description: 'What information Pokémon Go Nexus collects, why it is used, and how it is protected.',
        icon: FaUserShield,
        label: 'Privacy policy',
        to: '/privacy',
      },
      {
        description: 'The rules and responsibilities that apply when using Pokémon Go Nexus.',
        icon: FaFileContract,
        label: 'Terms of service',
        to: '/terms',
      },
      {
        description: 'How to remove your Pokémon Go Nexus account and associated personal data.',
        icon: FaTrashAlt,
        label: 'Data deletion',
        to: '/data-deletion',
      },
    ],
  },
];

const Help = () => (
  <AppPageShell
    className="help-page"
    contentClassName="help-page__shell"
    maxWidth="workspace"
  >
    <ProductPageHeader
      align="center"
      description="Find the right guide, understand how a tool works, or review account and privacy information. This directory is available whether you are signed in or not."
      eyebrow="Trainer resources"
      icon={<FaBookOpen aria-hidden="true" />}
      title="Help & information"
    />

    <div className="help-page__directory">
      {HELP_SECTIONS.map((section) => (
        <section className="help-section" key={section.title}>
          <header>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </header>
          <div className="help-section__links">
            {section.links.map(({ description, icon: Icon, label, to }) => (
              <Link className="help-link" key={to} to={to}>
                <span className="help-link__icon"><Icon aria-hidden="true" /></span>
                <span className="help-link__copy">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <FaArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  </AppPageShell>
);

export default Help;
