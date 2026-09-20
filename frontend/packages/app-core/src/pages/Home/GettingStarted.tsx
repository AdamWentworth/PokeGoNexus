import type { IconType } from 'react-icons';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaExchangeAlt,
  FaHeart,
  FaSearch,
  FaShareAlt,
  FaTags,
} from 'react-icons/fa';
import { Link } from 'react-router';

import PokemonArtwork from '@/components/pokemonComponents/PokemonArtwork';
import { useAuth } from '@/contexts/AuthContext';

import './Home.css';
import './GettingStarted.css';

interface StoryPokemon {
  gigantamax?: boolean;
  imageUrl: string;
}

interface GuideStep {
  id: string;
  number: string;
  title: string;
  summary: string;
  details: string[];
  action: string;
  to: string;
  icon: IconType;
  images: StoryPokemon[];
  visualLabel: string;
  tone: 'caught' | 'wanted' | 'trade' | 'search' | 'proposal' | 'share';
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'collection',
    number: '01',
    title: 'Start your collection',
    summary: 'Add a Pokémon you own before worrying about the rest of the system.',
    details: [
      'Search for the species and exact variant.',
      'Save it as Caught and add details only if they matter to you.',
      'Use Favorites or custom tags to keep large collections manageable.',
    ],
    action: 'Open Pokémon',
    to: '/pokemon',
    icon: FaTags,
    images: [{ imageUrl: '/images/shiny_gigantamax/shiny_gigantamax_6.png', gigantamax: true }],
    visualLabel: 'Shiny Gigantamax Charizard',
    tone: 'caught',
  },
  {
    id: 'wanted',
    number: '02',
    title: 'Create a Wanted entry',
    summary: 'Wanted Pokémon are wishlist records, not missing caught instances.',
    details: [
      'Choose Wanted when adding the Pokémon.',
      'Mark it Most Wanted when it deserves extra priority.',
      'Set friendship, lucky, size, gender, or move conditions only when required.',
    ],
    action: 'Build your wishlist',
    to: '/pokemon?filter=wanted',
    icon: FaHeart,
    images: [{ imageUrl: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }],
    visualLabel: 'Shiny Detective Pikachu',
    tone: 'wanted',
  },
  {
    id: 'for-trade',
    number: '03',
    title: 'List something For Trade',
    summary: 'A For Trade listing remains part of your caught collection until a trade completes.',
    details: [
      'Choose a caught Pokémon that is eligible to trade.',
      'Favorites and Lucky Pokémon remain protected from being listed.',
      'Use Trade Preferences to choose what you would accept in return.',
    ],
    action: 'Open trade preferences',
    to: '/trades?section=preferences',
    icon: FaExchangeAlt,
    images: [{ imageUrl: '/images/shiny_gigantamax/shiny_gigantamax_6.png', gigantamax: true }],
    visualLabel: 'Your Shiny Gigantamax Charizard',
    tone: 'trade',
  },
  {
    id: 'discovery',
    number: '04',
    title: 'Find a trainer or listing',
    summary: 'Search can be broad or exact; add only the filters that improve the result.',
    details: [
      'Search Pokémon by ownership, variant, location, and trade details.',
      'Search trainers by either Nexus username or Pokémon GO name.',
      'Open a listing to review the trainer’s actual public catalog context.',
    ],
    action: 'Explore search',
    to: '/search',
    icon: FaSearch,
    images: [{ imageUrl: '/images/costumes_shiny/pokemon_25_detective_shiny.png' }],
    visualLabel: 'Find a trainer offering this Pikachu',
    tone: 'search',
  },
  {
    id: 'proposal',
    number: '05',
    title: 'Propose and coordinate',
    summary: 'Review the exact exchange, then coordinate an accepted trade outside the app.',
    details: [
      'Your Pokémon always appears on the left and theirs on the right.',
      'Set the friendship level and review remote, Lucky, special-trade, and Stardust information.',
      'The users service validates both participants and Pokémon before accepting the proposal.',
      'After acceptance, use the opted-in Trainer Code and Campfire, Discord, or another agreed service to arrange the in-game trade.',
    ],
    action: 'View trade activity',
    to: '/trades?section=activity',
    icon: FaCheck,
    images: [
      { imageUrl: '/images/shiny_gigantamax/shiny_gigantamax_6.png', gigantamax: true },
      { imageUrl: '/images/costumes_shiny/pokemon_25_detective_shiny.png' },
    ],
    visualLabel: 'Charizard ↔ Detective Pikachu',
    tone: 'proposal',
  },
  {
    id: 'sharing',
    number: '06',
    title: 'Share beyond Pokémon Go Nexus',
    summary: 'Meet trainers where they already are without rebuilding your trade list by hand.',
    details: [
      'Generate a polished image containing your offers and wishlist.',
      'Publish a live Trade Board that stays connected to your listings.',
      'Keep private collection and profile details out of the public board.',
    ],
    action: 'Create a Trade Board',
    to: '/trade-board',
    icon: FaShareAlt,
    images: [
      { imageUrl: '/images/shiny_gigantamax/shiny_gigantamax_6.png', gigantamax: true },
      { imageUrl: '/images/costumes_shiny/pokemon_25_detective_shiny.png' },
    ],
    visualLabel: 'One board, both listings',
    tone: 'share',
  },
];

interface GettingStartedContentProps {
  isLoggedIn: boolean;
}

const GettingStartedContent = ({ isLoggedIn }: GettingStartedContentProps) => (
  <div className="home-page getting-started">
    <header className="getting-started__topbar home-shell">
      <Link className="home-brand" to="/" aria-label="Pokémon Go Nexus home">
        <img src="/images/logo/logo.png" alt="" />
        <span>Pokémon Go Nexus</span>
      </Link>
      <div>
        <Link className="getting-started__back" to="/"><FaArrowLeft aria-hidden="true" /> Home</Link>
        <Link className="home-primary-action" to={isLoggedIn ? '/pokemon' : '/register'}>
          {isLoggedIn ? 'Open collection' : 'Create account'}
        </Link>
      </div>
    </header>

    <div className="getting-started__layout home-shell">
      <aside className="getting-started__index" aria-label="Getting started sections">
        <span className="home-eyebrow">On this page</span>
        <nav>
          {GUIDE_STEPS.map((step) => (
            <a key={step.id} href={`#${step.id}`}><span>{step.number}</span>{step.title}</a>
          ))}
        </nav>
      </aside>

      <div className="getting-started__content">
        <section className="getting-started__hero" aria-labelledby="getting-started-title">
          <span className="home-eyebrow">Pokémon Go Nexus guide</span>
          <h1 id="getting-started-title">Your first useful trade, step by step.</h1>
          <p>
            This guide follows the same order you will use in the app. Read it straight through,
            or jump directly to the part of the workflow you need.
          </p>
          <p className="getting-started__story-note"><strong>Running example:</strong> offer a Shiny Gigantamax Charizard for a Shiny Detective Pikachu.</p>
          <div className="getting-started__legend">
            <span><i className="is-caught" aria-hidden="true"><PokemonArtwork alt="" className="getting-started__legend-artwork" gigantamax imageUrl="/images/shiny_gigantamax/shiny_gigantamax_6.png" /><FaCheck /></i><strong>Caught</strong> You own it</span>
            <span><i className="is-trade" aria-hidden="true"><PokemonArtwork alt="" className="getting-started__legend-artwork" gigantamax imageUrl="/images/shiny_gigantamax/shiny_gigantamax_6.png" /><FaExchangeAlt /></i><strong>For Trade</strong> You offer it</span>
            <span><i className="is-wanted" aria-hidden="true"><PokemonArtwork alt="" className="getting-started__legend-artwork" imageUrl="/images/costumes_shiny/pokemon_25_detective_shiny.png" /><FaHeart /></i><strong>Wanted</strong> You seek it</span>
          </div>
        </section>

        <section className="getting-started__steps" aria-label="Getting started walkthrough">
          {GUIDE_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article id={step.id} key={step.id} className={`getting-started__step is-${step.tone}`}>
                <div className={`getting-started__step-visual ${step.images.length > 1 ? 'has-pair' : ''}`} aria-hidden="true">
                  <span>{step.number}</span>
                  <Icon />
                  <div className="getting-started__story-pokemon">
                    {step.images.map((image, index) => (
                      <PokemonArtwork
                        key={`${image.imageUrl}-${index}`}
                        alt=""
                        className="getting-started__story-artwork"
                        gigantamax={image.gigantamax}
                        imageUrl={image.imageUrl}
                      />
                    ))}
                  </div>
                  <small>{step.visualLabel}</small>
                </div>
                <div className="getting-started__step-copy">
                  <span className="home-eyebrow">Step {step.number}</span>
                  <h2>{step.title}</h2>
                  <p>{step.summary}</p>
                  <ul>
                    {step.details.map((detail) => <li key={detail}><FaCheck aria-hidden="true" />{detail}</li>)}
                  </ul>
                  <Link to={step.to}>{step.action} <FaArrowRight aria-hidden="true" /></Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="getting-started__finish" aria-labelledby="getting-started-finish-title">
          <img src="/images/logo/logo.png" alt="" />
          <div>
            <span className="home-eyebrow">You do not need a complete catalog</span>
            <h2 id="getting-started-finish-title">Start small. Let the workflow grow with you.</h2>
            <p>Add one Pokémon today. Your signed-in Home will show the next useful milestone without forcing you through a tour.</p>
          </div>
          <Link className="home-primary-action" to={isLoggedIn ? '/pokemon' : '/register'}>
            {isLoggedIn ? 'Open Pokémon' : 'Start your collection'} <FaArrowRight aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  </div>
);

const GettingStarted = () => {
  const { isLoggedIn } = useAuth() ?? {};

  return <GettingStartedContent isLoggedIn={Boolean(isLoggedIn)} />;
};

export default GettingStarted;
