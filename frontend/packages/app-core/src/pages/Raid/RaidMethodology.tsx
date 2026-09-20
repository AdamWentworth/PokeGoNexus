import { FaArrowLeft } from "react-icons/fa6";
import { Link } from "react-router";

import AppPageShell from '@/components/layout/AppPageShell';
import InPageNavigation from '@/components/layout/InPageNavigation';
import ProductPageHeader from '@/components/layout/ProductPageHeader';

import "./RaidMethodology.css";

const methodologyNavigation = [
  { href: '#questions', label: 'Ranking modes' },
  { href: '#metrics', label: 'Metrics' },
  { href: '#calculation', label: 'Calculation' },
  { href: '#personalized', label: 'My Pokémon' },
  { href: '#super-mega', label: 'Super Mega' },
  { href: '#limits', label: 'Limits' },
] as const;

const metrics = [
  {
    name: "eDPS",
    description:
      "Raid output after accounting for the time a six-Pokemon team loses to relobbying.",
    use: "Default team-building rank",
  },
  {
    name: "DPS",
    description: "Damage dealt during each active second in battle.",
    use: "Pure speed and large groups",
  },
  {
    name: "TDO",
    description: "Total damage dealt before the attacker faints.",
    use: "Bulk and resource efficiency",
  },
  {
    name: "ER",
    description: "A familiar blend of damage speed and total damage output.",
    use: "Comparing speed with durability",
  },
  {
    name: "CP",
    description: "The in-game Combat Power at the evaluated level.",
    use: "Investment context, not performance",
  },
];

const rankingModes = [
  {
    title: "All types",
    summary: "General raid strength without favoring one matchup.",
    detail:
      "Every legal moveset is measured against the same neutral target. This prevents the current raid rotation or an uneven history of bosses from deciding which coverage type looks strongest.",
  },
  {
    title: "By type",
    summary: "The strongest attackers when one attack type matters.",
    detail:
      "At least one move must match the selected type. Rankings use high-tier bosses weak to that type, while an off-type companion move keeps its real effectiveness instead of receiving a free boost.",
  },
  {
    title: "Boss counters",
    summary: "The fastest answer to one specific raid boss.",
    detail:
      "The simulator uses that boss's form, typing, tier, stats, legal moves, timer, and raid rules. It models action timing, energy, incoming damage, faints, swaps, relobbies, dodging, Party Power, and multi-Trainer teams.",
  },
];

const RaidMethodology = () => {
  return (
    <AppPageShell
      className="raid-methodology-page"
      contentClassName="raid-methodology-shell"
      maxWidth="workspace"
    >
      <ProductPageHeader
        actions={(
          <Link className="product-page-header__action raid-methodology-back" to="/raid">
            <FaArrowLeft aria-hidden="true" />
            <span>Raid rankings</span>
          </Link>
        )}
        className="raid-methodology-product-header"
        description="Pokémon Go Nexus separates general strength, type strength, and exact boss counters so one score is never asked to answer three different questions."
        eyebrow="Raid documentation"
        icon={<img alt="" src="/images/btn_raid.png" />}
        title="How raid rankings work"
      />

      <InPageNavigation
        ariaLabel="Methodology sections"
        className="raid-methodology-nav"
        items={methodologyNavigation}
      />

      <div className="raid-methodology-content">
          <section id="questions" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Three questions</p>
            <h2>Choose the ranking that matches the decision</h2>
            <div className="raid-methodology-mode-list">
              {rankingModes.map((mode, index) => (
                <article key={mode.title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <div>
                    <h3>{mode.title}</h3>
                    <strong>{mode.summary}</strong>
                    <p>{mode.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="metrics" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Visible scores</p>
            <h2>One table, several useful answers</h2>
            <p>
              eDPS is the default because raids are fought with teams, not one
              immortal attacker. Every component remains sortable so speed,
              survival, and investment can be judged separately.
            </p>
            <div className="raid-methodology-metrics">
              {metrics.map((metric) => (
                <article key={metric.name}>
                  <h3>{metric.name}</h3>
                  <p>{metric.description}</p>
                  <span>{metric.use}</span>
                </article>
              ))}
            </div>
            <div className="raid-methodology-formulas" aria-label="Ranking formulas">
              <code tabIndex={0}>ER = DPS^0.75 x TDO^0.25</code>
              <code tabIndex={0}>eDPS = active damage / (active time + relobby time)</code>
            </div>
          </section>

          <section id="calculation" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Calculation pipeline</p>
            <h2>Game data first, ranking second</h2>
            <ol className="raid-methodology-steps">
              <li>
                <strong>Build legal attackers.</strong>
                <span>
                  Exact forms, stats, released move pools, legacy moves,
                  transformations, and Hidden Power types are evaluated
                  independently. Cosmetic Max duplicates are removed.
                </span>
              </li>
              <li>
                <strong>Apply Pokemon GO damage rules.</strong>
                <span>
                  Move power, Attack and Defense, exact damage floors, STAB,
                  both target types, weather, friendship, Mega ally boosts, and
                  Shadow modifiers are included where relevant.
                </span>
              </li>
              <li>
                <strong>Model a complete moveset.</strong>
                <span>
                  Fast and Charged Move duration, energy generation, energy
                  from incoming damage, Charged Move timing, fainting, and
                  wasted energy determine sustained output.
                </span>
              </li>
              <li>
                <strong>Score the right target.</strong>
                <span>
                  All types uses a neutral benchmark, type rankings use
                  relevant high-tier bosses, and Boss Counters runs the exact
                  event-driven matchup.
                </span>
              </li>
            </ol>
            <pre className="raid-methodology-damage-formula" tabIndex={0}>
              <code>damage = floor(0.5 x power x Attack / Defense x multipliers) + 1</code>
            </pre>
          </section>

          <section id="personalized" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Personalized rankings</p>
            <h2>My Pokemon means your actual Pokemon</h2>
            <p>
              Each caught copy stays separate and uses its recorded level, IVs,
              CP, and current moves. Missing level data may be inferred from CP
              and IVs when possible; entries without enough reliable data are
              omitted instead of being silently promoted to level 50.
            </p>
            <p>
              Unlocked Mega, Primal, fusion, and crowned forms can appear as
              comparison entries. Generated teams still enforce playable rules:
              no caught Pokemon can occupy two slots, and a team can include at
              most one Mega Evolution or Primal Reversion.
            </p>
          </section>

          <section id="super-mega" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Super Mega raids</p>
            <h2>Shield phases need real Mega Pokemon</h2>
            <p>
              Super Mega bosses enter an enraged shield phase during the raid.
              Each Trainer can break one shield with a Charged Move from an
              actual Mega-Evolved Pokemon. Primal Reversions do not count as
              shield breakers.
            </p>
            <p>
              Boss Counters models the opening, shielded, and post-shield
              phases separately. It prefers the shield count stored with the
              raid boss, then a curated known count. When neither is available,
              the interface clearly labels its provisional 8-shield value as
              an estimate rather than presenting it as confirmed raid data.
            </p>
            <p>
              Aggregate estimates assume every participating Trainer can bring
              the displayed eligible Mega. Custom raid parties instead check
              each Trainer's six-Pokemon team. Max Battles use different rules
              and are intentionally kept out of these Gym raid rankings.
            </p>
          </section>

          <section id="limits" className="raid-methodology-section">
            <p className="raid-methodology-kicker">Assumptions and guardrails</p>
            <h2>What the model does and does not claim</h2>
            <ul className="raid-methodology-limit-list">
              <li>
                Catalog rankings use perfect IVs at the selected level; My
                Pokemon uses the details recorded for each caught copy.
              </li>
              <li>
                All types and By type are transparent planning models. Boss
                Counters is the event simulation for a difficult exact matchup.
              </li>
              <li>
                eDPS assumes a six-Pokemon team and a configurable relobby delay,
                which defaults to 10 seconds.
              </li>
              <li>
                Boss simulations are bounded for browser performance. Monte
                Carlo results are reproducible distributions, not a promise that
                every real raid will follow the median outcome.
              </li>
              <li>
                Model, catalog, move, and raid-data versions are part of cached
                result keys so changed rules cannot silently reuse stale scores.
              </li>
            </ul>
            <p className="raid-methodology-validation">
              Regression cohorts, exact damage tests, legal-moveset checks,
              sensitivity matrices, independent ranking references, browser
              performance budgets, and event-timeline tests guard the published
              results.
            </p>
          </section>
        </div>

      <footer className="raid-methodology-footer">
        <Link className="raid-methodology-return" to="/raid">
          <FaArrowLeft aria-hidden="true" />
          Return to raid rankings
        </Link>
        <p>
          Pokemon and Pokemon GO are trademarks of their respective owners.
          Pokémon Go Nexus is not affiliated with or endorsed by Niantic, Scopely,
          The Pokemon Company, or Nintendo.
        </p>
      </footer>
    </AppPageShell>
  );
};

export default RaidMethodology;
