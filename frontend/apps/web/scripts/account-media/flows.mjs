import { expect } from '@playwright/test';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const top = (page) => page.evaluate(() => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

async function scope(c, groupName, owned, ready) {
  const group = c.page.getByRole('group', { name: groupName, exact: true });
  const target = group.getByRole('button', { name: owned ? /^My Pokémon/ : 'All Pokémon' });
  await c.click(target);
  await ready();
  await expect(target).toHaveClass(/active/);
}

async function tag(c, name) {
  await c.click(c.page.getByText('TAGS', { exact: true }));
  await c.click(c.page.locator(`.tag-item[data-tag="${name}"]`));
  await expect(c.page.locator('.pokemon-card').first()).toBeVisible();
}

export const flows = [
  {
    key: 'raid', label: 'Raid Planner', route: '/raid',
    async run(c) {
      const { page } = c;
      const ranked = () => expect(page.locator('.raid-type-results tbody tr').first()).toBeVisible({ timeout: 120000 });
      await c.open('/raid', 'Raid Planner');
      await scope(c, 'Attacker source', false, ranked);
      await c.shot('raid', 'Best raid attackers — all Pokémon', 'catalog');
      await scope(c, 'Attacker source', true, ranked);
      await expect(page.locator('#raid-roster-details')).not.toContainText('Loading');
      await c.shot('raid-owned', 'My best raid attackers', 'owned');
      await c.click(button(page, 'Boss counters'));
      const counters = async () => {
        await expect(page.getByText('Modeling raid timelines…')).toBeHidden({ timeout: 120000 });
        await expect(page.getByLabel('Raid counters').locator('article').first()).toBeVisible({ timeout: 120000 });
      };
      await counters();
      await c.shot('raid-owned-counters', 'My counters for this raid boss', 'owned');
      await scope(c, 'Attacker source', false, counters);
      await c.shot('raid-counters', 'Best counters — all Pokémon', 'catalog');
    },
  },
  {
    key: 'max', label: 'Max Battles', route: '/max',
    async run(c) {
      const { page } = c;
      const ranked = () => expect(page.locator('.max-ranking-row').first()).toBeVisible({ timeout: 120000 });
      await c.open('/max', 'Max Battles');
      await scope(c, 'Max Pokémon source', false, ranked);
      await c.shot('max', 'Max damage rankings — all Pokémon', 'catalog');
      await scope(c, 'Max Pokémon source', true, ranked);
      await expect(page.locator('#max-roster-details')).not.toContainText('Loading');
      await c.shot('max-owned', 'My best Max attackers', 'owned');
      await c.click(button(page, 'Boss teams'));
      await expect(page.getByLabel('Recommended three-Pokémon party')).toBeVisible({ timeout: 120000 });
      await c.shot('max-owned-party', 'A Max Battle party from my Pokémon', 'owned');
      await scope(c, 'Max Pokémon source', false, async () => {
        await expect(page.getByLabel('Recommended three-Pokémon party')).toBeVisible();
      });
      await c.shot('max-boss-teams', 'Recommended Max party — all Pokémon', 'catalog');
      await c.click(button(page, 'Add one Trainer'));
      await c.shot('max-party', 'Compare the group with another trainer', 'catalog');
    },
  },
  {
    key: 'pvp', label: 'PvP tools', route: '/pvp',
    async run(c) {
      const { page } = c;
      const ranked = () => expect(page.locator('.pvp-ranking-row').first()).toBeVisible({ timeout: 180000 });
      await c.open('/pvp', 'PvP Rankings');
      await c.click(page.getByRole('button', { name: /^Great/ }));
      await scope(c, 'Pokemon source', false, ranked);
      await c.shot('pvp-great', 'Great League rankings — all Pokémon', 'catalog');
      await c.click(page.getByRole('button', { name: /^Master/ }));
      await ranked();
      await c.shot('pvp', 'Master League rankings — all Pokémon', 'catalog');
      c.pause();
      await scope(c, 'Pokemon source', true, ranked);
      await expect(page.locator('.pvp-roster-scope [role="status"]')).toContainText('evaluated locally against', {timeout:180000});
      await c.shot('pvp-owned', 'My Master League Pokémon', 'owned');
      await c.click(button(page, 'Team Builder'));
      const completeTeam = async () => {
        const removals = page.getByRole('button', { name: /^Remove .* from team$/ });
        while (await removals.count()) await removals.first().click();
        for (const role of ['Lead', 'Safe Swap', 'Closer']) {
          await c.click(button(page, `Choose ${role}`));
          await c.click(page.getByRole('button', { name: new RegExp(`^Select ${role} with `) }).first());
        }
        await expect(page.locator('.pvp-team-builder')).toContainText('3 / 3');
        await expect(page.getByText('Testing this team against the current meta field...')).toBeHidden({timeout:180000});
        await top(page);
      };
      await completeTeam();
      await c.shot('pvp-owned-team-builder', 'PvP team builder — my Pokémon', 'owned');
      await page.locator('.pvp-team-analysis').scrollIntoViewIfNeeded();
      await c.shot('pvp-owned-team-results', 'Team matchup results — my Pokémon', 'owned');
      await scope(c, 'Pokemon source', false, async () => expect(page.locator('.pvp-team-builder')).toBeVisible());
      await completeTeam();
      await c.shot('pvp-team-builder', 'PvP team builder — all Pokémon', 'catalog');
      await page.locator('.pvp-team-analysis').scrollIntoViewIfNeeded();
      await c.shot('pvp-team-results', 'Team matchup results — all Pokémon', 'catalog');
      await c.click(button(page, 'Battle Lab'));
      await c.click(button(page, 'Run battle'));
      await expect(button(page, 'Run battle')).toBeEnabled({timeout:120000});
      await c.shot('pvp-battle', 'Battle Lab — compare catalog builds', 'catalog');
      await scope(c, 'Pokemon source', true, async () => expect(button(page, 'Run battle')).toBeEnabled({timeout:120000}));
      await c.click(button(page, 'Run battle'));
      await expect(button(page, 'Run battle')).toBeEnabled({timeout:120000});
      await c.shot('pvp-owned-battle', 'Battle Lab — test my own Pokémon', 'owned');
      await c.click(button(page, 'IV Rank'));
      const source = page.getByRole('group', { name: 'IV Rank Pokémon source' });
      await c.click(source.getByRole('button', { name: 'All Pokémon', exact: true }));
      await page.getByRole('searchbox', { name: 'Search IV Rank Pokémon' }).fill('Crowned Sword Zacian');
      await c.click(page.getByRole('button', { name: /^Select #.*Crowned Sword Zacian/ }).first());
      await page.getByRole('spinbutton', { name: 'Attack IV', exact: true }).fill('15');
      await c.shot('pvp-iv-rank', 'Explore ideal PvP IV spreads', 'catalog');
      await c.click(source.getByRole('button', { name: /^My Pokémon/ }));
      await c.click(page.getByRole('button', { name: /^Check .*, IV / }).first());
      await c.shot('pvp-owned-iv-rank', 'Check the IV rank of my caught Pokémon', 'owned');
    },
  },
  {
    key: 'collection', label: 'Collection', route: '/pokemon',
    async run(c) {
      const { page } = c;
      await c.open('/pokemon');
      await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 120000 });
      await c.shot('catalog', 'Browse the complete Pokémon catalog', 'catalog');
      await tag(c, 'Caught');
      await c.shot('collection', 'My caught Pokémon', 'owned');
      await tag(c, 'Favorites');
      await c.shot('collection-favorites', 'My favorite catches', 'owned');
      await c.click(page.getByRole('button', { name: /^View / }).first());
      await expect(page.locator('.instance-overlay')).toBeVisible();
      await c.shot('instance-overlay', 'Inspect a Pokémon from my collection', 'owned');
      await c.click(button(page, 'Edit'));
      await expect(page.locator('.caught-instance .name-editable-content.editable')).toBeVisible();
      await c.shot('instance-edit', 'Recorded moves, IVs and catch details', 'owned');
    },
  },
  {
    key: 'pokedex', label: 'Pokédex', route: '/pokedex',
    async run(c) {
      const { page } = c;
      await c.open('/pokedex', 'Pokédex');
      await expect(page.locator('.pokedex-region-card').first()).toBeVisible();
      await c.shot('pokedex', 'My registration progress by region', 'owned');
      await c.click(page.locator('.pokedex-region-card').filter({ hasText: 'Kanto' }).first());
      await expect(page.getByPlaceholder('Pokemon or number')).toBeVisible();
      await c.shot('pokedex-region', 'Kanto species and my registrations', 'owned');
      await page.getByPlaceholder('Pokemon or number').fill('Charizard');
      await c.shot('pokedex-search', 'Find a species in my Pokédex', 'owned');
    },
  },
  {
    key: 'rankings', label: 'Community', route: '/rankings',
    async run(c) {
      const { page } = c;
      await c.open('/rankings', 'Community Rankings');
      await expect(page.locator('.community-ranking-row').first()).toBeVisible({ timeout: 120000 });
      await c.shot('rankings', 'What the community wants most', 'catalog');
      await c.click(page.getByRole('button', { name: /^I have/ }));
      await c.shot('rankings-owned', 'Wanted Pokémon I already have', 'owned');
      await c.click(page.getByRole('tab', { name: 'Rarest owned', exact: true }));
      await c.shot('rankings-owned-rarest', 'Rare Pokémon in my collection', 'owned');
      await c.click(page.getByRole('button', { name: /^Missing/ }));
      await c.shot('rankings-missing', 'Rare Pokémon missing from my collection', 'owned');
    },
  },

  {
    key: 'home', label: 'Dashboard', route: '/',
    async run(c) {
      const { page } = c;
      await c.open('/');
      await expect(page.getByRole('heading', { name: new RegExp(`Welcome back, ${c.username}`) })).toBeVisible();
      await c.shot('home', 'My collection and trade dashboard', 'owned');
      await c.click(button(page, 'Action Menu'));
      await expect(page.getByRole('dialog', { name: 'Quick navigation' })).toBeVisible();
      await c.shot('quick-navigation', 'Explore all the trainer tools');
      await c.click(button(page, 'Close'));
      await page.locator('.home-collection-panel').evaluate(element => element.scrollIntoView({ block:'start' }));
      await c.shot('home-dashboard', 'My collection and trade activity at a glance', 'owned');
    },
  },
  {
    key: 'search', label: 'Search & map', route: '/search',
    async run(c) {
      const { page } = c;
      await c.open('/search');
      await c.click(page.getByRole('tab', { name: 'Trainers', exact: true }));
      await c.shot('search', 'Find trainers in the community', 'catalog');
      await page.getByRole('searchbox', { name: 'Trainer name' }).fill(c.username);
      await expect(page.locator('.trainer-result-card').first()).toBeVisible({ timeout: 45000 });
      await c.shot('trainer-search-results', 'My profile in trainer discovery', 'owned');
      await c.click(page.getByRole('tab', { name: 'Pokémon', exact: true }));
      await page.getByPlaceholder('Enter Pokemon name').fill('Pikachu');
      const suggestion = page.getByRole('option', { name: /Pikachu/i }).first();
      if (await suggestion.isVisible()) await c.click(suggestion);
      await expect(page.locator('.selected-pokemon-preview__pokemon:visible').first()).toBeVisible();
      await c.click(button(page, 'Caught'));
      await c.click(page.getByRole('button', { name: /Location/ }));
      await page.getByPlaceholder('Search for a city').fill('Vancouver');
      await c.click(page.getByText('Vancouver, British Columbia, Canada', { exact: true }));
      await c.shot('search-filters', 'Find Pokémon around a city', 'catalog');
      await c.click(button(page, 'Apply and search'));
      await expect(page.locator('.list-view-container')).toBeVisible({ timeout: 45000 });
      await c.shot('search-results-list', 'Live Pokémon listings near Vancouver', 'catalog');
      await c.click(button(page, 'Map view'));
      await expect(page.locator('.ol-viewport')).toBeVisible();
      await page.waitForTimeout(2000);
      await page.locator('.ol-viewport').scrollIntoViewIfNeeded();
      await expect(page.locator('.ol-attribution')).toBeInViewport();
      await c.shot('search-results-map', 'Explore the same listings on the map', 'catalog');
    },
  },
  {
    key: 'trades', label: 'Trades', route: '/trades',
    async run(c) {
      const { page } = c;
      await c.open('/trades', 'Trade Preferences');
      await c.shot('trade-preferences', 'My Pokémon and wanted trade matches', 'owned');
      await c.click(page.getByRole('tab', { name: 'Trade Activity', exact: true }));
      await expect(page.locator('.trade-activity-workspace')).toBeVisible();
      const activity = page.locator('.trade-activity-workspace');
      const active = activity.getByRole('button', { name: /^Active, [1-9]/ });
      if (await active.isVisible()) await c.click(active);
      await c.shot('trade-activity', 'My live trade activity', 'owned');
      const populated = activity.getByRole('button', { name: /^(Active|Completed|Sent|Needs response), [1-9]/ }).first();
      if (await populated.isVisible()) {
        await c.click(populated);
        await c.shot('trade-pending', 'Inspect a trade from my account', 'owned');
      }
    },
  },
  {
    key: 'trade-board', label: 'Trade Board', route: '/trade-board',
    async run(c) {
      const { page } = c;
      await c.open('/trade-board', 'Trade Board');
      await expect(page.getByText('Include on board', { exact: true })).toBeVisible();
      await c.shot('trade-board', 'Build a board from my actual trade listings', 'owned');
      await page.locator('.trade-board-composer__preview').evaluate(element => element.scrollIntoView({ block:'start' }));
      await c.shot('trade-board-preview', 'Preview my trade listings on the board', 'owned');
      await c.openPublic(`/trade-board/${encodeURIComponent(c.username)}`);
      await expect(c.page.getByRole('heading', { name: `@${c.username}’s Trade Board` })).toBeVisible();
      await c.shot('public-trade-board', 'My Trade Board as a visitor sees it', 'public');
      const qr = c.page.locator('.trade-board__qr');
      await qr.evaluate(element => element.scrollIntoView({ block:'center' }));
      await c.shot('trade-board-share', 'The QR code and live public board link', 'public');
    },
  },
  {
    key: 'social', label: 'Trainers & friends', route: '/profile',
    async run(c) {
      const { page } = c;
      await c.open('/profile');
      await expect(page.locator('.trainer-profile-card')).toBeVisible();
      await expect(page.locator('.trainer-profile-card img').first()).toBeVisible();
      await c.shot('trainer-profile', 'My trainer card and featured Pokémon', 'owned');
      await c.open('/profile/friends', 'Friends');
      await c.shot('friends', 'My trainer network', 'owned');
      await c.openPublic(`/profile/${encodeURIComponent(c.username)}`);
      await expect(c.page.locator('.trainer-profile-card')).toBeVisible();
      await expect(c.page.locator('.trainer-profile-card')).not.toContainText('Featured Pokemon', { timeout: 45000 });
      await c.shot('public-profile', 'My trainer profile as a visitor sees it', 'public');
      await c.open(`/pokemon/${encodeURIComponent(c.username)}`);
      await expect(c.page.locator('.pokemon-card').first()).toBeVisible({ timeout: 120000 });
      await c.shot('public-collection', 'My collection as a visitor sees it', 'public');
    },
  },
  {
    key: 'account', label: 'Settings & security', route: '/settings',
    async run(c) {
      const { page } = c;
      await c.open('/settings', 'Settings');
      await c.shot('settings', 'My privacy and trainer preferences', 'account');
      await page.mouse.wheel(0, 450);
      await c.shot('settings-preferences', 'Trade coordination and display preferences', 'account');
      await c.open('/settings/account', 'Account details');
      await c.shot('account', 'Account details and connected sign-in methods', 'account');
      await page.getByRole('heading', { name: 'Sign out', exact: true }).scrollIntoViewIfNeeded();
      await c.shot('account-security', 'Account sessions and security controls', 'account');
    },
  },
  {
    key: 'guide', label: 'Getting started', route: '/', guest: true,
    async run(c) {
      await c.open('/', /^Build your collection\./);
      await c.shot('home-guest', 'Welcome to Pokémon Go Nexus', 'public');
      await c.open('/getting-started', 'Your first useful trade, step by step.');
      await c.shot('getting-started', 'The guide to a first useful trade', 'public');
      await c.open('/faq', 'Frequently asked questions');
      await c.shot('faq', 'Answers to common trainer questions', 'public');
    },
  },
  {
    key: 'references', label: 'Help & reference', route: '/help', guest: true, screenshotsOnly: true,
    async run(c) {
      const routes = [
        ['/help', 'Help & information', 'help', 'Help'],
        ['/about', 'About Pokémon Go Nexus', 'about', 'About Nexus'],
        ['/safety', 'Trade Safety & Community Guidelines', 'safety', 'Trade safety'],
        ['/privacy', 'Privacy Policy', 'privacy', 'Privacy'],
        ['/terms', 'Terms of Service', 'terms', 'Terms'],
        ['/data-deletion', 'User Data Deletion', 'data-deletion', 'Data deletion'],
        ['/raid/methodology', 'How raid rankings work', 'raid-methodology', 'Raid methodology'],
        ['/pvp/methodology', 'How PvP rankings work', 'pvp-methodology', 'PvP methodology'],
        ['/login', '', 'login', 'Sign in'],
        ['/register', 'Create your account', 'register', 'Create an account'],
        ['/reset-password?token=showcase-incomplete-link', 'Choose a new password', 'reset-password', 'Password reset'],
        ['/verify-email-change', 'Email not updated', 'verify-email-change', 'Incomplete email verification link'],
        ['/missing-reference-route', 'That route wandered off.', 'not-found', 'Missing route'],
      ];
      for (const [route, heading, key, label] of routes) {
        await c.open(route, heading);
        await c.shot(key, label, 'public');
      }
    },
  },
];
