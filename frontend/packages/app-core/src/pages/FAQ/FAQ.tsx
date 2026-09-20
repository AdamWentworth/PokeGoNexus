import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { IconType } from 'react-icons';
import {
  FaArrowLeft,
  FaArrowRight,
  FaBookOpen,
  FaChevronDown,
  FaExchangeAlt,
  FaLink,
  FaQuestionCircle,
  FaSearch,
  FaTags,
  FaTimes,
  FaUserShield,
} from 'react-icons/fa';
import { Link, useLocation } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import './FAQ.css';

type FaqCategory = 'account' | 'collection' | 'trading' | 'discovery';

type FaqItem = {
  answer: string[];
  category: FaqCategory;
  id: string;
  question: string;
  related?: {
    label: string;
    to: string;
  };
};

type FaqCategoryMeta = {
  description: string;
  icon: IconType;
  id: FaqCategory;
  label: string;
};

const FAQ_CATEGORIES: FaqCategoryMeta[] = [
  {
    id: 'account',
    label: 'Account & access',
    description: 'Login methods, password recovery, and account control.',
    icon: FaUserShield,
  },
  {
    id: 'collection',
    label: 'Collection & tags',
    description: 'Statuses, custom organization, and collection synchronization.',
    icon: FaTags,
  },
  {
    id: 'trading',
    label: 'Trading',
    description: 'Preferences, proposals, eligibility, costs, and trade states.',
    icon: FaExchangeAlt,
  },
  {
    id: 'discovery',
    label: 'Discovery & privacy',
    description: 'Search, friends, location, visibility, and public sharing.',
    icon: FaSearch,
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'same-email-account',
    category: 'account',
    question: 'Does the same email always open the same account?',
    answer: [
      'Yes. When a supported OAuth provider returns the same verified email as an existing email/password or OAuth account, logging in uses that existing Pokémon Go Nexus account and its collection data.',
      'If you choose Sign up with an email that already belongs to an account, registration is refused and you are directed to log in instead. This prevents a second account from being created for the same email.',
    ],
  },
  {
    id: 'signup-versus-login',
    category: 'account',
    question: 'Should I choose Sign up or Log in with Google, Discord, or Facebook?',
    answer: [
      'Use Sign up only when creating a new Pokémon Go Nexus account. Use Log in when the email already has an account, even if you originally registered with a different supported login method.',
      'OAuth may temporarily open a system browser or provider app. That handoff is controlled partly by your device and the provider; Pokémon Go Nexus returns you to the authenticated experience after a successful callback whenever the browser permits it.',
    ],
  },
  {
    id: 'password-reset',
    category: 'account',
    question: 'How do I reset my password?',
    answer: [
      'Choose Reset Password on the login screen and submit the email address on your account. The reset email contains a time-limited link that opens the secure password form.',
      'For privacy, the request screen does not confirm whether a particular email is registered. OAuth-only accounts can continue using their connected provider.',
    ],
  },
  {
    id: 'delete-account',
    category: 'account',
    question: 'How do I delete my account and personal data?',
    answer: [
      'Signed-in users can begin account deletion from account settings. The data-deletion guide explains the scope and confirmation process before anything is removed.',
    ],
    related: { label: 'Read the data-deletion guide', to: '/data-deletion' },
  },
  {
    id: 'collection-statuses',
    category: 'collection',
    question: 'What do Caught, For Trade, Wanted, and Most Wanted mean?',
    answer: [
      'Caught is your owned inventory. For Trade is an owned, tradeable Pokémon you are offering. Wanted is a wishlist entry rather than an owned copy, and Most Wanted is a priority marker within that wishlist.',
      'A Wanted entry can describe the exact form, costume, moves, size class, background, friendship, and other conditions you care about without pretending that you already own it.',
    ],
  },
  {
    id: 'favorites-and-trade',
    category: 'collection',
    question: 'Can a Favorite Pokémon also be listed For Trade?',
    answer: [
      'No. Favorites and For Trade are intentionally mutually exclusive. The organizer and instance editor prevent a Favorite from being offered and prevent a For Trade Pokémon from being marked Favorite.',
      'Remove the existing status first if your intent changes. This guard helps avoid offering a Pokémon you meant to protect.',
    ],
  },
  {
    id: 'wanted-becomes-caught',
    category: 'collection',
    question: 'What happens when I obtain a Pokémon from my Wanted list?',
    answer: [
      'You can move the Wanted entry into Caught. Pokémon Go Nexus preserves the exact variant details that remain applicable, removes it from the wishlist context, and lets you organize the new owned instance with inventory tags.',
      'A caught Pokémon can also be copied into Wanted when you want another copy; the owned instance and wishlist entry remain separate records with different purposes.',
    ],
  },
  {
    id: 'custom-tags',
    category: 'collection',
    question: 'How do custom tags work?',
    answer: [
      'Create color-coded tags from the Tags view or Pokémon Organizer, then apply them while creating Pokémon or to existing instances. Inventory tags organize Caught Pokémon; wishlist tags organize Wanted Pokémon.',
      'Default system groups such as All Caught, Favorites, For Trade, All Wanted, and Most Wanted keep their built-in rules. You can reorder the combined tag cards to fit your own workflow.',
    ],
  },
  {
    id: 'collection-sync',
    category: 'collection',
    question: 'Why can collection changes feel immediate before synchronization finishes?',
    answer: [
      'The collection is cached locally so large or repeated Pokémon updates do not hold the interface hostage. Eligible Pokémon changes can be batched and synchronized through the receiver in the background.',
      'Trade commands are different: proposals and state changes require a connection and are not considered successful until the server commits them.',
    ],
  },
  {
    id: 'trade-preferences',
    category: 'trading',
    question: 'What are Trade Preferences and Wanted Conditions?',
    answer: [
      'For Trade preferences describe which Wanted Pokémon you would accept for a particular Pokémon you own. Wanted conditions describe which of another trainer’s For Trade Pokémon fit a particular wishlist entry.',
      'Manage those reusable rules in Trade Preferences. When viewing another trainer’s catalog, the compatible targets lead directly into a proposal for exact owned instances.',
    ],
  },
  {
    id: 'propose-trade',
    category: 'trading',
    question: 'How do I propose a trade?',
    answer: [
      'Open another trainer’s For Trade or Wanted listing, choose a compatible target, select the exact Pokémon you own when needed, and review the exchange. Your Pokémon is always shown on the left and theirs on the right in the final proposal screen.',
      'The server rechecks both participants, ownership, friendship and privacy rules, active-trade conflicts, and the current Pokémon state before accepting the proposal.',
    ],
  },
  {
    id: 'remote-trades',
    category: 'trading',
    question: 'What does the fifth friendship heart mean?',
    answer: [
      'Five hearts represents Forever Friends and makes a remote trade available. Remote eligibility is separate from Lucky Friends: a five-heart remote trade may be lucky or non-lucky depending on the trainers’ actual Lucky Friends state and preferences.',
      'Lucky Friends can apply at four hearts or higher. The proposal review shows the remote and lucky indicators independently so one is never implied by the other.',
    ],
  },
  {
    id: 'lucky-pokemon',
    category: 'trading',
    question: 'Why can’t I list a Lucky Pokémon For Trade?',
    answer: [
      'Pokémon that have already become Lucky cannot be traded again in Pokémon GO. Pokémon Go Nexus therefore excludes Lucky instances from eligible offers and blocks attempts to convert them into For Trade entries.',
    ],
  },
  {
    id: 'trade-cost',
    category: 'trading',
    question: 'How are Stardust cost and special-trade warnings handled?',
    answer: [
      'The proposal review estimates the Stardust cost from the selected Pokémon, registration state, friendship level, and special-trade rules. It also labels special, remote, and requested-lucky conditions before you send anything.',
      'The estimate is planning guidance. Pokémon GO remains authoritative at the moment the trainers perform the real in-game trade.',
    ],
  },
  {
    id: 'trade-state',
    category: 'trading',
    question: 'Why might a trade action be rejected after the screen was already open?',
    answer: [
      'Trade state is server-authoritative and can change on another device or for the other participant. A stale proposal, ownership change, block, privacy change, or conflicting active trade can make an earlier screen invalid.',
      'The app refreshes from the canonical server response rather than claiming success optimistically. Review the updated Trade Activity card before trying the next valid action.',
    ],
  },
  {
    id: 'trade-communication',
    category: 'trading',
    question: 'How do trainers communicate and complete an accepted trade?',
    answer: [
      'Pokémon Go Nexus does not include chat. After an offer is accepted, the Trade Activity screen can show only the Pokémon GO and coordination details that each participant chose to share for active accepted trades.',
      'Add one another in Pokémon GO and coordinate through Campfire, Discord, or another agreed service. Campfire is the recommended default because it supports Niantic Friends and direct messages. Messaging, meetup arrangements, and the final exchange happen outside Pokémon Go Nexus and remain the trainers’ responsibility.',
    ],
    related: { label: 'Review trade safety guidance', to: '/safety' },
  },
  {
    id: 'search-matchmaker',
    category: 'discovery',
    question: 'What does Matchmaker change in Pokémon Search?',
    answer: [
      'Normal Search finds listings that satisfy your selected Pokémon, ownership, variant, distance, and detail filters. Matchmaker additionally prioritizes reciprocal results where that trainer wants something compatible from your collection.',
      'A match is a discovery hint, not a guaranteed proposal. The trade service validates the exact Pokémon and both accounts again when you submit.',
    ],
  },
  {
    id: 'location-search',
    category: 'discovery',
    question: 'How is location used in Search?',
    answer: [
      'Location and range filters help calculate nearby listings and distance summaries. Results are still limited by each account’s visibility, friendship, and blocking rules.',
      'Only enable or save location information you are comfortable using for discovery, and review your profile privacy controls when those preferences change.',
    ],
  },
  {
    id: 'friends-privacy-blocks',
    category: 'discovery',
    question: 'How do friends, privacy settings, and blocks affect discovery?',
    answer: [
      'Friend relationships can permit additional profile or collection visibility and are ranked ahead where a matching workflow calls for it. Your account settings determine what other trainers may see.',
      'Blocking prevents the blocked relationship from participating in social and trade discovery. Server-side checks enforce these rules again for sensitive actions.',
    ],
  },
  {
    id: 'trade-board-sharing',
    category: 'discovery',
    question: 'What is a Trade Board?',
    answer: [
      'A Trade Board turns selected For Trade and Wanted Pokémon into a polished image and shareable public page. It is designed for Discord, chats, social groups, and trainers who may not use Pokémon Go Nexus yet.',
      'Treat exported images and public links as shareable content. Review the board before publishing it anywhere outside the app.',
    ],
    related: { label: 'Open the Trade Board builder', to: '/trade-board' },
  },
  {
    id: 'unofficial-app',
    category: 'discovery',
    question: 'Is Pokémon Go Nexus an official Pokémon GO service?',
    answer: [
      'No. Pokémon Go Nexus is an independent community project and is not affiliated with or endorsed by Niantic, The Pokémon Company, Nintendo, or other rights holders.',
      'Pokémon, Pokémon GO, related names, images, and trademarks belong to their respective owners.',
    ],
    related: { label: 'Review the Terms of Service', to: '/terms' },
  },
];

const COMMON_QUESTION_IDS = new Set([
  'same-email-account',
  'collection-statuses',
  'propose-trade',
  'search-matchmaker',
]);

const categoryLabel = (category: FaqCategory) =>
  FAQ_CATEGORIES.find(({ id }) => id === category)?.label ?? category;

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();

const FAQ = () => {
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState<FaqCategory | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearchText(query);

  const visibleItems = useMemo(
    () =>
      FAQ_ITEMS.filter((item) => {
        if (!normalizedQuery && activeCategory && item.category !== activeCategory) {
          return false;
        }
        if (!normalizedQuery) {
          return activeCategory !== null || COMMON_QUESTION_IDS.has(item.id);
        }
        return normalizeSearchText(
          [item.question, ...item.answer, categoryLabel(item.category)].join(' '),
        ).includes(normalizedQuery);
      }),
    [activeCategory, normalizedQuery],
  );

  useEffect(() => {
    const previousTitle = document.title;
    const description =
      'Answers about Pokémon Go Nexus accounts, collections, custom tags, trading, Search, privacy, and Trade Boards.';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    const createdMeta = !meta;

    document.title = 'Frequently Asked Questions | Pokémon Go Nexus';
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = description;

    return () => {
      document.title = previousTitle;
      if (createdMeta) {
        meta?.remove();
      } else if (meta && previousDescription !== undefined) {
        meta.content = previousDescription;
      }
    };
  }, []);

  useEffect(() => {
    let targetId = '';
    try {
      targetId = decodeURIComponent(location.hash.replace(/^#/, ''));
    } catch {
      return undefined;
    }
    if (!targetId || !FAQ_ITEMS.some(({ id }) => id === targetId)) return;

    const targetItem = FAQ_ITEMS.find(({ id }) => id === targetId);
    setActiveCategory(targetItem?.category ?? null);
    setQuery('');
    setOpenIds((current) => new Set(current).add(targetId));

    let innerFrameId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      innerFrameId = window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      if (innerFrameId !== null) window.cancelAnimationFrame(innerFrameId);
    };
  }, [location.hash]);

  const handleToggle = (id: string, event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setOpenIds((current) => {
      if (current.has(id) === isOpen) return current;
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allVisibleOpen =
    visibleItems.length > 0 && visibleItems.every(({ id }) => openIds.has(id));
  const activeCategoryLabel = activeCategory ? categoryLabel(activeCategory) : 'Common questions';

  return (
    <AppPageShell
      className="faq-page"
      contentClassName="faq-page__shell"
      maxWidth="workspace"
    >
      <ProductPageHeader
        align="center"
        description="Clear answers about accounts, collections, trading, discovery, privacy, and the rules Pokémon Go Nexus enforces."
        eyebrow="Trainer support"
        icon={<FaQuestionCircle aria-hidden="true" />}
        title="Frequently asked questions"
      />

      <section className="faq-tools" aria-label="Filter frequently asked questions">
        <div className="faq-search">
          <FaSearch aria-hidden="true" />
          <label className="faq-search__label" htmlFor="faq-search-input">
            Search questions and answers
          </label>
          <input
            id="faq-search-input"
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim()) setActiveCategory(null);
            }}
            placeholder="Search questions and answers"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear FAQ search"
              onClick={() => setQuery('')}
              type="button"
            >
              <FaTimes aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="faq-categories" aria-label="Browse FAQ topics">
          {FAQ_CATEGORIES.map(({ description, icon: Icon, id, label }) => {
            const questionCount = FAQ_ITEMS.filter((item) => item.category === id).length;
            return (
              <button
                aria-label={`Browse ${label} questions`}
                aria-pressed={activeCategory === id}
                key={id}
                onClick={() => {
                  setActiveCategory(id);
                  setQuery('');
                }}
                type="button"
              >
                <span className="faq-categories__icon"><Icon aria-hidden="true" /></span>
                <span className="faq-categories__copy">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <span className="faq-categories__count">{questionCount}</span>
                <FaArrowRight className="faq-categories__arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="faq-results" aria-labelledby="faq-results-title">
        <header className="faq-results__header">
          <div>
            <span>Knowledge base</span>
            <h2 id="faq-results-title">
              {normalizedQuery ? 'Search results' : activeCategoryLabel}
            </h2>
            <p aria-live="polite">
              {visibleItems.length} {visibleItems.length === 1 ? 'question' : 'questions'}
              {normalizedQuery ? ` matching “${query.trim()}”` : ''}
            </p>
          </div>
          <div className="faq-results__actions">
            {activeCategory && !normalizedQuery ? (
              <button
                className="faq-results__back"
                onClick={() => setActiveCategory(null)}
                type="button"
              >
                <FaArrowLeft aria-hidden="true" /> All topics
              </button>
            ) : null}
            {visibleItems.length > 0 ? (
              <button
                className="faq-results__expand"
                onClick={() =>
                  setOpenIds((current) => {
                    const next = new Set(current);
                    if (allVisibleOpen) {
                      visibleItems.forEach(({ id }) => next.delete(id));
                    } else {
                      visibleItems.forEach(({ id }) => next.add(id));
                    }
                    return next;
                  })
                }
                type="button"
              >
                {allVisibleOpen ? 'Collapse answers' : 'Expand answers'}
              </button>
            ) : null}
          </div>
        </header>

        {visibleItems.length > 0 ? (
          <div className="faq-list">
            {visibleItems.map((item) => (
              <details
                className="faq-item"
                id={item.id}
                key={item.id}
                onToggle={(event) => handleToggle(item.id, event)}
                open={openIds.has(item.id)}
              >
                <summary>
                  <span className="faq-item__category">{categoryLabel(item.category)}</span>
                  <strong>{item.question}</strong>
                  <span className="faq-item__chevron" aria-hidden="true">
                    <FaChevronDown />
                  </span>
                </summary>
                <div className="faq-item__answer">
                  {item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  <div className="faq-item__links">
                    <Link to={`/faq#${item.id}`}>
                      <FaLink aria-hidden="true" /> Link to this answer
                    </Link>
                    {item.related ? (
                      <Link to={item.related.to}>
                        {item.related.label} <FaArrowRight aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="faq-empty" role="status">
            <FaSearch aria-hidden="true" />
            <h3>No matching questions</h3>
            <p>Try a shorter phrase or search all categories.</p>
            <button
              onClick={() => {
                setActiveCategory(null);
                setQuery('');
              }}
              type="button"
            >
              Reset FAQ filters
            </button>
          </div>
        )}
      </section>

      <aside className="faq-guide" aria-label="Getting started guide">
        <span><FaBookOpen aria-hidden="true" /></span>
        <div>
          <strong>Would you rather follow the complete workflow?</strong>
          <p>The illustrated guide walks from creating a collection to reviewing a trade.</p>
        </div>
        <Link to="/getting-started">Open Getting Started</Link>
      </aside>
    </AppPageShell>
  );
};

export default FAQ;
