import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TagsMenu from '@/pages/Pokemon/components/Menus/TagsMenu/TagsMenu';
import type { TagBuckets, TagItem } from '@/types/tags';
import { useTagsStore } from '@/features/tags/store/useTagsStore';

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ confirm: confirmMock }),
}));

const makeItem = (overrides: Partial<TagItem>): TagItem =>
  ({
    instance_id: 'instance',
    pokemon_id: 1,
    pokedex_number: 1,
    currentImage: '/images/default/pokemon_1.png',
    friendship_level: null,
    mirror: false,
    pref_lucky: false,
    cp: null,
    hp: 0,
    favorite: false,
    most_wanted: false,
    is_caught: false,
    is_for_trade: false,
    is_wanted: false,
    gender: 'unknown',
    registered: false,
    moves: [],
    shiny: false,
    ...overrides,
  }) as TagItem;

describe('TagsMenu', () => {
  beforeEach(() => {
    confirmMock.mockClear();
    confirmMock.mockResolvedValue(true);
    useTagsStore.setState({
      customTags: { caught: {}, wanted: {} },
      tagOrders: {
        caught: ['system:caught', 'system:favorites', 'system:trade'],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
      createCustomTag: vi.fn().mockResolvedValue({}) as any,
      updateCustomTag: vi.fn().mockResolvedValue({}) as any,
      deleteCustomTag: vi.fn().mockResolvedValue(undefined) as any,
      saveTagOrder: vi.fn().mockResolvedValue(undefined) as any,
    });
  });

  it('derives Trade from caught and Most Wanted from wanted only', () => {
    const activeTags: TagBuckets = {
      caught: {
        c1: makeItem({
          instance_id: 'c1',
          favorite: true,
          is_caught: true,
          is_for_trade: true,
        }),
      },
      wanted: {
        w1: makeItem({
          instance_id: 'w1',
          is_wanted: true,
          most_wanted: true,
          // Should NOT leak into Trade, because Trade is derived from caught bucket only.
          is_for_trade: true,
        }),
      },
    };

    const { container } = render(
      <TagsMenu onSelectTag={vi.fn()} activeTags={activeTags} variants={[]} />,
    );

    const favoritesTag = container.querySelector('[data-tag="Favorites"]');
    const tradeTag = container.querySelector('[data-tag="Trade"]');
    const caughtTag = container.querySelector('[data-tag="Caught"]');
    const wantedTag = container.querySelector('[data-tag="Wanted"]');
    const mostWantedTag = container.querySelector('[data-tag="Most Wanted"]');

    expect(favoritesTag?.textContent).toContain('1');
    expect(tradeTag?.textContent).toContain('1');
    expect(caughtTag?.textContent).toContain('1');
    expect(wantedTag?.textContent).toContain('1');
    expect(mostWantedTag?.textContent).toContain('1');
  });

  it('calls onSelectTag when a tag tile is clicked', () => {
    const onSelectTag = vi.fn();
    const activeTags: TagBuckets = {
      caught: {
        c1: makeItem({ instance_id: 'c1', is_caught: true }),
      },
      wanted: {},
    };

    const { container } = render(
      <TagsMenu onSelectTag={onSelectTag} activeTags={activeTags} variants={[]} />,
    );

    const caughtTag = container.querySelector('[data-tag="Caught"]');
    expect(caughtTag).toBeTruthy();

    fireEvent.click(caughtTag as Element);
    expect(onSelectTag).toHaveBeenCalledWith('Caught');
  });

  it('can focus the inventory side without rendering wishlist tags', () => {
    const activeTags: TagBuckets = {
      caught: {
        c1: makeItem({ instance_id: 'c1', is_caught: true, is_for_trade: true }),
      },
      wanted: {
        w1: makeItem({ instance_id: 'w1', is_wanted: true, most_wanted: true }),
      },
    };

    const { container } = render(
      <TagsMenu
        panel="inventory"
        onSelectTag={vi.fn()}
        activeTags={activeTags}
        variants={[]}
      />,
    );

    expect(container.querySelector('[data-tag="Caught"]')).toBeTruthy();
    expect(container.querySelector('[data-tag="Trade"]')).toBeTruthy();
    expect(container.querySelector('[data-tag="Wanted"]')).toBeNull();
    expect(container.querySelector('[data-tag="Most Wanted"]')).toBeNull();
  });

  it('can focus the wishlist side without rendering inventory tags', () => {
    const activeTags: TagBuckets = {
      caught: {
        c1: makeItem({ instance_id: 'c1', is_caught: true, is_for_trade: true }),
      },
      wanted: {
        w1: makeItem({ instance_id: 'w1', is_wanted: true, most_wanted: true }),
      },
    };

    const { container } = render(
      <TagsMenu
        panel="wishlist"
        onSelectTag={vi.fn()}
        activeTags={activeTags}
        variants={[]}
      />,
    );

    expect(container.querySelector('[data-tag="Wanted"]')).toBeTruthy();
    expect(container.querySelector('[data-tag="Most Wanted"]')).toBeTruthy();
    expect(container.querySelector('[data-tag="Caught"]')).toBeNull();
    expect(container.querySelector('[data-tag="Trade"]')).toBeNull();
  });

  it('does not repeat the active Pokemon filter over the tag overview', () => {
    render(
      <TagsMenu
        panel="inventory"
        onSelectTag={vi.fn()}
        activeTags={{ caught: {}, wanted: {} }}
        variants={[]}
        tagFilter="Caught"
        onClearTagFilter={vi.fn()}
      />,
    );

    expect(document.querySelector('.active-tag-filter-row')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear caught tag filter/i })).not.toBeInTheDocument();
    expect(document.querySelector('[data-tag="Caught"]')).toBeInTheDocument();
  });

  it('does not render a required foreign-catalog filter over the tag overview', () => {
    render(
      <TagsMenu
        panel="inventory"
        onSelectTag={vi.fn()}
        activeTags={{ caught: {}, wanted: {} }}
        variants={[]}
        tagFilter="Caught"
      />,
    );

    expect(document.querySelector('.active-tag-filter-row')).not.toBeInTheDocument();
  });

  it('renders editable custom tags and filters with a stable id selector', () => {
    const customItem = makeItem({ instance_id: 'custom-1', is_caught: true });
    useTagsStore.setState({
      customTags: {
        caught: {
          'tag-raids': {
            tag: {
              tag_id: 'tag-raids',
              parent: 'caught',
              name: 'Raid team',
              color: '#2563EB',
              sort: 10,
            },
            items: { 'custom-1': customItem },
          },
        },
        wanted: {},
      },
    });
    const onSelectTag = vi.fn();

    render(
      <TagsMenu
        activeTags={{
          caught: { 'custom-1': customItem },
          wanted: {},
          'custom:tag-raids': { 'custom-1': customItem },
        }}
        isEditable
        onSelectTag={onSelectTag}
        panel="inventory"
        variants={[]}
      />,
    );

    fireEvent.click(screen.getByText('Raid team'));
    expect(onSelectTag).toHaveBeenCalledWith('custom:tag-raids');
    expect(screen.getByRole('button', { name: /edit raid team tag/i })).toBeInTheDocument();
  });

  it('allows custom and system tags to be interleaved and saves the complete order', async () => {
    const customItem = makeItem({ instance_id: 'custom-shadow', is_caught: true });
    const saveTagOrder = vi.fn().mockResolvedValue(undefined);
    useTagsStore.setState({
      customTags: {
        caught: {
          'tag-shadow': {
            tag: {
              tag_id: 'tag-shadow',
              parent: 'caught',
              name: 'Shadow Shinies',
              color: '#7C3AED',
              sort: 10,
            },
            items: { 'custom-shadow': customItem },
          },
        },
        wanted: {},
      },
      tagOrders: {
        caught: ['custom:tag-shadow', 'system:favorites', 'system:caught', 'system:trade'],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
      saveTagOrder,
    });

    const { container } = render(
      <TagsMenu
        activeTags={{ caught: { 'custom-shadow': customItem }, wanted: {} }}
        isEditable
        onSelectTag={vi.fn()}
        panel="inventory"
        variants={[]}
      />,
    );

    expect(
      [...container.querySelectorAll('.tag-item')].map((element) => element.getAttribute('data-tag')),
    ).toEqual(['custom:tag-shadow', 'Favorites', 'Caught', 'Trade']);

    fireEvent.click(screen.getByRole('button', { name: /arrange/i }));
    const caughtHandle = screen.getByRole('button', {
      name: /press and drag all caught to reorder/i,
    });
    const favoritesCard = container.querySelector<HTMLElement>('[data-tag="Favorites"]');
    expect(favoritesCard).toBeTruthy();
    vi.spyOn(favoritesCard as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 400,
      height: 200,
      left: 20,
      right: 380,
      top: 200,
      width: 360,
      x: 20,
      y: 200,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn().mockReturnValue(favoritesCard),
    });
    fireEvent.pointerDown(caughtHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: 200,
      clientY: 500,
    });
    expect(document.querySelector('.tag-item-drag-preview')).toBeInTheDocument();
    expect(container.querySelector('.tag-footer-icon')).not.toBeInTheDocument();
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 200, clientY: 250 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 200, clientY: 250 });
    expect(document.querySelector('.tag-item-drag-preview')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('tag-drag-active');
    Reflect.deleteProperty(document, 'elementFromPoint');
    fireEvent.click(screen.getByRole('button', { name: /save order/i }));

    await waitFor(() => {
      expect(saveTagOrder).toHaveBeenCalledWith('caught', [
        'custom:tag-shadow',
        'system:caught',
        'system:favorites',
        'system:trade',
      ]);
    });
  });

  it('always clears a floating tag when the pointer is cancelled outside the handle', () => {
    render(
      <TagsMenu
        activeTags={{ caught: {}, wanted: {} }}
        isEditable
        onSelectTag={vi.fn()}
        panel="inventory"
        variants={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /arrange/i }));
    const handle = screen.getByRole('button', {
      name: /press and drag favorites to reorder/i,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 200,
      clientY: 300,
    });
    expect(document.querySelector('.tag-item-drag-preview')).toBeInTheDocument();

    fireEvent.pointerCancel(document, { pointerId: 7 });

    expect(document.querySelector('.tag-item-drag-preview')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('tag-drag-active');
  });

  it('opens the custom tag creator from an editable tag panel', () => {
    render(
      <TagsMenu
        activeTags={{ caught: {}, wanted: {} }}
        isEditable
        onSelectTag={vi.fn()}
        panel="wishlist"
        variants={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /new wanted tag/i }));
    expect(screen.getByRole('dialog', { name: /new wanted tag/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/community day/i)).toBeInTheDocument();
  });


  it('caps preview rendering to 18 sprites per tag for large datasets', () => {
    const caught: Record<string, TagItem> = {};
    const wanted: Record<string, TagItem> = {};

    for (let i = 1; i <= 120; i += 1) {
      const id = `c-${i}`;
      caught[id] = makeItem({
        instance_id: id,
        pokemon_id: i,
        is_caught: true,
        favorite: i % 2 === 0,
        is_for_trade: i % 3 === 0,
      });
    }

    for (let i = 1; i <= 90; i += 1) {
      const id = `w-${i}`;
      wanted[id] = makeItem({
        instance_id: id,
        pokemon_id: 500 + i,
        is_wanted: true,
        most_wanted: i % 2 === 1,
      });
    }

    const activeTags: TagBuckets = { caught, wanted };

    const { container } = render(
      <TagsMenu onSelectTag={vi.fn()} activeTags={activeTags} variants={[]} />,
    );

    const caughtTag = container.querySelector('[data-tag="Caught"]');
    const wantedTag = container.querySelector('[data-tag="Wanted"]');
    const favoritesTag = container.querySelector('[data-tag="Favorites"]');
    const tradeTag = container.querySelector('[data-tag="Trade"]');
    const mostWantedTag = container.querySelector('[data-tag="Most Wanted"]');

    expect(caughtTag?.textContent).toContain('120');
    expect(wantedTag?.textContent).toContain('90');
    expect(favoritesTag?.textContent).toContain('60');
    expect(tradeTag?.textContent).toContain('40');
    expect(mostWantedTag?.textContent).toContain('45');

    expect(caughtTag?.querySelectorAll('.tag-sprite').length).toBe(18);
    expect(wantedTag?.querySelectorAll('.tag-sprite').length).toBe(18);
    expect(favoritesTag?.querySelectorAll('.tag-sprite').length).toBe(18);
    expect(tradeTag?.querySelectorAll('.tag-sprite').length).toBe(18);
    expect(mostWantedTag?.querySelectorAll('.tag-sprite').length).toBe(18);
  });
});
