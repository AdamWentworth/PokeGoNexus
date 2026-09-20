export type NativeMethodologyItem = {
  detail: string;
  marker?: string;
  summary?: string;
  title: string;
};

export type NativeMethodologyMetric = {
  description: string;
  name: string;
  use: string;
};

export type NativeMethodologyFact = {
  label: string;
  value: string;
};

export type NativeMethodologySection = {
  bullets?: string[];
  callout?: string;
  eyebrow: string;
  facts?: NativeMethodologyFact[];
  formulas?: string[];
  items?: NativeMethodologyItem[];
  metrics?: NativeMethodologyMetric[];
  paragraphs?: string[];
  steps?: NativeMethodologyItem[];
  title: string;
  validation?: string;
};

export type NativeMethodologyPage = {
  description: string;
  eyebrow: string;
  footer: string;
  iconPath: string;
  kind: 'pvp' | 'raid';
  navigation: string[];
  returnLabel: string;
  sections: NativeMethodologySection[];
  title: string;
};

export const raidMethodologyContent: NativeMethodologyPage = {
  kind: 'raid',
  eyebrow: 'RAID DOCUMENTATION',
  title: 'How raid rankings work',
  description: 'Pokémon Go Nexus separates general strength, type strength, and exact boss counters so one score is never asked to answer three different questions.',
  iconPath: '/images/btn_raid.png',
  returnLabel: 'Raid rankings',
  navigation: ['Ranking modes', 'Metrics', 'Calculation', 'My Pokémon', 'Super Mega', 'Limits'],
  sections: [
    {
      eyebrow: 'THREE QUESTIONS',
      title: 'Choose the ranking that matches the decision',
      items: [
        {
          title: 'All types',
          summary: 'General raid strength without favoring one matchup.',
          detail: 'Every legal moveset is measured against the same neutral target. This prevents the current raid rotation or an uneven history of bosses from deciding which coverage type looks strongest.',
        },
        {
          title: 'By type',
          summary: 'The strongest attackers when one attack type matters.',
          detail: 'At least one move must match the selected type. Rankings use high-tier bosses weak to that type, while an off-type companion move keeps its real effectiveness instead of receiving a free boost.',
        },
        {
          title: 'Boss counters',
          summary: 'The fastest answer to one specific raid boss.',
          detail: "The simulator uses that boss's form, typing, tier, stats, legal moves, timer, and raid rules. It models action timing, energy, incoming damage, faints, swaps, relobbies, dodging, Party Power, and multi-Trainer teams.",
        },
      ],
    },
    {
      eyebrow: 'VISIBLE SCORES',
      title: 'One table, several useful answers',
      paragraphs: ['eDPS is the default because raids are fought with teams, not one immortal attacker. Every component remains sortable so speed, survival, and investment can be judged separately.'],
      metrics: [
        { name: 'eDPS', description: 'Raid output after accounting for the time a six-Pokémon team loses to relobbying.', use: 'Default team-building rank' },
        { name: 'DPS', description: 'Damage dealt during each active second in battle.', use: 'Pure speed and large groups' },
        { name: 'TDO', description: 'Total damage dealt before the attacker faints.', use: 'Bulk and resource efficiency' },
        { name: 'ER', description: 'A familiar blend of damage speed and total damage output.', use: 'Comparing speed with durability' },
        { name: 'CP', description: 'The in-game Combat Power at the evaluated level.', use: 'Investment context, not performance' },
      ],
      formulas: ['ER = DPS^0.75 × TDO^0.25', 'eDPS = active damage ÷ (active time + relobby time)'],
    },
    {
      eyebrow: 'CALCULATION PIPELINE',
      title: 'Game data first, ranking second',
      steps: [
        { title: 'Build legal attackers.', detail: 'Exact forms, stats, released move pools, legacy moves, transformations, and Hidden Power types are evaluated independently. Cosmetic Max duplicates are removed.' },
        { title: 'Apply Pokémon GO damage rules.', detail: 'Move power, Attack and Defense, exact damage floors, STAB, both target types, weather, friendship, Mega ally boosts, and Shadow modifiers are included where relevant.' },
        { title: 'Model a complete moveset.', detail: 'Fast and Charged Move duration, energy generation, energy from incoming damage, Charged Move timing, fainting, and wasted energy determine sustained output.' },
        { title: 'Score the right target.', detail: 'All types uses a neutral benchmark, type rankings use relevant high-tier bosses, and Boss Counters runs the exact event-driven matchup.' },
      ],
      formulas: ['damage = floor(0.5 × power × Attack ÷ Defense × multipliers) + 1'],
    },
    {
      eyebrow: 'PERSONALIZED RANKINGS',
      title: 'My Pokémon means your actual Pokémon',
      paragraphs: [
        'Each caught copy stays separate and uses its recorded level, IVs, CP, and current moves. Missing level data may be inferred from CP and IVs when possible; entries without enough reliable data are omitted instead of being silently promoted to level 50.',
        'Unlocked Mega, Primal, fusion, and crowned forms can appear as comparison entries. Generated teams still enforce playable rules: no caught Pokémon can occupy two slots, and a team can include at most one Mega Evolution or Primal Reversion.',
      ],
    },
    {
      eyebrow: 'SUPER MEGA RAIDS',
      title: 'Shield phases need real Mega Pokémon',
      paragraphs: [
        'Super Mega bosses enter an enraged shield phase during the raid. Each Trainer can break one shield with a Charged Move from an actual Mega-Evolved Pokémon. Primal Reversions do not count as shield breakers.',
        'Boss Counters models the opening, shielded, and post-shield phases separately. It prefers the shield count stored with the raid boss, then a curated known count. When neither is available, the interface clearly labels its provisional 8-shield value as an estimate rather than presenting it as confirmed raid data.',
        "Aggregate estimates assume every participating Trainer can bring the displayed eligible Mega. Custom raid parties instead check each Trainer's six-Pokémon team. Max Battles use different rules and are intentionally kept out of these Gym raid rankings.",
      ],
    },
    {
      eyebrow: 'ASSUMPTIONS AND GUARDRAILS',
      title: 'What the model does and does not claim',
      bullets: [
        'Catalog rankings use perfect IVs at the selected level; My Pokémon uses the details recorded for each caught copy.',
        'All types and By type are transparent planning models. Boss Counters is the event simulation for a difficult exact matchup.',
        'eDPS assumes a six-Pokémon team and a configurable relobby delay, which defaults to 10 seconds.',
        'Boss simulations are bounded for mobile performance. Monte Carlo results are reproducible distributions, not a promise that every real raid will follow the median outcome.',
        'Model, catalog, move, and raid-data versions are part of cached result keys so changed rules cannot silently reuse stale scores.',
      ],
      validation: 'Regression cohorts, exact damage tests, legal-moveset checks, sensitivity matrices, independent ranking references, performance budgets, and event-timeline tests guard the published results.',
    },
  ],
  footer: 'Pokémon and Pokémon GO are trademarks of their respective owners. Pokémon Go Nexus is not affiliated with or endorsed by Niantic, Scopely, The Pokémon Company, or Nintendo.',
};

export const pvpMethodologyContent: NativeMethodologyPage = {
  kind: 'pvp',
  eyebrow: 'TRAINER BATTLE DOCUMENTATION',
  title: 'How PvP rankings work',
  description: 'Pokémon Go Nexus keeps published rankings, caught-build context, team coverage, and direct battle simulation separate so each answer says exactly what it measures.',
  iconPath: '/images/btn_pvp.png',
  returnLabel: 'PvP tools',
  navigation: ['Four tools', 'Rankings', 'IV Rank', 'My Pokémon', 'Cups', 'Battle Lab', 'Limits'],
  sections: [
    {
      eyebrow: 'CHOOSE THE RIGHT QUESTION',
      title: 'One workspace, four different jobs',
      items: [
        { title: 'Rankings', marker: '⬟', summary: 'A source-backed snapshot of the current competitive field.', detail: 'Overall and role scores, recommended builds, matchup evidence, and counters come from the pinned PvPoke source snapshot for the selected league or cup.' },
        { title: 'IV Rank', marker: '▦', summary: 'A same-species comparison of every appraisal spread.', detail: 'IV Rank powers all 4,096 Attack, Defense, and HP combinations to their highest legal half-level, then orders them by battle-stat product for the selected league.' },
        { title: 'Team Builder', marker: '♟', summary: 'Three assigned roles tested against one current field.', detail: 'The builder tests Lead, Safe Swap, and Closer under role-specific shield and energy conditions, then pairs those local results with published matchup evidence and actionable coverage swaps.' },
        { title: 'Battle Lab', marker: '⚗', summary: 'Deterministic focused and switch-aware team simulations.', detail: 'The lab runs selected builds through local 1v1 or 3v3 simulation with configurable shields and energy. Team Battle can model legal adaptive swaps and test a lineup against representative field teams.' },
      ],
    },
    {
      eyebrow: 'PUBLISHED RANKINGS',
      title: 'A pinned simulation snapshot',
      paragraphs: ["League and cup rankings are imported from a pinned, attributable PvPoke source snapshot. Pokémon Go Nexus maps released forms to its own catalog and presents the source's recommended level, IVs, moves, overall score, role scores, matchups, and counters."],
      steps: [
        { title: 'Pick a legal format.', detail: 'Great, Ultra, and Master League remain permanent choices. Visible source cups are imported as independent ranking snapshots with their own eligibility rules.' },
        { title: 'Choose the decision role.', detail: "Overall, Lead, Closer, Switch, Charger, Attacker, and Consistency expose the source's separate category scores instead of pretending one order answers every team need." },
        { title: 'Inspect the evidence.', detail: 'Expanded rows show the recommended battle stats, role profile, strong matchups, key threats, and simulated move usage available in that source snapshot.' },
      ],
    },
    {
      eyebrow: 'APPRAISAL COMPARISON',
      title: 'Every IV spread at its legal ceiling',
      paragraphs: [
        "IV Rank compares all 4,096 possible 0–15 Attack, Defense, and HP appraisal combinations for one species or battle-stat form. Each spread is powered to the highest legal half-level under the selected league's CP cap, up to level 50 or Best Buddy level 51.",
        "My Pokémon omits copies already above the selected league's CP cap, then recommends eligible copies using both current league relevance and species-specific IV quality. The browser weighs the format simulation score at 70% and the copy's IV percentile at 30%, while showing both source ranks beside every recommendation.",
      ],
      steps: [
        { title: 'Calculate the legal level and CP.', detail: 'Great and Ultra League stop at 1,500 and 2,500 CP. Master League has no CP cap, so perfect IVs lead at the selected level ceiling.' },
        { title: 'Measure the battle stats.', detail: "The model calculates the resulting Attack, Defense, and floored HP at that level, then multiplies those three values into the spread's stat product." },
        { title: 'Rank like against like.', detail: "Results are ordered by stat product within that species and form. The percentile describes bulk-efficient CP use, not a Pokémon's matchup strength against other species." },
      ],
    },
    {
      eyebrow: 'PERSONAL ROSTER',
      title: 'My Pokémon keeps the build honest',
      paragraphs: [
        'Each eligible caught copy uses its recorded CP, level, IVs, Fast Move, and one or two recorded Charged Moves. The page does not silently promote a caught Pokémon to the catalog’s recommended level or IV spread.',
        "Each result starts from the published species score, then measures the caught build and its reference build against the same field with the standard Lead, Closer, Switch, Charger, and Attacker shield and energy scenarios. Their relative performance adjusts the published score for the caught Pokémon's actual level, IVs, stats, and moves without inventing a new global tier list.",
        "Move decisions include STAB and the opponent's type effectiveness. When a caught Pokémon has two Charged Moves, each matchup retains the strongest legal strategy available from those moves, so unlocking an additional move can improve or preserve a result but never penalize it.",
        'Entries over the format’s CP cap, missing required battle details, or unavailable in the selected ranking snapshot are reported and omitted rather than guessed. Completed evaluations are cached on the device by model, format, field, and roster.',
      ],
      callout: 'Rankings evaluates each recorded build in a device worker against a fixed field of up to 12 top, battle-ready opponents from the selected format. The Pokémon service delivers versioned catalog data; it does not perform this personal roster work.',
    },
    {
      eyebrow: 'CURRENT CUPS',
      title: 'Separate formats, not client-side filters',
      paragraphs: ['A cup is included only when the pinned source marks it visible and rankable and provides ranking data. Its list, scores, builds, matchups, and rules are imported independently; an Open League table is never merely filtered down and relabeled as a cup.'],
    },
    {
      eyebrow: 'LOCAL SIMULATION',
      title: 'Focused matchups and switch-aware 3v3 battles',
      paragraphs: [
        'Open leagues and ordinary cups use the June 2026 rules in the same device worker as My Pokémon rankings. Damage and energy resolve together at the end of a turn, one-turn Fast Attacks can tie, triggered Charged Attacks start on the following turn, and voluntary swaps cost one turn.',
        "The simulator models move turns, damage, energy, shields, Charged Move decisions, stat stages, and deterministic buff activation. Team Battle carries shared shields and each survivor's HP and energy, resets temporary stat changes when a Pokémon leaves battle, and enforces the 45-second switch clock.",
      ],
      facts: [
        { value: '0–2', label: 'Shields per side' },
        { value: '0–100', label: 'Starting energy' },
        { value: '45s', label: 'Switch clock' },
        { value: '1v1 / 3v3', label: 'Focused or team battle' },
      ],
    },
    {
      eyebrow: 'LIMITS AND GUARDRAILS',
      title: 'What these tools do not claim',
      bullets: [
        'A ranking score summarizes a defined competitive field; it does not predict every opponent, team order, or player choice.',
        'Team Builder tests each assigned role against the current local meta field and supplements it with published matchup evidence.',
        "Adaptive switching is a deterministic matchup heuristic evaluated at legal decision windows. It does not predict a human player's bait reads, timing mistakes, latency, or every possible future decision tree.",
        'The meta gauntlet builds repeatable Lead, Safe Swap, and Closer test fixtures; it is not a measured usage report.',
        'Rankings and current cups change only when the pinned source and Pokémon Go Nexus catalog are refreshed and republished.',
        "IV Rank measures stat product. Breakpoints, specific matchups, Best Buddy availability, and team composition can make a lower-ranked spread preferable in practice.",
        'Only catalog forms that Pokémon Go Nexus can identify and display are published. Unmatched or unreleased entries are omitted.',
      ],
      validation: 'Import validation, source-format tests, catalog matching tests, local battle fixtures, data-only API boundary tests, and responsive device checks guard this workflow.',
    },
  ],
  footer: 'Ranking data is attributed to PvPoke under its published license. IV Rank follows the established same-species stat-product model. Pokémon and Pokémon GO are trademarks of their respective owners.',
};
