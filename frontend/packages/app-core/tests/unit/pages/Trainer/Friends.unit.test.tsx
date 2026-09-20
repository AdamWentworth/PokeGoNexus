import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Friends from '@/pages/Trainer/Friends';

const render = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const mocks = vi.hoisted(() => ({
  fetchFriends: vi.fn(),
  acceptRequest: vi.fn(),
}));

vi.mock('@/services/socialService', () => ({
  fetchFriendsOverview: mocks.fetchFriends,
  acceptFriendRequest: mocks.acceptRequest,
  deleteFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  sendFriendRequest: vi.fn(),
  unblockTrainer: vi.fn(),
}));

vi.mock('@/services/userSearchService', () => ({
  fetchTrainerAutocomplete: vi.fn(),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { username: string } }) => unknown) =>
    selector({ user: { username: 'Adam' } }),
}));

describe('Friends page', () => {
  beforeEach(() => {
    mocks.fetchFriends.mockResolvedValue({
      friends: [],
      incoming: [
        {
          user_id: 'u-2',
          username: 'Brock',
          friendship_id: 'f-1',
          direction: 'incoming',
        },
      ],
      outgoing: [],
      blocked: [],
    });
    mocks.acceptRequest.mockResolvedValue({ success: true });
  });

  it('surfaces incoming requests and accepts them in place', async () => {
    const { container } = render(
      <MemoryRouter>
        <Friends />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /requests/i }));
    await expect(container).toHaveNoViolations();
    fireEvent.click(
      await screen.findByRole('button', { name: /accept brock/i }),
    );

    await waitFor(() =>
      expect(mocks.acceptRequest).toHaveBeenCalledWith('f-1'),
    );
  });
});
