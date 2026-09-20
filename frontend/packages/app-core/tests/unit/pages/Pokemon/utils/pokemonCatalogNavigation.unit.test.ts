import { describe, expect, it } from "vitest";

import {
  buildPokemonCatalogPath,
  readPokemonCatalogFilter,
  readPokemonCatalogSearch,
  readPokemonCatalogStateFilter,
} from "@/pages/Pokemon/utils/pokemonCatalogNavigation";

describe("pokemonCatalogNavigation", () => {
  it("builds own and public collection links with canonical filters", () => {
    expect(
      buildPokemonCatalogPath({
        filter: "Caught",
      }),
    ).toBe("/pokemon?filter=caught");
    expect(
      buildPokemonCatalogPath({
        username: "Misty Trainer",
        filter: "Favorites",
        search: "rayquaza&shiny",
      }),
    ).toBe(
      "/pokemon/Misty%20Trainer?filter=favorites&search=rayquaza%26shiny",
    );
  });

  it.each([
    ["?filter=caught", "Caught"],
    ["?filter=TRADE", "Trade"],
    ["?filter=wAnTeD", "Wanted"],
    ["?filter=favorites", "Favorites"],
  ] as const)("reads %s as %s", (search, expected) => {
    expect(readPokemonCatalogFilter(search)).toBe(expected);
  });

  it("ignores absent and unsupported filters", () => {
    expect(readPokemonCatalogFilter("")).toBeNull();
    expect(readPokemonCatalogFilter("?filter=registered")).toBeNull();
  });

  it("reads the legacy listing filter from router state", () => {
    expect(readPokemonCatalogStateFilter({ instanceData: "Trade" })).toBe(
      "Trade",
    );
    expect(readPokemonCatalogStateFilter({ instanceData: "wanted" })).toBe(
      "Wanted",
    );
    expect(readPokemonCatalogStateFilter({ instanceData: "unknown" })).toBeNull();
    expect(readPokemonCatalogStateFilter(null)).toBeNull();
  });

  it("reads a catalog search expression from the URL", () => {
    expect(
      readPokemonCatalogSearch("?filter=caught&search=rayquaza%26shiny"),
    ).toBe("rayquaza&shiny");
    expect(readPokemonCatalogSearch("?filter=caught")).toBe("");
  });
});
