import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TradeBoardBuilderPage from '@/pages/TradeBoard/TradeBoardBuilderPage';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isLoggedIn: true,
    user: { username: 'BoardTrainer' },
  },
  instances: {
    instances: { owned: { instance_id: 'owned' } },
    instancesLoading: false,
  },
  variants: {
    variants: [{ variant_id: '0001-default' }],
    variantsLoading: false,
  },
  tags: {
    caught: {
      trade: { instance_id: 'trade', is_for_trade: true },
    } as Record<string, { instance_id: string; is_for_trade: boolean }>,
    wanted: {
      wanted: { instance_id: 'wanted', is_wanted: true },
    } as Record<string, { instance_id: string; is_wanted: boolean }>,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (state: typeof mocks.instances) => unknown) => selector(mocks.instances),
}));

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (state: typeof mocks.variants) => unknown) => selector(mocks.variants),
}));

vi.mock('@/features/tags/utils/initializePokemonTags', () => ({
  initializePokemonTags: () => mocks.tags,
}));

vi.mock('@/features/tradeBoard/components/TradeBoardComposer', () => ({
  default: ({ activeTags, presentation }: {
    activeTags: { trade: Record<string, unknown>; wanted: Record<string, unknown> };
    presentation: string;
  }) => (
    <section aria-label="Board composer">
      {presentation}:{Object.keys(activeTags.trade).length}:{Object.keys(activeTags.wanted).length}
    </section>
  ),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/trade-board']}>
    <Routes>
      <Route path="/trade-board" element={<TradeBoardBuilderPage />} />
      <Route path="/login" element={<h1>Login page</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('TradeBoardBuilderPage', () => {
  beforeEach(() => {
    mocks.auth.isLoading = false;
    mocks.auth.isLoggedIn = true;
    mocks.auth.user = { username: 'BoardTrainer' };
    mocks.instances.instancesLoading = false;
    mocks.variants.variantsLoading = false;
    mocks.tags.caught = { trade: { instance_id: 'trade', is_for_trade: true } };
    mocks.tags.wanted = { wanted: { instance_id: 'wanted', is_wanted: true } };
  });

  it('builds the owner workspace from current trade and wanted listings', () => {
    renderPage();

    expect(screen.getByRole('region', { name: 'Board composer' })).toHaveTextContent('page:1:1');
    expect(screen.getByRole('link', { name: /View live board/ })).toHaveAttribute(
      'href',
      '/trade-board/BoardTrainer',
    );
  });

  it('guides an owner with no listings back to collection management', () => {
    mocks.tags.caught = {};
    mocks.tags.wanted = {};
    renderPage();

    expect(screen.getByRole('heading', { name: 'Your Trade Board needs a listing' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Add Pokémon listings/ })).toHaveAttribute('href', '/pokemon');
  });

  it('redirects signed-out visitors to login after auth has loaded', () => {
    mocks.auth.isLoggedIn = false;
    mocks.auth.user = null as never;
    renderPage();

    expect(screen.getByRole('heading', { name: 'Login page' })).toBeVisible();
  });
});
