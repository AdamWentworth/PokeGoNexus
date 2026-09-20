import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Settings from '@/pages/Trainer/Settings';

const render = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const mocks = vi.hoisted(() => ({
  fetchPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock('@/services/socialService', () => ({
  fetchTrainerPreferences: mocks.fetchPreferences,
  updateTrainerPreferences: mocks.updatePreferences,
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { user: { user_id: string; username: string } }) => unknown,
  ) => selector({ user: { user_id: 'user-adam', username: 'Adam' } }),
}));

vi.mock('@/components/ThemeSwitch', () => ({
  default: () => <button type="button">Theme switch</button>,
}));

const preferences = {
  user_id: 'user-adam',
  profile_visibility: 'public',
  collection_visibility: 'public',
  friend_request_permission: 'everyone',
  trainer_code_visibility: 'friends',
  coordination_method: 'campfire',
  coordination_handle: null,
  share_trade_contact: true,
  show_location: false,
  show_pokemon_go_name: true,
} as const;

describe('Trainer Settings', () => {
  beforeEach(() => {
    mocks.fetchPreferences.mockReset();
    mocks.updatePreferences.mockReset();
    mocks.fetchPreferences.mockResolvedValue(preferences);
    mocks.updatePreferences.mockImplementation(async (request) => ({
      ...preferences,
      ...request,
    }));
  });

  it('saves server-backed privacy controls independently from device settings', async () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/profile visibility/i), {
      target: { value: 'friends' },
    });
    await expect(container).toHaveNoViolations();
    fireEvent.click(screen.getByLabelText(/show profile location/i));
    fireEvent.click(screen.getByRole('button', { name: /save privacy/i }));

    await waitFor(() =>
      expect(mocks.updatePreferences).toHaveBeenCalledWith({
        profile_visibility: 'friends',
        collection_visibility: 'public',
        friend_request_permission: 'everyone',
        trainer_code_visibility: 'friends',
        coordination_method: 'campfire',
        coordination_handle: null,
        share_trade_contact: true,
        show_location: true,
        show_pokemon_go_name: true,
      }),
    );
  });

  it('saves an external coordination preference separately from public profile visibility', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/preferred coordination method/i), {
      target: { value: 'discord' },
    });
    fireEvent.change(screen.getByLabelText(/discord username/i), {
      target: { value: '@MistyTrades' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save coordination/i }));

    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        coordination_method: 'discord',
        coordination_handle: '@MistyTrades',
        share_trade_contact: true,
        trainer_code_visibility: 'friends',
      }),
    ));
  });

  it('restores and persists reduced motion for this browser only', async () => {
    localStorage.setItem('pokegonexus-reduced-motion', 'true');

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const toggle = await screen.findByLabelText(/reduce motion/i);
    expect(toggle).toBeChecked();
    expect(document.documentElement.dataset.reducedMotion).toBe('true');

    fireEvent.click(toggle);
    expect(localStorage.getItem('pokegonexus-reduced-motion')).toBe('false');
    expect(document.documentElement.dataset.reducedMotion).toBe('false');
  });
});
