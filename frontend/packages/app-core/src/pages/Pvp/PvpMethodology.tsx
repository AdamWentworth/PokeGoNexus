import {
  FaArrowLeft,
  FaBolt,
  FaCalculator,
  FaFlask,
  FaShieldAlt,
  FaUsers,
} from 'react-icons/fa';
import { Link } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import InPageNavigation from '@/components/layout/InPageNavigation';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import './PvpMethodology.css';

const methodologyNavigation = [
  { href: '#tools', label: 'Four tools' },
  { href: '#rankings', label: 'Rankings' },
  { href: '#iv-rank', label: 'IV Rank' },
  { href: '#owned', label: 'My Pokémon' },
  { href: '#cups', label: 'Cups' },
  { href: '#battle-lab', label: 'Battle Lab' },
  { href: '#limits', label: 'Limits' },
] as const;

const rankingViews = [
  {
    title: 'Rankings',
    summary: 'A source-backed snapshot of the current competitive field.',
    detail:
      'Overall and role scores, recommended builds, matchup evidence, and counters come from the pinned PvPoke source snapshot for the selected league or cup.',
    icon: FaShieldAlt,
  },
  {
    title: 'IV Rank',
    summary: 'A same-species comparison of every appraisal spread.',
    detail:
      'IV Rank powers all 4,096 Attack, Defense, and HP combinations to their highest legal half-level, then orders them by battle-stat product for the selected league.',
    icon: FaCalculator,
  },
  {
    title: 'Team Builder',
    summary: 'Three assigned roles tested against one current field.',
    detail:
      'The builder tests Lead, Safe Swap, and Closer under role-specific shield and energy conditions, then pairs those local results with published matchup evidence and actionable coverage swaps.',
    icon: FaUsers,
  },
  {
    title: 'Battle Lab',
    summary: 'Deterministic focused and switch-aware team simulations.',
    detail:
      'The lab runs selected builds through local 1v1 or 3v3 simulation with configurable shields and energy. Team Battle can model legal adaptive swaps and test a lineup against representative field teams.',
    icon: FaFlask,
  },
];

const PvpMethodology = () => {
  return (
    <AppPageShell
      className="pvp-methodology-page"
      contentClassName="pvp-methodology-shell"
      maxWidth="workspace"
    >
      <ProductPageHeader
        actions={(
          <Link className="product-page-header__action pvp-methodology-back" to="/pvp">
            <FaArrowLeft aria-hidden="true" />
            <span>PvP tools</span>
          </Link>
        )}
        className="pvp-methodology-product-header"
        description="Pokémon Go Nexus keeps published rankings, caught-build context, team coverage, and direct battle simulation separate so each answer says exactly what it measures."
        eyebrow="Trainer Battle documentation"
        icon={<img alt="" draggable={false} src="/images/btn_pvp.png" />}
        title="How PvP rankings work"
      />

      <InPageNavigation
        ariaLabel="Methodology sections"
        className="pvp-methodology-nav"
        items={methodologyNavigation}
      />

      <div className="pvp-methodology-content">
          <section id="tools" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Choose the right question</p>
            <h2>One workspace, four different jobs</h2>
            <div className="pvp-methodology-tool-list">
              {rankingViews.map(({ title, summary, detail, icon: Icon }) => (
                <article key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <strong>{summary}</strong>
                    <p>{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="rankings" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Published rankings</p>
            <h2>A pinned simulation snapshot</h2>
            <p>
              League and cup rankings are imported from a pinned, attributable
              PvPoke source snapshot. Pokémon Go Nexus maps released forms to its
              own catalog and presents the source&apos;s recommended level, IVs,
              moves, overall score, role scores, matchups, and counters.
            </p>
            <ol className="pvp-methodology-steps">
              <li>
                <strong>Pick a legal format.</strong>
                <span>
                  Great, Ultra, and Master League remain permanent choices.
                  Visible source cups are imported as independent ranking
                  snapshots with their own eligibility rules.
                </span>
              </li>
              <li>
                <strong>Choose the decision role.</strong>
                <span>
                  Overall, Lead, Closer, Switch, Charger, Attacker, and
                  Consistency expose the source&apos;s separate category scores
                  instead of pretending one order answers every team need.
                </span>
              </li>
              <li>
                <strong>Inspect the evidence.</strong>
                <span>
                  Expanded rows show the recommended battle stats, role
                  profile, strong matchups, key threats, and simulated move
                  usage available in that source snapshot.
                </span>
              </li>
            </ol>
          </section>

          <section id="iv-rank" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Appraisal comparison</p>
            <h2>Every IV spread at its legal ceiling</h2>
            <p>
              IV Rank compares all 4,096 possible 0-15 Attack, Defense, and HP
              appraisal combinations for one species or battle-stat form. Each
              spread is powered to the highest legal half-level under the
              selected league&apos;s CP cap, up to level 50 or Best Buddy level
              51.
            </p>
            <p>
              My Pokémon omits copies already above the selected league&apos;s CP
              cap, then recommends eligible copies using both current league
              relevance and species-specific IV quality. The browser weighs the
              format simulation score at 70% and the copy&apos;s IV percentile at
              30%, while showing both source ranks beside every recommendation.
            </p>
            <ol className="pvp-methodology-steps">
              <li>
                <strong>Calculate the legal level and CP.</strong>
                <span>
                  Great and Ultra League stop at 1,500 and 2,500 CP. Master
                  League has no CP cap, so perfect IVs lead at the selected
                  level ceiling.
                </span>
              </li>
              <li>
                <strong>Measure the battle stats.</strong>
                <span>
                  The model calculates the resulting Attack, Defense, and
                  floored HP at that level, then multiplies those three values
                  into the spread&apos;s stat product.
                </span>
              </li>
              <li>
                <strong>Rank like against like.</strong>
                <span>
                  Results are ordered by stat product within that species and
                  form. The percentile describes bulk-efficient CP use, not a
                  Pokémon&apos;s matchup strength against other species.
                </span>
              </li>
            </ol>
          </section>

          <section id="owned" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Personal roster</p>
            <h2>My Pokémon keeps the build honest</h2>
            <p>
              Each eligible caught copy uses its recorded CP, level, IVs, Fast
              Move, and one or two recorded Charged Moves. The page does not
              silently promote a caught Pokémon to the catalog&apos;s recommended
              level or IV spread.
            </p>
            <div className="pvp-methodology-callout">
              <FaBolt aria-hidden="true" />
              <p>
                Rankings evaluates each recorded build in a browser worker
                against a fixed field of up to 12 top, battle-ready opponents
                from the selected format. The Pokémon service delivers
                versioned catalog data; it does not perform this personal
                roster work.
              </p>
            </div>
            <p>
              Each result starts from the published species score, then
              measures the caught build and its reference build against the
              same field with the standard Lead, Closer, Switch, Charger, and
              Attacker shield and energy scenarios. Their relative performance
              adjusts the published score for the caught Pokémon&apos;s actual
              level, IVs, stats, and moves without inventing a new global tier
              list.
            </p>
            <p>
              Move decisions include STAB and the opponent&apos;s type
              effectiveness. When a caught Pokémon has two Charged Moves, each
              matchup retains the strongest legal strategy available from
              those moves, so unlocking an additional move can improve or
              preserve a result but never penalize it.
            </p>
            <p>
              Entries over the format&apos;s CP cap, missing required battle
              details, or unavailable in the selected ranking snapshot are
              reported and omitted rather than guessed. If personal evaluation
              is unavailable, the page labels its temporary species baseline
              instead of presenting it as a build result. Completed evaluations
              are cached on the device by model, format, field, and roster.
            </p>
          </section>

          <section id="cups" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Current cups</p>
            <h2>Separate formats, not client-side filters</h2>
            <p>
              A cup is included only when the pinned source marks it visible
              and rankable and provides ranking data. Its list, scores, builds,
              matchups, and rules are imported independently; an Open League
              table is never merely filtered down and relabeled as a cup.
            </p>
          </section>

          <section id="battle-lab" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Local simulation</p>
            <h2>Focused matchups and switch-aware 3v3 battles</h2>
            <p>
              Open leagues and ordinary cups use the June 2026 rules in the
              same browser worker as My Pokémon rankings. Damage and energy
              resolve together at the end of a turn, one-turn Fast Attacks can
              tie, triggered Charged Attacks start on the following turn, and
              voluntary swaps cost one turn. Competitors Cup remains an explicit
              championship-rules exception through its announced transition
              window.
            </p>
            <p>
              The simulator models move turns, damage, energy, shields, Charged
              Move decisions, stat stages, and deterministic buff activation.
              Team Battle carries shared shields and each survivor&apos;s HP and
              energy, resets temporary stat changes when a Pokémon leaves battle,
              and enforces the 45-second switch clock. Adaptive mode can leave a
              clearly losing matchup and counter-switch when legal; fixed order
              remains available as a comparison. The Pokémon service only supplies
              the versioned data used to build the fighters.
            </p>
            <div className="pvp-methodology-facts" aria-label="Battle Lab inputs">
              <span>
                <strong>0-2</strong>
                Shields per side
              </span>
              <span>
                <strong>0-100</strong>
                Starting energy
              </span>
              <span>
                <strong>45s</strong>
                Switch clock
              </span>
              <span>
                <strong>1v1 / 3v3</strong>
                Focused or team battle
              </span>
            </div>
          </section>

          <section id="limits" className="pvp-methodology-section">
            <p className="pvp-methodology-kicker">Limits and guardrails</p>
            <h2>What these tools do not claim</h2>
            <ul className="pvp-methodology-limit-list">
              <li>
                A ranking score summarizes a defined competitive field; it
                does not predict every opponent, team order, or player choice.
              </li>
              <li>
                Team Builder tests each assigned role against the current local
                meta field and supplements it with published matchup evidence.
                A complete team can be handed directly to Team Battle for an
                adaptive or fixed-order three-Pokémon result.
              </li>
              <li>
                Adaptive switching is a deterministic matchup heuristic evaluated
                at legal decision windows. It does not predict a human player&apos;s
                bait reads, timing mistakes, latency, or every possible future
                decision tree.
              </li>
              <li>
                The meta gauntlet builds representative Lead, Safe Swap, and Closer
                combinations from the current ranking snapshot. They are useful
                repeatable test fixtures, not claimed historical player teams or a
                measured usage report.
              </li>
              <li>
                Rankings and current cups change only when the pinned source
                and Pokémon Go Nexus catalog are refreshed and republished.
              </li>
              <li>
                IV Rank measures stat product. Breakpoints, specific matchups,
                Best Buddy availability, and team composition can make a
                lower-ranked spread preferable in practice.
              </li>
              <li>
                Only catalog forms that Pokémon Go Nexus can identify and display
                are published. Unmatched or unreleased entries are omitted.
              </li>
            </ul>
            <p className="pvp-methodology-validation">
              Import validation, source-format tests, catalog matching tests,
              local battle fixtures, data-only API boundary tests, and responsive
              browser checks guard this workflow.
            </p>
          </section>
        </div>

      <footer className="pvp-methodology-footer">
        <Link className="pvp-methodology-return" to="/pvp">
          <FaArrowLeft aria-hidden="true" />
          Return to PvP tools
        </Link>
        <p>
          Ranking data is attributed to PvPoke under its published license.
          IV Rank follows the established same-species stat-product model
          used by tools such as Stadium Gaming. Local timing follows the
          official{' '}
          <a
            href="https://pokemongo.com/news/pvp-updates2026?hl=en"
            target="_blank"
            rel="noreferrer"
          >
            June 2026 Trainer Battle update
          </a>
          , including the published{' '}
          <a
            href="https://pokemongo.com/en/news/pvp-updates-competitors-cup-2026"
            target="_blank"
            rel="noreferrer"
          >
            Competitors Cup transition
          </a>
          .{' '}
          Pokémon and Pokémon GO are trademarks of their respective owners.
        </p>
      </footer>
    </AppPageShell>
  );
};

export default PvpMethodology;
