import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCustomTag,
  deleteCustomTag,
  fetchCustomTags,
  updatePokemonTagOrder,
  updateCustomTag,
} from '@/services/tagService';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe.sequential('tagService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads custom tag definitions with authenticated cookies', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      tags: [{ tag_id: 'tag-1', parent: 'caught', name: 'Raids', color: '#2563EB', sort: 10 }],
      orders: {
        caught: ['custom:tag-1', 'system:caught', 'system:favorites', 'system:trade'],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
    }));

    await expect(fetchCustomTags()).resolves.toMatchObject({
      tags: [{ tag_id: 'tag-1' }],
      orders: { caught: ['custom:tag-1', 'system:caught', 'system:favorites', 'system:trade'] },
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/tags');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('creates and updates tag definitions without membership payloads', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { tag: { tag_id: 'tag-1', parent: 'caught', name: 'Raids', color: '#2563EB' } }))
      .mockResolvedValueOnce(jsonResponse(200, { tag: { tag_id: 'tag-1', parent: 'caught', name: 'Raid team', color: '#0D9488' } }));

    await createCustomTag({ parent: 'caught', name: 'Raids', color: '#2563EB' });
    await updateCustomTag('tag-1', { name: 'Raid team', color: '#0D9488' });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(createBody).toEqual({ parent: 'caught', name: 'Raids', color: '#2563EB' });
    expect(createBody).not.toHaveProperty('instance_ids');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('returns affected instances when deleting a definition', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      tag_id: 'tag-1',
      affected_instance_ids: ['instance-1'],
    }));

    await expect(deleteCustomTag('tag-1')).resolves.toEqual({
      tag_id: 'tag-1',
      affected_instance_ids: ['instance-1'],
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('saves a complete interleaved tag order', async () => {
    const tagKeys = [
      'custom:tag-1',
      'system:favorites',
      'system:caught',
      'system:trade',
    ] as const;
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      parent: 'caught',
      tag_keys: tagKeys,
    }));

    await expect(updatePokemonTagOrder({
      parent: 'caught',
      tag_keys: [...tagKeys],
    })).resolves.toEqual({ parent: 'caught', tag_keys: tagKeys });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      parent: 'caught',
      tag_keys: tagKeys,
    });
  });

  it('surfaces server validation messages', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { message: 'A tag with that name already exists.' }));
    await expect(createCustomTag({ parent: 'wanted', name: 'Rare', color: '#E11D48' }))
      .rejects.toThrow('A tag with that name already exists.');
  });
});
