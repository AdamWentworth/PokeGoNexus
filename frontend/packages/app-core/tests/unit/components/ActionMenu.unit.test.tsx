import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionMenu from '@/components/ActionMenu';
import { requestActionMenuOpen } from '@/components/actionMenuEvents';

const mocks = vi.hoisted(() => ({
  auth: { isLoggedIn: false },
  fetchFriendsOverview: vi.fn(),
  setLoadingSource: vi.fn(),
}));

vi.mock('@/components/ActionMenuButton', () => ({
  default: ({
    onClick,
    disabled,
    ariaHidden,
  }: {
    onClick: () => void;
    disabled?: boolean;
    ariaHidden?: boolean;
  }) => (
    <button
      className="action-menu-button"
      type="button"
      aria-hidden={ariaHidden}
      disabled={disabled}
      onClick={onClick}
    >
      Action Menu
    </button>
  ),
}));

vi.mock('@/components/CloseButton', () => ({
  default: ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      Close
    </button>
  ),
}));

vi.mock('@/components/ThemeSwitch', () => ({
  default: () => <div>Theme</div>,
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ alert: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/services/socialService', () => ({
  fetchFriendsOverview: mocks.fetchFriendsOverview,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isLightMode: false }),
}));

vi.mock('@/contexts/ContextBackContext', () => ({
  isMobileContextBackEnvironment: () => false,
  useContextBackHandler: vi.fn(),
}));

vi.mock('@/contexts/AppLoadingContext', () => ({
  useAppLoading: () => ({ setLoadingSource: mocks.setLoadingSource }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

const openActionMenu = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Action Menu' }));
  return screen.findByRole('dialog', { name: 'Quick navigation' });
};

describe('ActionMenu', () => {
  beforeEach(() => {
    mocks.auth.isLoggedIn = false;
    mocks.fetchFriendsOverview.mockReset();
    mocks.setLoadingSource.mockReset();
  });

  it('keeps Home centered among nine destinations and navigates to Max Battles', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();

    expect(container.querySelectorAll('.action-menu-item')).toHaveLength(9);
    expect(container.querySelector('.button-home')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Max Battles' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/max');
  });

  it('can be opened by contextual guidance elsewhere in the app', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <ActionMenu />
      </MemoryRouter>,
    );

    act(() => requestActionMenuOpen());

    expect(container.querySelector('.action-menu-overlay')).toBeInTheDocument();
  });

  it('navigates to the PvP rankings page', async () => {
    render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();
    fireEvent.click(screen.getByRole('button', { name: 'PvP' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/pvp');
  });

  it('covers the previous page with the shared loader while a destination commits', async () => {
    render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(mocks.setLoadingSource).toHaveBeenCalledWith('action-menu-navigation', true);
    expect(screen.getByTestId('location')).toHaveTextContent('/search');
    await waitFor(() => {
      expect(mocks.setLoadingSource).toHaveBeenCalledWith('action-menu-navigation', false);
    });
  });

  it('navigates to community rankings instead of opening a placeholder', async () => {
    render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Rankings' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/rankings');
  });

  it('opens the signed-in Trade Board workspace without changing the nine primary destinations', async () => {
    mocks.auth.isLoggedIn = true;
    mocks.fetchFriendsOverview.mockResolvedValue({ friends: [], incoming: [], outgoing: [], blocked: [] });

    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();
    expect(container.querySelectorAll('.action-menu-item')).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: 'Share Trade Board' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/trade-board');
  });

  it('opens the real settings page instead of a placeholder modal', async () => {
    render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });

  it('opens a Learn and support directory without adding another primary destination', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();

    expect(container.querySelectorAll('.action-menu-item')).toHaveLength(9);
    const supportButton = screen.getByRole('button', { name: 'Learn & support' });
    expect(supportButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(supportButton);

    expect(supportButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Learn and support' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Getting Started' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FAQ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trade Safety' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help directory' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/about');
  });

  it('closes the Learn and support directory before closing the action menu', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
      </MemoryRouter>,
    );

    const dialog = await openActionMenu();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Learn & support' }));
    expect(screen.getByRole('navigation', { name: 'Learn and support' })).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Learn and support' })).not.toBeInTheDocument();
    expect(container.querySelector('.action-menu-overlay')).toHaveAttribute('data-menu-state', 'open');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Learn & support' })).toHaveFocus();
    });
  });

  it('uses Profile as the single social destination and surfaces requests there', async () => {
    mocks.auth.isLoggedIn = true;
    mocks.fetchFriendsOverview.mockResolvedValue({
      friends: [],
      incoming: [{ friendship_id: 'friend-1' }],
      outgoing: [],
      blocked: [],
    });

    render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
        <LocationProbe />
      </MemoryRouter>,
    );

    await openActionMenu();

    await waitFor(() => expect(mocks.fetchFriendsOverview).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: /friends/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1')).toHaveClass('action-menu-notification');

    fireEvent.click(screen.getByRole('button', { name: /profile/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile');
  });

  it('keeps the close control disabled until the opening gesture has settled', () => {
    vi.useFakeTimers();

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/pokemon']}>
          <ActionMenu />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Action Menu' }));

      const closeButton = screen.getByRole('button', { name: 'Close', hidden: true });
      expect(closeButton).toBeDisabled();
      expect(container.querySelector('.action-menu-button')).toBeDisabled();
      expect(container.querySelector('.action-menu-button')).toHaveAttribute('aria-hidden', 'true');

      act(() => {
        vi.advanceTimersByTime(75);
      });
      expect(closeButton).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(closeButton).toBeEnabled();
      expect(container.querySelector('.action-menu-button')).not.toBeInTheDocument();
      fireEvent.click(closeButton);
      expect(container.querySelector('.action-menu-overlay')).toHaveAttribute(
        'data-menu-state',
        'closed',
      );
      expect(container.querySelector('.action-menu-button')).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByRole('button', { name: 'Action Menu' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('finishes opening when delayed timers are released in one batch', () => {
    vi.useFakeTimers();

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/pokemon']}>
          <ActionMenu />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Action Menu' }));

      act(() => {
        vi.advanceTimersByTime(375);
      });

      expect(container.querySelector('.action-menu-overlay')).toHaveAttribute(
        'data-menu-state',
        'open',
      );
      expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
      expect(container.querySelector('.action-menu-button')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('behaves as a modal dialog, traps focus, and closes with Escape', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
      </MemoryRouter>,
    );

    const dialog = await openActionMenu();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    await waitFor(() => expect(dialog).toHaveFocus());

    const closeButton = await waitFor(() => {
      const control = screen.getByRole('button', { name: 'Close' });
      expect(control).toBeEnabled();
      return control;
    });
    const lastControl = screen.getByRole('button', { name: 'Max Battles' });
    lastControl.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(container.querySelector('.action-menu-overlay')).toHaveAttribute(
      'data-menu-state',
      'closed',
    );
  });

  it('has no automated accessibility violations while open', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/pokemon']}>
        <ActionMenu />
      </MemoryRouter>,
    );

    await openActionMenu();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Learn & support' }));
    expect(screen.getByRole('navigation', { name: 'Learn and support' })).toBeInTheDocument();

    await expect(container).toHaveNoViolations();
  });
});
