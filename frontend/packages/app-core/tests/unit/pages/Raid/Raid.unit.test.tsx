import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import Raid from "@/pages/Raid/Raid";
import { useInstancesStore } from "@/features/instances/store/useInstancesStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { PokemonInstance } from "@/types/pokemonInstance";
import type { PokemonVariant } from "@/types/pokemonVariants";
import type { Move } from "@/types/pokemonSubTypes";
import { RAID_SIMULATION_MODEL_VERSION } from "@/pages/Raid/utils/raidRules";

type RaidTestVariantOverrides = Omit<
  Partial<PokemonVariant>,
  "moves" | "raid_boss"
> &
  Pick<PokemonVariant, "name" | "variant_id"> & {
    moves?: Move[];
    raid_boss?: unknown[];
  };

const mocks = vi.hoisted(() => ({
  storeState: {
    variants: [] as PokemonVariant[],
    variantsLoading: false,
    isMovesLoading: false,
    isRaidDataLoading: false,
    ensureMoves: vi.fn(),
    ensureRaidData: vi.fn(),
  },
}));

vi.mock("@/features/variants/store/useVariantsStore", () => ({
  useVariantsStore: (selector: (state: typeof mocks.storeState) => unknown) =>
    selector(mocks.storeState),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner">Loading</div>,
}));

const move = (
  name: string,
  type: string,
  isFast: 0 | 1,
  power: number,
  cooldown: number,
  energy: number,
) =>
  ({
    move_id: [...name].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ),
    name,
    type,
    type_name: type,
    is_fast: isFast,
    raid_power: power,
    raid_cooldown: cooldown,
    raid_energy: energy,
  }) as unknown as Move;

const variant = (overrides: RaidTestVariantOverrides): PokemonVariant =>
  ({
    pokemon_id: overrides.pokemon_id ?? 150,
    pokedex_number: overrides.pokedex_number ?? 150,
    name: overrides.name,
    species_name: overrides.species_name ?? overrides.name,
    attack: overrides.attack ?? 300,
    defense: overrides.defense ?? 182,
    stamina: overrides.stamina ?? 214,
    type_1_id: overrides.type_1_id ?? 15,
    type_2_id: overrides.type_2_id ?? 0,
    type1_name: overrides.type1_name ?? "psychic",
    type2_name: overrides.type2_name ?? "none",
    form: overrides.form,
    megaForm: overrides.megaForm,
    variantType: overrides.variantType ?? "default",
    currentImage: overrides.currentImage ?? "/images/missing-pokemon.png",
    image_url: overrides.image_url ?? "",
    sprite_url: overrides.sprite_url ?? "",
    moves: overrides.moves ?? [
      move("Confusion", "psychic", 1, 20, 1600, 15),
      move("Psystrike", "psychic", 0, 95, 2300, -50),
    ],
    raid_boss: (overrides.raid_boss ??
      []) as unknown as PokemonVariant["raid_boss"],
    backgrounds: [],
    variant_id: overrides.variant_id,
  }) as unknown as PokemonVariant;

const renderRaid = () =>
  render(
    <MemoryRouter>
      <Raid />
    </MemoryRouter>,
  );

const openRaidSetup = () => {
  const setup = screen.getByText("Raid setup").closest("details");
  expect(setup).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Raid setup").closest("summary")!);
  expect(setup).toHaveAttribute("open");
};

describe("Raid page", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isLoggedIn: false, user: null });
    useInstancesStore.setState({ instances: {}, instancesLoading: false });
    mocks.storeState.variantsLoading = false;
    mocks.storeState.isMovesLoading = false;
    mocks.storeState.isRaidDataLoading = false;
    mocks.storeState.variants = [
      variant({
        name: "Mewtwo",
        variant_id: "mewtwo-default",
        raid_boss: [
          {
            id: 1,
            tier: "5-star",
            min_unboosted_cp: 2294,
            max_unboosted_cp: 2387,
            min_boosted_cp: 2868,
            max_boosted_cp: 2984,
          },
        ],
      }),
      variant({
        name: "Tyranitar",
        variant_id: "tyranitar-default",
        pokemon_id: 248,
        pokedex_number: 248,
        attack: 251,
        defense: 207,
        stamina: 225,
        type_1_id: 16,
        type_2_id: 2,
        type1_name: "rock",
        type2_name: "dark",
        moves: [
          move("Bite", "dark", 1, 6, 500, 4),
          move("Brutal Swing", "dark", 0, 65, 1900, -33),
        ],
      }),
      variant({
        name: "Gengar",
        variant_id: "gengar-default",
        pokemon_id: 94,
        pokedex_number: 94,
        attack: 261,
        defense: 149,
        stamina: 155,
        type_1_id: 9,
        type_2_id: 14,
        type1_name: "ghost",
        type2_name: "poison",
        moves: [
          move("Lick", "ghost", 1, 5, 500, 6),
          move("Shadow Ball", "ghost", 0, 100, 3000, -50),
        ],
      }),
      variant({
        name: "Absol",
        variant_id: "absol-default",
        pokemon_id: 359,
        pokedex_number: 359,
        attack: 246,
        defense: 120,
        stamina: 163,
        type_1_id: 2,
        type_2_id: 0,
        type1_name: "dark",
        type2_name: "none",
        moves: [
          move("Psycho Cut", "psychic", 1, 5, 600, 8),
          move("Dark Pulse", "dark", 0, 80, 3000, -50),
        ],
      }),
      variant({
        name: "Raikou",
        variant_id: "raikou-default",
        pokemon_id: 243,
        pokedex_number: 243,
        attack: 241,
        defense: 195,
        stamina: 207,
        type_1_id: 4,
        type_2_id: 0,
        type1_name: "electric",
        type2_name: "none",
        moves: [
          move("Thunder Shock", "electric", 1, 5, 600, 8),
          move("Wild Charge", "electric", 0, 90, 2600, -50),
        ],
        raid_boss: [
          {
            id: 2,
            tier: "5",
            min_unboosted_cp: 1889,
            max_unboosted_cp: 1972,
            min_boosted_cp: 2361,
            max_boosted_cp: 2466,
          },
        ],
      }),
      variant({
        name: "Shiny Tyranitar",
        variant_id: "tyranitar-shiny",
        pokemon_id: 248,
        pokedex_number: 248,
        variantType: "shiny",
        moves: [
          move("Bite", "dark", 1, 6, 500, 4),
          move("Brutal Swing", "dark", 0, 65, 1900, -33),
        ],
      }),
    ];
  });

  it("renders loading spinner while variants are loading", () => {
    mocks.storeState.variantsLoading = true;

    renderRaid();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders the selected boss and metadata-backed raid tier", () => {
    renderRaid();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));

    expect(
      screen.getByRole("button", { name: "Boss counters" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Build a raid team/i)).not.toBeInTheDocument();
    expect(screen.getByText("Raid setup").closest("details")).not.toHaveAttribute(
      "open",
    );
    openRaidSetup();
    const raidSummary = screen.getByLabelText("Raid summary");
    expect(within(raidSummary).getByText("Legendary Raid")).toBeInTheDocument();
    expect(within(raidSummary).getByText("Boss HP")).toBeInTheDocument();
    expect(within(raidSummary).getByText("Minimum")).toBeInTheDocument();
    expect(within(raidSummary).getByText("Comfortable")).toBeInTheDocument();
    expect(within(raidSummary).getByText("Team DPS")).toBeInTheDocument();
    const estimateRules = within(raidSummary)
      .getByText("Team estimate rules")
      .closest("details");
    expect(estimateRules).not.toHaveAttribute("open");
    fireEvent.click(within(raidSummary).getByText("Team estimate rules"));
    expect(estimateRules).toHaveAttribute("open");
    expect(
      screen.getByText((_, element) => element?.textContent === "1889–1972"),
    ).toBeInTheDocument();
    const bossPicker = screen.getByLabelText("Raid boss picker");
    expect(
      within(bossPicker).getByRole("heading", { name: "Raikou" }),
    ).toBeInTheDocument();
    expect(within(bossPicker).getByLabelText("Find boss")).toHaveAttribute(
      "placeholder",
      "Search raid bosses",
    );
    expect(within(bossPicker).queryByText("Pokemon")).not.toBeInTheDocument();
    const battleSettings = screen.getByText("Battle settings").closest("details");
    expect(battleSettings).not.toHaveAttribute("open");
    expect(screen.getByText("Standard conditions")).toBeInTheDocument();
  });

  it("builds and simulates a heterogeneous raid party", async () => {
    renderRaid();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    openRaidSetup();
    fireEvent.click(
      await screen.findByRole("button", { name: /Custom raid party/i }),
    );

    expect(screen.getByLabelText("Custom raid party")).toBeInTheDocument();
    expect(screen.getByLabelText("Trainer 1 team slot 1")).not.toHaveValue("");
    const trainerOne = screen
      .getByText("Trainer 1", { selector: "strong" })
      .closest("details");
    expect(trainerOne).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Add Trainer" }));
    expect(screen.getByText("3 Trainers")).toBeInTheDocument();
    const lobbyControls = screen.getByLabelText("Lobby controls");
    expect(
      within(lobbyControls).getByRole("button", { name: "Add Trainer" }),
    ).toBeInTheDocument();
    expect(
      within(lobbyControls).getByRole("button", { name: "Simulate" }),
    ).toBeInTheDocument();
    expect(trainerOne).not.toHaveAttribute("open");
    expect(
      screen.getByText("Trainer 3", { selector: "strong" }).closest("details"),
    ).toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: /^Simulate$/ }));
    const result = await screen.findByLabelText("Raid party result");

    expect(within(result).getByText(/Clear|Time expired/)).toBeInTheDocument();
    expect(within(result).getAllByText(/DPS/).length).toBeGreaterThan(0);
    expect(within(lobbyControls).getByText(/Clear|Time expired/)).toBeInTheDocument();

    const calibration = screen.getByLabelText("Observed raid calibration");
    fireEvent.click(
      within(calibration).getByRole("button", { name: "Log raid" }),
    );
    const dialog = screen.getByRole("dialog", { name: /Log .* raid/i });
    expect(within(dialog).getByLabelText("Trainers")).toHaveValue(3);
  });

  it("records and clears a private observed raid result", async () => {
    renderRaid();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    openRaidSetup();
    const calibration = screen.getByLabelText("Observed raid calibration");
    expect(
      within(calibration).getByText("No raids logged on this device"),
    ).toBeInTheDocument();
    expect(
      within(calibration).queryByLabelText("Use observed dodges"),
    ).not.toBeInTheDocument();
    expect(within(calibration).queryByText("TTW error")).not.toBeInTheDocument();

    fireEvent.click(
      within(calibration).getByRole("button", { name: "Log raid" }),
    );
    const dialog = screen.getByRole("dialog", { name: /Log Raikou raid/i });
    fireEvent.change(within(dialog).getByLabelText("Battle time (seconds)"), {
      target: { value: "142.5" },
    });
    fireEvent.change(within(dialog).getByLabelText("Dodges attempted"), {
      target: { value: "4" },
    });
    fireEvent.change(within(dialog).getByLabelText("Dodges successful"), {
      target: { value: "3" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Measured latency/i), {
      target: { value: "85" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save result" }),
    );

    expect(
      screen.queryByRole("dialog", { name: /Log Raikou raid/i }),
    ).not.toBeInTheDocument();
    expect(within(calibration).getByText("1")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("raidCalibrationObservations") ?? "[]"),
    ).toHaveLength(1);

    fireEvent.click(
      within(calibration).getByRole("button", {
        name: "Clear observed raid data",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem("raidCalibrationObservations") ?? "[]"),
      ).toEqual([]);
    });
  });

  it("does not apply observations from an older simulation model", () => {
    localStorage.setItem(
      "raidCalibrationObservations",
      JSON.stringify([
        {
          schemaVersion: 1,
          id: "old-model-observation",
          recordedAt: "2026-07-17T00:00:00.000Z",
          ownerKey: "signed-out-device",
          modelVersion: RAID_SIMULATION_MODEL_VERSION - 1,
          catalogVersion: "old-catalog",
          bossVariantId: "raikou-default",
          bossName: "Raikou",
          tierKey: "legendary",
          dodgeCalibrationApplied: false,
          predicted: {
            clearTimeSeconds: 150,
            faints: 6,
            relobbies: 1,
          },
          actual: {
            trainerCount: 2,
            clearTimeSeconds: 140,
            faints: 5,
            relobbies: 1,
            dodgeAttempts: 4,
            successfulDodges: 4,
            latencyMs: 80,
          },
        },
      ]),
    );

    renderRaid();
    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    openRaidSetup();
    const calibration = screen.getByLabelText("Observed raid calibration");

    expect(
      within(calibration).getByText("No raids logged on this device"),
    ).toBeInTheDocument();
    expect(within(calibration).queryByText("Raids")).not.toBeInTheDocument();
    expect(
      within(calibration).queryByLabelText("Clear observed raid data"),
    ).not.toBeInTheDocument();
  });

  it("keeps raid boss choices hidden until searching", () => {
    renderRaid();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));

    expect(
      screen.queryByLabelText("Raid boss suggestions"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/find boss/i), {
      target: { value: "raikou" },
    });

    const suggestions = screen.getByLabelText("Raid boss suggestions");
    fireEvent.click(
      within(suggestions).getByRole("button", { name: /raikou/i }),
    );

    expect(screen.getByRole("heading", { name: "Raikou" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Raid boss suggestions"),
    ).not.toBeInTheDocument();
  });

  it("supports current raid modifiers and filters eligible counter results", () => {
    renderRaid();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    openRaidSetup();
    const battleSettings = screen.getByText("Battle settings").closest("details");
    expect(battleSettings).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Battle settings").closest("summary")!);
    expect(battleSettings).toHaveAttribute("open");

    expect(screen.getByLabelText(/relobby delay/i)).toHaveValue("10");
    expect(screen.getByLabelText(/boss behavior/i)).toHaveValue("expected");
    expect(screen.getByLabelText(/dodging/i)).toHaveValue("none");
    expect(
      screen.queryByLabelText(/Party Power timing/i),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Party Power$/i), {
      target: { value: "party4" },
    });
    expect(screen.getByText("1 custom setting")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Party Power timing/i), {
      target: { value: "strongest-charged" },
    });
    expect(screen.getByLabelText(/Party Power timing/i)).toHaveValue(
      "strongest-charged",
    );
    expect(
      within(screen.getByLabelText("Raid counters")).getAllByText(/faints/)
        .length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/boss behavior/i), {
      target: { value: "monte-carlo" },
    });
    expect(screen.getByLabelText(/boss behavior/i)).toHaveValue("monte-carlo");
    fireEvent.change(screen.getByLabelText(/dodging/i), {
      target: { value: "charged" },
    });
    expect(screen.getByLabelText(/dodging/i)).toHaveValue("charged");
    expect(
      screen.getAllByLabelText(/based on \d+ modeled outcomes/i).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Shadow raid" }));
    expect(screen.getByText("Purified Gem reminder")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/counter search/i), {
      target: { value: "tyranitar" },
    });

    const counterList = screen.getByLabelText("Raid counters");
    expect(within(counterList).getByText("Tyranitar")).toBeInTheDocument();
    expect(within(counterList).queryByText("Gengar")).not.toBeInTheDocument();
    expect(
      within(counterList).queryByText("Shiny Tyranitar"),
    ).not.toBeInTheDocument();

    const bestMoveset = screen.getByRole("button", { name: "Best moveset" });
    const allMovesets = screen.getByRole("button", { name: "All movesets" });
    expect(bestMoveset).toHaveAttribute("aria-pressed", "true");
    expect(allMovesets).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(allMovesets);

    expect(bestMoveset).toHaveAttribute("aria-pressed", "false");
    expect(allMovesets).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on an overall raid attacker leaderboard", () => {
    renderRaid();

    expect(
      screen.getByRole("button", { name: "Attacker rankings" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "By type" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Top raid attackers" }),
    ).toBeInTheDocument();
    const methodLink = screen.getByRole("link", { name: "Ranking method" });
    expect(methodLink).toHaveAttribute("href", "/raid/methodology");
    expect(methodLink).not.toHaveAttribute("target", "_blank");
    expect(methodLink).toHaveAttribute(
      "title",
      "How raid rankings are calculated",
    );
    const typeFilter = screen.getByLabelText("Attacker type filter");
    expect(
      within(typeFilter).getByRole("button", { name: "All types" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Boss CP")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/relobby delay/i)).not.toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: "Settings" });
    expect(settingsButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(settingsButton);

    expect(settingsButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/friendship/i)).toHaveValue("none");
    expect(screen.getByLabelText(/relobby delay/i)).toHaveValue("10");
    expect(screen.queryByLabelText(/boss movesets/i)).not.toBeInTheDocument();

    const counterList = screen.getByLabelText("Top raid attackers");
    expect(
      within(counterList).getByRole("columnheader", { name: "Pokémon" }),
    ).toBeInTheDocument();
    expect(
      within(counterList).getByRole("columnheader", { name: "Moves" }),
    ).toBeInTheDocument();
    for (const metric of ["eDPS", "DPS", "TDO", "ER", "CP"]) {
      expect(
        within(counterList).getByRole("button", {
          name: new RegExp(`Sort by ${metric}`, "i"),
        }),
      ).toBeInTheDocument();
    }
    expect(within(counterList).getByText("Gengar")).toBeInTheDocument();
    expect(
      within(counterList).queryByText("Shiny Tyranitar"),
    ).not.toBeInTheDocument();
    expect(
      within(counterList).getByLabelText("Fast move: Lick, Ghost type"),
    ).toBeInTheDocument();
    expect(
      within(counterList).getAllByAltText("Ghost type").length,
    ).toBeGreaterThan(0);
    expect(
      within(counterList).queryByText("Fast Ghost"),
    ).not.toBeInTheDocument();
    expect(
      within(counterList).getByLabelText("Rank 1, gold podium"),
    ).toHaveClass("raid-type-table-rank--gold");
    expect(
      within(counterList).getByLabelText("Rank 2, silver podium"),
    ).toHaveClass("raid-type-table-rank--silver");
    expect(
      within(counterList).getByLabelText("Rank 3, bronze podium"),
    ).toHaveClass("raid-type-table-rank--bronze");
    expect(within(counterList).getByLabelText("Rank 4")).toHaveClass(
      "raid-type-table-rank--standard",
    );
  });

  it("uses the same caught roster across overall, type, and boss rankings", async () => {
    const tyranitar = mocks.storeState.variants.find(
      (entry) => entry.variant_id === "tyranitar-default",
    )!;
    const fastMove = tyranitar.moves.find((entry) => entry.is_fast === 1)!;
    const chargedMove = tyranitar.moves.find((entry) => entry.is_fast === 0)!;
    useAuthStore.setState({ isLoggedIn: true });
    useInstancesStore.setState({
      instancesLoading: false,
      instances: {
        tyranitar: {
          instance_id: "tyranitar",
          variant_id: tyranitar.variant_id,
          pokemon_id: tyranitar.pokemon_id,
          nickname: "Stonewall",
          is_caught: true,
          disabled: false,
          cp: 3210,
          level: 35,
          attack_iv: 15,
          defense_iv: 14,
          stamina_iv: 13,
          fast_move_id: fastMove.move_id,
          charged_move1_id: chargedMove.move_id,
          charged_move2_id: null,
        } as PokemonInstance,
      },
    });

    renderRaid();

    expect(
      screen.getByRole("heading", { name: "Your top raid attackers" }),
    ).toBeInTheDocument();
    const overall = screen.getByLabelText("Your top raid attackers");
    expect(within(overall).getByText("Tyranitar")).toBeInTheDocument();
    expect(within(overall).queryByText("Gengar")).not.toBeInTheDocument();
    expect(
      within(overall).getByText(/Stonewall · Level 35 · 93% IV/),
    ).toBeInTheDocument();
    expect(within(overall).getByText("3,210")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByLabelText(/attacker level/i)).not.toBeInTheDocument();

    const typeFilter = screen.getByLabelText("Attacker type filter");
    const darkButton = within(typeFilter).getByRole("button", {
      name: "Dark",
    });
    fireEvent.click(darkButton);
    expect(
      within(screen.getByLabelText("Your top Dark raid attackers")).getByText(
        "Tyranitar",
      ),
    ).toBeInTheDocument();
    expect(darkButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "All Pokémon" }));
    expect(
      screen.getByRole("heading", { name: "Top Dark raid attackers" }),
    ).toBeInTheDocument();
    expect(darkButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "My Pokémon" }));
    expect(
      screen.getByRole("heading", { name: "Your top Dark raid attackers" }),
    ).toBeInTheDocument();
    expect(darkButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    expect(
      await within(screen.getByLabelText("Raid counters")).findByText(
        "Tyranitar",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Stonewall · Level 35 · 93% IV/),
    ).toBeInTheDocument();
  });

  it("does not rank an incomplete catch with level 50 catalog assumptions", () => {
    const regigigas = variant({
      name: "Shadow Regigigas",
      variant_id: "regigigas-shadow",
      pokemon_id: 486,
      pokedex_number: 486,
      variantType: "shadow",
      attack: 287,
      defense: 210,
      stamina: 221,
      type1_name: "normal",
      type2_name: "none",
      moves: [
        move("Zen Headbutt", "psychic", 1, 12, 1100, 10),
        move("Crush Grip", "normal", 0, 150, 2600, -50),
      ],
    });
    mocks.storeState.variants.push(regigigas);
    useAuthStore.setState({ isLoggedIn: true });
    useInstancesStore.setState({
      instancesLoading: false,
      instances: {
        regigigas: {
          instance_id: "regigigas",
          variant_id: regigigas.variant_id,
          pokemon_id: regigigas.pokemon_id,
          is_caught: true,
          disabled: false,
          cp: null,
          level: null,
          attack_iv: 15,
          defense_iv: 15,
          stamina_iv: 15,
          fast_move_id: regigigas.moves[0].move_id,
          charged_move1_id: regigigas.moves[1].move_id,
          charged_move2_id: null,
        } as PokemonInstance,
      },
    });

    renderRaid();

    expect(
      within(screen.getByRole("button", { name: "My Pokémon" })).getByText("0"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /1 caught entries need complete battle details/i,
    );
    expect(
      screen.queryByRole("cell", { name: /Shadow Regigigas/i }),
    ).not.toBeInTheDocument();
  });

  it("normalizes the padded Mega Mewtwo Y artwork in raid layouts", () => {
    mocks.storeState.variants = [
      variant({
        name: "Mega Mewtwo Y",
        variant_id: "mewtwo-mega-y",
        pokemon_id: 150,
        pokedex_number: 150,
        variantType: "mega_y",
        megaForm: "Y",
        currentImage: "/images/mega/mega_150_Y.png?v=content-hash",
      }),
    ];

    const { container } = renderRaid();
    const image = container.querySelector<HTMLImageElement>(
      'img[src*="/images/mega/mega_150_Y.png"]',
    );

    expect(image).not.toBeNull();
    expect(image).toHaveClass("raid-pokemon-image--mega-mewtwo-y");
  });

  it("sorts the overall leaderboard by every displayed raid metric", () => {
    renderRaid();

    const counterList = screen.getByLabelText("Top raid attackers");
    const eDpsSort = within(counterList).getByRole("button", {
      name: /Sort by eDPS/i,
    });
    expect(eDpsSort.closest("th")).toHaveAttribute("aria-sort", "descending");

    const cpSort = within(counterList).getByRole("button", {
      name: /Sort by CP/i,
    });
    fireEvent.click(cpSort);

    expect(cpSort.closest("th")).toHaveAttribute("aria-sort", "descending");
    const descendingRows = within(counterList).getAllByRole("row").slice(1);
    const pokemonName = (row: HTMLElement | undefined) =>
      row?.querySelector(".raid-type-table-pokemon-copy strong")?.textContent;
    const descendingFirst = pokemonName(descendingRows[0]);
    const descendingLast = pokemonName(descendingRows.at(-1));

    fireEvent.click(cpSort);

    expect(cpSort.closest("th")).toHaveAttribute("aria-sort", "ascending");
    const ascendingRows = within(counterList).getAllByRole("row").slice(1);
    expect(pokemonName(ascendingRows[0])).toBe(descendingLast);
    expect(pokemonName(ascendingRows.at(-1))).toBe(descendingFirst);

    for (const metric of ["DPS", "TDO", "ER"]) {
      const metricSort = within(counterList).getByRole("button", {
        name: new RegExp(`Sort by ${metric}`, "i"),
      });
      fireEvent.click(metricSort);
      expect(metricSort.closest("th")).toHaveAttribute(
        "aria-sort",
        "descending",
      );
    }
  });

  it("makes every mobile ranking row explicitly expandable for all stats", () => {
    renderRaid();

    const leaderboard = screen.getByLabelText("Top raid attackers");
    const toggle = within(leaderboard).getAllByRole("button", {
      name: /Show all raid stats for/i,
    })[0]!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(toggle).getByText("Tap for all stats")).toBeInTheDocument();
    expect(within(toggle).getByText("eDPS")).toBeInTheDocument();

    const row = toggle.closest("tr");
    expect(row).not.toBeNull();
    expect(
      Array.from(row!.querySelectorAll("td[data-label]")).map((cell) =>
        cell.getAttribute("data-label"),
      ),
    ).toEqual(["eDPS", "DPS", "TDO", "ER", "CP"]);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(toggle).getByText("Hide extra stats")).toBeInTheDocument();
    expect(row).toHaveClass("raid-ranking-row--expanded");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(row).not.toHaveClass("raid-ranking-row--expanded");
  });

  it("keeps historical boss typings out of neutral overall moveset selection", () => {
    const bossOnlyMoves = [
      move("Tackle", "normal", 1, 0, 500, 6),
      move("Struggle", "normal", 0, 0, 2000, -33),
    ];

    mocks.storeState.variants = [
      variant({
        name: "Mega Mewtwo Y",
        variant_id: "mewtwo-mega-y",
        pokemon_id: 150,
        pokedex_number: 150,
        attack: 388,
        defense: 202,
        stamina: 228,
        type1_name: "psychic",
        type2_name: "none",
        variantType: "mega",
        moves: [
          move("Psycho Cut", "psychic", 1, 5, 600, 8),
          move("Confusion", "psychic", 1, 20, 1600, 15),
          move("Psystrike", "psychic", 0, 95, 2300, -50),
          move("Shadow Ball", "ghost", 0, 100, 3000, -50),
        ],
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        variant({
          name: `Psychic Boss ${index + 1}`,
          variant_id: `target-psychic-${index + 1}`,
          pokemon_id: 9000 + index,
          pokedex_number: 9000 + index,
          type1_name: "psychic",
          type2_name: "none",
          moves: bossOnlyMoves,
          raid_boss: [
            {
              id: 9000 + index,
              tier: "5",
              form: "Normal",
              name: `Psychic Boss ${index + 1}`,
            },
          ],
        }),
      ),
    ];

    renderRaid();

    const counterList = screen.getByLabelText("Top raid attackers");
    const dataRows = within(counterList).getAllByRole("row").slice(1);

    expect(dataRows[0]).toHaveTextContent("Mega Mewtwo Y");
    expect(dataRows[0]).toHaveTextContent("Psystrike");
    expect(dataRows[0]).not.toHaveTextContent("Shadow Ball");
  });

  it("labels Hidden Power with the modeled type and matching type icon", () => {
    mocks.storeState.variants = [
      variant({
        name: "Shadow Regigigas",
        variant_id: "regigigas-shadow",
        pokemon_id: 486,
        pokedex_number: 486,
        attack: 287,
        defense: 210,
        stamina: 221,
        type1_name: "normal",
        type2_name: "none",
        variantType: "shadow",
        moves: [
          move("Hidden Power", "normal", 1, 15, 1500, 15),
          move("Giga Impact", "normal", 0, 200, 4700, -100),
        ],
      }),
      variant({
        name: "Electric Raid Boss",
        variant_id: "electric-raid-boss",
        pokemon_id: 9000,
        pokedex_number: 9000,
        type1_name: "electric",
        type2_name: "none",
        moves: [
          move("Tackle", "normal", 1, 0, 500, 6),
          move("Struggle", "normal", 0, 0, 2000, -33),
        ],
        raid_boss: [
          { id: 9000, tier: "5", form: "Normal", name: "Electric Raid Boss" },
        ],
      }),
    ];

    renderRaid();

    const counterList = screen.getByLabelText("Top raid attackers");
    expect(
      within(counterList).getByLabelText(
        "Fast move: Hidden Power (Ground), Ground type",
      ),
    ).toBeInTheDocument();
    expect(within(counterList).getByAltText("Ground type")).toBeInTheDocument();
    expect(
      within(counterList).queryByLabelText(
        "Fast move: Hidden Power, Normal type",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows one ordinary raid entry instead of Dynamax and Gigantamax copies", () => {
    const metagrossRaid = [
      { id: 376, tier: "3", form: "Normal", name: "Metagross" },
    ];
    mocks.storeState.variants = [
      variant({
        name: "Metagross",
        variant_id: "metagross-default",
        pokemon_id: 376,
        pokedex_number: 376,
        raid_boss: metagrossRaid,
      }),
      variant({
        name: "Dynamax Metagross",
        variant_id: "metagross-dynamax",
        pokemon_id: 376,
        pokedex_number: 376,
        variantType: "dynamax",
        raid_boss: metagrossRaid,
      }),
      variant({
        name: "Gigantamax Metagross",
        variant_id: "metagross-gigantamax",
        pokemon_id: 376,
        pokedex_number: 376,
        variantType: "gigantamax",
        raid_boss: metagrossRaid,
      }),
    ];

    renderRaid();

    fireEvent.change(screen.getByLabelText(/attacker search/i), {
      target: { value: "metagross" },
    });
    const leaderboard = screen.getByLabelText("Top raid attackers");
    expect(within(leaderboard).getByText("Metagross")).toBeInTheDocument();
    expect(
      within(leaderboard).queryByText("Dynamax Metagross"),
    ).not.toBeInTheDocument();
    expect(
      within(leaderboard).queryByText("Gigantamax Metagross"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Boss counters" }));
    fireEvent.change(screen.getByLabelText(/find boss/i), {
      target: { value: "metagross" },
    });
    const suggestions = screen.getByLabelText("Raid boss suggestions");
    expect(within(suggestions).getAllByRole("button")).toHaveLength(1);
    expect(within(suggestions).getByRole("button")).toHaveTextContent(
      "Metagross",
    );
  });

  it("filters the shared leaderboard by type and returns explicitly to overall", () => {
    renderRaid();

    const typeFilter = screen.getByLabelText("Attacker type filter");
    const overallButton = within(typeFilter).getByRole("button", {
      name: "All types",
    });
    const darkButton = within(typeFilter).getByRole("button", { name: "Dark" });

    expect(overallButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(darkButton);

    expect(darkButton).toHaveAttribute("aria-pressed", "true");
    expect(overallButton).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("heading", { name: "Top Dark raid attackers" }),
    ).toBeInTheDocument();

    const counterList = screen.getByLabelText("Top Dark raid attackers");
    expect(
      within(counterList).getByRole("columnheader", { name: "Pokémon" }),
    ).toBeInTheDocument();
    expect(
      within(counterList).getByRole("columnheader", { name: "Moves" }),
    ).toBeInTheDocument();
    for (const metric of ["eDPS", "DPS", "TDO", "ER", "CP"]) {
      expect(
        within(counterList).getByRole("button", {
          name: new RegExp(`Sort by ${metric}`, "i"),
        }),
      ).toBeInTheDocument();
    }
    const tdoSort = within(counterList).getByRole("button", {
      name: /Sort by TDO/i,
    });
    fireEvent.click(tdoSort);
    expect(tdoSort.closest("th")).toHaveAttribute("aria-sort", "descending");
    expect(within(counterList).getByText("Tyranitar")).toBeInTheDocument();
    expect(within(counterList).getByText("Absol")).toBeInTheDocument();
    expect(within(counterList).queryByText("Gengar")).not.toBeInTheDocument();
    expect(
      within(counterList).queryByText("Shiny Tyranitar"),
    ).not.toBeInTheDocument();
    expect(
      within(counterList).getAllByAltText("Dark type").length,
    ).toBeGreaterThan(0);
    expect(
      within(counterList).queryByText("Charged Dark"),
    ).not.toBeInTheDocument();

    fireEvent.click(overallButton);
    expect(overallButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "Top raid attackers" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Top raid attackers")).toBeInTheDocument();
  });
});
