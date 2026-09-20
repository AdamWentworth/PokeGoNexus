import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PartnerInfoModal, {
  formatTrainerCode,
} from '@/pages/Trades/components/PartnerInfoModal';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

describe('PartnerInfoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  it('formats trainer codes in groups of four digits', () => {
    expect(formatTrainerCode('1234 5678-9012')).toBe('1234 5678 9012');
    expect(formatTrainerCode('')).toBe('');
  });

  it('returns null when partnerInfo is missing', () => {
    const { container } = render(<PartnerInfoModal partnerInfo={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders opted-in coordination details without precise coordinates and supports copying', async () => {
    const { baseElement } = render(
      <PartnerInfoModal
        partnerUsername="misty"
        partnerInfo={{
          sharingEnabled: true,
          trainerCode: '123456789012',
          pokemonGoName: 'MistyGO',
          coordinationMethod: 'campfire',
          coordinationHandle: 'MistyCampfire',
          location: 'Cerulean City',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /coordinate the exchange/i })).toBeInTheDocument();
    expect(screen.getByText('1234 5678 9012')).toBeInTheDocument();
    expect(screen.getByText('MistyGO')).toBeInTheDocument();
    expect(screen.getByText('@MistyCampfire')).toBeInTheDocument();
    expect(baseElement.querySelector('.partner-general-location')).toHaveTextContent('Cerulean City');
    expect(screen.queryByText(/latitude|longitude|coordinates/i)).not.toBeInTheDocument();
    await expect(baseElement).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: /copy trainer code/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('1234 5678 9012');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('does not leak identity fields when the trainer disabled accepted-trade sharing', () => {
    render(
      <PartnerInfoModal
        partnerUsername="misty"
        partnerInfo={{
          sharingEnabled: false,
          coordinationMethod: 'none',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/has not shared coordination details/i)).toBeInTheDocument();
    expect(screen.queryByText(/trainer code/i)).not.toBeInTheDocument();
    expect(screen.getByText(/messaging and the in-game exchange happen outside/i)).toBeInTheDocument();
  });
});
