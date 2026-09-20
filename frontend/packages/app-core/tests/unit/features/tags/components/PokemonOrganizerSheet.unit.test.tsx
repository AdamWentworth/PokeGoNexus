import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PokemonOrganizerSheet from '@/features/tags/components/PokemonOrganizerSheet';
import type { InstanceStatusMutationOutcome } from '@/types/instances';

const mocks = vi.hoisted(() => ({
  instances: {} as Record<string, any>,
  updateInstanceDetails: vi.fn(),
  createCustomTag: vi.fn(),
  updateCustomTag: vi.fn(),
  deleteCustomTag: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    instances: mocks.instances,
    updateInstanceDetails: mocks.updateInstanceDetails,
  }),
}));

vi.mock('@/features/tags/store/useTagsStore', () => ({
  useTagsStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    customTags: {
      caught: {
        storage: {
          tag: { tag_id: 'storage', name: 'Storage', color: '#22c55e', parent: 'caught', sort: 0 },
        },
      },
      wanted: {
        regional: {
          tag: { tag_id: 'regional', name: 'Regionals', color: '#ef4444', parent: 'wanted', sort: 0 },
        },
      },
    },
    createCustomTag: mocks.createCustomTag,
    updateCustomTag: mocks.updateCustomTag,
    deleteCustomTag: mocks.deleteCustomTag,
  }),
}));

vi.mock('@/components/feedback', () => ({
  feedback: {
    success: mocks.success,
    info: mocks.info,
    error: mocks.error,
  },
}));

vi.mock('@/components/OverlayPortal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/OverlayDismissButton', () => ({
  default: ({ children, onDismiss, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onDismiss: () => void }) => (
    <button {...props} onClick={onDismiss} type="button">{children}</button>
  ),
}));

vi.mock('@/pages/Pokemon/components/Menus/TagsMenu/CustomTagEditorSheet', () => ({
  default: () => <div data-testid="custom-tag-editor" />,
}));

const makeInstance = (overrides: Record<string, unknown> = {}) => ({
  instance_id: 'caught-1',
  variant_id: '0001-default',
  pokemon_id: 1,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  registered: true,
  favorite: false,
  most_wanted: false,
  caught_tags: [],
  wanted_tags: [],
  disabled: false,
  ...overrides,
});

const changedOutcome = (
  sourceKey: string,
  resultingInstanceId: string,
  targetStatus: 'Caught' | 'Trade' | 'Wanted' | 'Missing',
  operation: InstanceStatusMutationOutcome['operation'],
): InstanceStatusMutationOutcome => ({
  sourceKey,
  sourceInstanceId: sourceKey.includes('default') ? null : sourceKey,
  resultingInstanceId,
  targetStatus,
  operation,
  changed: true,
});

describe('PokemonOrganizerSheet', () => {
  beforeEach(() => {
    mocks.instances = {};
    vi.clearAllMocks();
    mocks.updateInstanceDetails.mockResolvedValue(undefined);
  });

  it('creates a catalog selection directly as a tagged Most Wanted entry', async () => {
    const onChangeStatus = vi.fn(async (_status, options) => {
      const outcome = changedOutcome('0001-default', 'wanted-new', 'Wanted', 'created');
      const resultPatch = options?.resultPatch;
      const patch = typeof resultPatch === 'function'
        ? resultPatch(outcome, makeInstance({
            instance_id: 'wanted-new',
            is_caught: false,
            is_wanted: true,
          }))
        : resultPatch;
      expect(patch).toMatchObject({ most_wanted: true, wanted_tags: ['regional'] });
      return [outcome];
    });
    const onClose = vi.fn();

    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['0001-default'])}
        onChangeStatus={onChangeStatus}
        onClearSelection={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /WantedAdd new wishlist entries/i }));
    fireEvent.click(screen.getByRole('button', { name: /Most Wanted/i }));
    fireEvent.click(screen.getByRole('button', { name: /Regionals/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & tag 1 Pokémon' }));

    await waitFor(() => expect(onChangeStatus).toHaveBeenCalledWith(
      'Wanted',
      expect.objectContaining({
        targets: ['0001-default'],
        additionalConfirmationDetails: [
          'Add to tag: Regionals',
          'Mark as Most Wanted',
        ],
        destinationFilter: 'custom:regional',
      }),
    ));
    expect(mocks.success).toHaveBeenCalledWith(
      '1 Pokémon created as Wanted and added to Regionals.',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('creates a separately tagged Wanted copy while leaving the caught source selected by ID', async () => {
    mocks.instances = { 'caught-1': makeInstance() };
    const onChangeStatus = vi.fn(async () => [
      changedOutcome('caught-1', 'wanted-copy', 'Wanted', 'cloned'),
    ]);

    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['caught-1'])}
        onChangeStatus={onChangeStatus}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Wanted copy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Most Wanted/i }));
    fireEvent.click(screen.getByRole('button', { name: /Regionals/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 Wanted copy' }));

    await waitFor(() => expect(onChangeStatus).toHaveBeenCalledWith(
      'Wanted',
      expect.objectContaining({ targets: ['caught-1'] }),
    ));
    const options = (onChangeStatus.mock.calls as unknown as Array<[
      string,
      { resultPatch: (...args: any[]) => Record<string, unknown> },
    ]>)[0][1];
    const outcome = changedOutcome('caught-1', 'wanted-copy', 'Wanted', 'cloned');
    expect(options.resultPatch(outcome, makeInstance({ is_caught: false, is_wanted: true })))
      .toMatchObject({ most_wanted: true, wanted_tags: ['regional'] });
  });

  it('converts a wanted entry into the same caught instance with caught-scoped tags', async () => {
    mocks.instances = {
      'wanted-1': makeInstance({
        instance_id: 'wanted-1',
        is_caught: false,
        is_wanted: true,
        wanted_tags: ['regional'],
      }),
    };
    const onChangeStatus = vi.fn(async () => [
      changedOutcome('wanted-1', 'wanted-1', 'Caught', 'converted'),
    ]);

    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['wanted-1'])}
        onChangeStatus={onChangeStatus}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mark as Caught/i }));
    fireEvent.click(screen.getByRole('button', { name: /Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Move 1 to Caught' }));

    await waitFor(() => expect(onChangeStatus).toHaveBeenCalledWith(
      'Caught',
      expect.objectContaining({ targets: ['wanted-1'] }),
    ));
    const options = (onChangeStatus.mock.calls as unknown as Array<[
      string,
      { resultPatch: (...args: any[]) => Record<string, unknown> },
    ]>)[0][1];
    const outcome = changedOutcome('wanted-1', 'wanted-1', 'Caught', 'converted');
    expect(options.resultPatch(outcome, makeInstance({ instance_id: 'wanted-1' })))
      .toMatchObject({ favorite: false, caught_tags: ['storage'] });
  });

  it('does not save label changes when a For Trade transition is cancelled', async () => {
    mocks.instances = { 'caught-1': makeInstance() };
    const onChangeStatus = vi.fn(async () => []);

    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['caught-1'])}
        onChangeStatus={onChangeStatus}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: /For Trade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 1' }));

    await waitFor(() => expect(onChangeStatus).toHaveBeenCalled());
    expect(mocks.updateInstanceDetails).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('disables Favorite for For Trade instances and For Trade for favorites', () => {
    mocks.instances = {
      trade: makeInstance({ instance_id: 'trade', is_for_trade: true }),
    };
    const { unmount } = render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['trade'])}
        onChangeStatus={vi.fn(async () => [])}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /FavoriteRemove For Trade first/i }))
      .toBeDisabled();
    unmount();

    mocks.instances = {
      favorite: makeInstance({ instance_id: 'favorite', favorite: true }),
    };
    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['favorite'])}
        onChangeStatus={vi.fn(async () => [])}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /For TradeRemove Favorite first/i }))
      .toBeDisabled();
  });

  it('does not offer Favorite when creating directly as For Trade', () => {
    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['0001-default'])}
        onChangeStatus={vi.fn(async () => [])}
        onClearSelection={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /For TradeAdd caught instances/i }));

    expect(screen.queryByRole('button', { name: /Favorite/i })).not.toBeInTheDocument();
  });

  it('blocks dismissal and shows clear progress while creation is pending', async () => {
    let completeCreation: ((outcomes: InstanceStatusMutationOutcome[]) => void) | undefined;
    const onChangeStatus = vi.fn(() => new Promise<InstanceStatusMutationOutcome[]>((resolve) => {
      completeCreation = resolve;
    }));
    const onClose = vi.fn();

    render(
      <PokemonOrganizerSheet
        selectionKeys={new Set(['0001-default'])}
        onChangeStatus={onChangeStatus}
        onClearSelection={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & tag 1 Pokémon' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Creating your Pokémon…');
    expect(screen.getByRole('button', { name: 'Close Pokémon organizer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');

    completeCreation?.([
      changedOutcome('0001-default', 'caught-new', 'Caught', 'created'),
    ]);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
