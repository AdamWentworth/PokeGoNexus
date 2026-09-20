import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHooks = vi.hoisted(() => ({
  variants: vi.fn(),
  instances: vi.fn(),
  tags: vi.fn(),
  trades: vi.fn(),
  location: vi.fn(),
}));

vi.mock('@/features/variants/hooks/useBootstrapVariants', () => ({
  useBootstrapVariants: mockHooks.variants,
}));

vi.mock('@/features/instances/hooks/useBootstrapInstances', () => ({
  useBootstrapInstances: mockHooks.instances,
}));

vi.mock('@/features/tags/hooks/useBootstrapTags', () => ({
  useBootstrapTags: mockHooks.tags,
}));

vi.mock('@/features/trades/hooks/useBootstrapTrades', () => ({
  useBootstrapTrades: mockHooks.trades,
}));

vi.mock('@/features/location/hooks/useInitLocation', () => ({
  useInitLocation: mockHooks.location,
}));

import AppBootstrap from '@/AppBootstrap';
import { useAuthStore } from '@/stores/useAuthStore';

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppBootstrap />
    </MemoryRouter>,
  );
}

describe('AppBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isLoggedIn: false, user: null });
    localStorage.clear();
    delete document.documentElement.dataset.reducedMotion;
  });

  it('disables heavy bootstrap on auth routes', () => {
    renderAt('/login');

    expect(mockHooks.variants).toHaveBeenCalledWith(false);
    expect(mockHooks.instances).toHaveBeenCalledWith(false);
    expect(mockHooks.tags).toHaveBeenCalledWith(false);
    expect(mockHooks.trades).toHaveBeenCalledWith(false);
    expect(mockHooks.location).toHaveBeenCalledWith(false);
  });

  it('keeps authenticated trade hydration disabled for a signed-out public route', () => {
    renderAt('/pokemon');

    expect(mockHooks.variants).toHaveBeenCalledWith(true);
    expect(mockHooks.instances).toHaveBeenCalledWith(true);
    expect(mockHooks.tags).toHaveBeenCalledWith(true);
    expect(mockHooks.trades).toHaveBeenCalledWith(false);
    expect(mockHooks.location).toHaveBeenCalledWith(true);
  });

  it('enables trade hydration for a signed-in non-auth route', () => {
    useAuthStore.setState({ isLoggedIn: true });

    renderAt('/pokemon');

    expect(mockHooks.trades).toHaveBeenCalledWith(true);
  });

  it.each(['/max', '/pvp'])(
    'defers the full application bootstrap on the focused data route %s',
    (pathname) => {
      renderAt(pathname);

      expect(mockHooks.variants).toHaveBeenCalledWith(false);
      expect(mockHooks.instances).toHaveBeenCalledWith(false);
      expect(mockHooks.tags).toHaveBeenCalledWith(false);
      expect(mockHooks.trades).toHaveBeenCalledWith(false);
      expect(mockHooks.location).toHaveBeenCalledWith(false);
    },
  );

  it('restores the device motion preference during application bootstrap', () => {
    localStorage.setItem('pokegonexus-reduced-motion', 'true');

    renderAt('/');

    expect(document.documentElement.dataset.reducedMotion).toBe('true');
  });
});
