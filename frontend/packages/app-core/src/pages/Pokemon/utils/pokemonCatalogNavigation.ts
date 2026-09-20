export type PokemonCatalogFilter =
  | "Caught"
  | "Trade"
  | "Wanted"
  | "Favorites";

const catalogFilterByQueryValue: Record<string, PokemonCatalogFilter> = {
  caught: "Caught",
  trade: "Trade",
  wanted: "Wanted",
  favorites: "Favorites",
};

export const readPokemonCatalogFilter = (
  search: string,
): PokemonCatalogFilter | null => {
  const value = new URLSearchParams(search).get("filter");
  if (!value) return null;
  return catalogFilterByQueryValue[value.trim().toLowerCase()] ?? null;
};

export const readPokemonCatalogStateFilter = (
  state: unknown,
): PokemonCatalogFilter | null => {
  if (!state || typeof state !== "object") return null;

  const value = (state as { instanceData?: unknown }).instanceData;
  if (typeof value !== "string") return null;

  return catalogFilterByQueryValue[value.trim().toLowerCase()] ?? null;
};

export const readPokemonCatalogSearch = (search: string): string =>
  new URLSearchParams(search).get("search")?.trim() ?? "";

export const buildPokemonCatalogPath = ({
  username,
  filter,
  search,
}: {
  username?: string;
  filter: PokemonCatalogFilter;
  search?: string;
}): string => {
  const pathname = username
    ? `/pokemon/${encodeURIComponent(username)}`
    : "/pokemon";
  const query = new URLSearchParams({
    filter: filter.toLowerCase(),
  });
  if (search?.trim()) query.set("search", search.trim());

  return `${pathname}?${query.toString()}`;
};
