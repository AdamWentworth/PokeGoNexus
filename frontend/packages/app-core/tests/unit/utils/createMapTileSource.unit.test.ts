import { describe, expect, it } from 'vitest';
import { createMapTileSource } from '@/utils/createMapTileSource';

describe('map provider configuration', () => {
  it.each([true, false])('uses attributed OSM tiles without credentials (light=%s)', (light) => {
    const source = createMapTileSource(light, '');
    expect(source.getUrls()).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png']);
    expect(source.getAttributionsCollapsible()).toBe(false);
    expect(String(source.getAttributions()!(null!))).toContain('OpenStreetMap');
  });

  it.each([true, false])('authenticates themed CARTO tiles when configured (light=%s)', (light) => {
    const source = createMapTileSource(light, 'project+key&test');
    const url = new URL(source.getUrls()![0]);
    expect(url.searchParams.get('key')).toBe('project+key&test');
    expect(url.pathname).toContain(light ? 'voyager' : 'dark_all');
    expect(source.getAttributionsCollapsible()).toBe(false);
    expect(String(source.getAttributions()!(null!))).toContain('CARTO');
  });
});
