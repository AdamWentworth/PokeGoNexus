import XYZ from 'ol/source/XYZ';

const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** CARTO now requires a project key. Unconfigured builds use the standard OSM map. */
export function createMapTileSource(
  isLightMode: boolean,
  cartoKey = import.meta.env.VITE_CARTO_BASEMAP_API_KEY as string | undefined,
) {
  const key = cartoKey?.trim();
  return new XYZ({
    url: key
      ? `https://basemaps.cartocdn.com/${isLightMode ? 'rastertiles/voyager' : 'dark_all'}/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attributions: key
      ? `${osmAttribution}, &copy; <a href="https://carto.com/attributions">CARTO</a>`
      : osmAttribution,
    attributionsCollapsible: false,
    maxZoom: key ? 20 : 19,
    crossOrigin: 'anonymous',
  });
}
