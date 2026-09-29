import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Profile from "@/pages/Trainer/Profile";

const render = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  fetchOwnProfile: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  deleteRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockTrainer: vi.fn(),
  updateProfile: vi.fn(),
  updateUserDetails: vi.fn(),
  fetchLocationSuggestions: vi.fn(),
}));

vi.mock("@/services/socialService", () => ({
  fetchTrainerProfile: mocks.fetchProfile,
  fetchOwnTrainerProfile: mocks.fetchOwnProfile,
  sendFriendRequest: mocks.sendRequest,
  acceptFriendRequest: mocks.acceptRequest,
  deleteFriendRequest: mocks.deleteRequest,
  removeFriend: mocks.removeFriend,
  blockTrainer: mocks.blockTrainer,
  updateTrainerProfile: mocks.updateProfile,
}));

vi.mock("@/services/locationServices", () => ({
  fetchSuggestions: mocks.fetchLocationSuggestions,
  fetchLocationOptions: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ updateUserDetails: mocks.updateUserDetails }),
}));

vi.mock("@/contexts/ModalContext", () => ({
  useModal: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (
    selector: (state: {
      user: {
        user_id: string;
        username: string;
        pokemonGoName: string;
        trainerCode: string;
        location: string;
      };
    }) => unknown,
  ) =>
    selector({
      user: {
        user_id: "user-adam",
        username: "Adam",
        pokemonGoName: "Adam",
        trainerCode: "",
        location: "",
      },
    }),
}));

vi.mock("@/features/variants/store/useVariantsStore", () => ({
  useVariantsStore: (
    selector: (state: {
      variants: Array<{
        variant_id: string;
        species_name: string;
        variantType: "default";
        currentImage: string;
        image_url: string;
      }>;
    }) => unknown,
  ) =>
    selector({
      variants: [
        {
          variant_id: "v-lucario",
          species_name: "Lucario",
          variantType: "default",
          currentImage: "/images/pokemon/lucario.png",
          image_url: "/images/pokemon/lucario.png",
        },
      ],
    }),
}));

vi.mock("@/features/instances/store/useInstancesStore", () => ({
  useInstancesStore: (
    selector: (state: {
      instances: Record<string, Record<string, unknown>>;
    }) => unknown,
  ) =>
    selector({
      instances: {
        lucario: {
          instance_id: "instance-lucario",
          variant_id: "v-lucario",
          pokemon_id: 448,
          nickname: null,
          cp: 2498,
          is_caught: true,
          disabled: false,
        },
        wanted: {
          instance_id: "instance-wanted",
          variant_id: "v-wanted",
          pokemon_id: 150,
          nickname: null,
          cp: null,
          is_caught: false,
          disabled: false,
        },
      },
    }),
}));

const profile = {
  user: {
    user_id: "user-misty",
    username: "Misty",
    pokemonGoName: "CeruleanLeader",
    team: "Mystic",
    trainer_level: 50,
    total_xp: 88_000_000,
    pogo_started_on: "2016-07-06T00:00:00Z",
    app_joined_at: "2026-01-01T00:00:00Z",
  },
  trainer_titles: ["raid-regular", "shiny-hunter"],
  stats: {
    caught: 12,
    for_trade: 3,
    wanted: 4,
    favorites: 5,
    registered: 10,
  },
  highlights: [],
  viewer: {
    relationship: "none",
    can_view_profile: true,
    can_view_collection: true,
  },
} as const;

const CatalogLocation = () => {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
};

describe("Trainer Profile", () => {
  beforeEach(() => {
    mocks.fetchProfile.mockResolvedValue(profile);
    mocks.fetchOwnProfile.mockResolvedValue(profile);
    mocks.sendRequest.mockResolvedValue({ friendship_id: "friend-1" });
  });

  it("shows the public trainer card and links to the trainer collection", async () => {
    render(
      <MemoryRouter initialEntries={["/profile/misty"]}>
        <Routes>
          <Route path="/profile/:username" element={<Profile />} />
          <Route
            path="/pokemon/:username"
            element={<div>Public collection</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("CeruleanLeader")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /misty's trainer card/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("88,000,000 XP")).toBeInTheDocument();
    expect(screen.getByText("Jul 6, 2016")).toBeInTheDocument();
    expect(screen.getByText("Raid Regular")).toBeInTheDocument();
    expect(screen.getByText("Shiny Hunter")).toBeInTheDocument();
    expect(
      screen
        .getByText("Raid Regular")
        .closest(".trainer-title-badge")
        ?.querySelector('[data-title-asset="/images/raid_face.png"]'),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("Shiny Hunter")
        .closest(".trainer-title-badge")
        ?.querySelector('[data-title-asset="/images/shiny_search.png"]'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/empty featured pokemon slot/i),
    ).toHaveLength(6);
    expect(screen.getByLabelText(/collection summary/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    const collectionSummary = screen.getByLabelText(/collection summary/i);
    expect(
      Array.from(
        collectionSummary.querySelectorAll(
          ".trainer-card-collection-label",
        ),
      ).map((label) => label.textContent),
    ).toEqual([
      "Registered",
      "Caught",
      "For trade",
      "Wanted",
      "Favorites",
    ]);
    expect(
      collectionSummary.querySelector(
        '[data-collection-icon="registered"]',
      ),
    ).toHaveStyle({
      maskImage: 'url("/images/kanto_search.png")',
    });
    expect(
      collectionSummary.querySelector('[data-collection-icon="caught"]'),
    ).toHaveStyle({
      maskImage: 'url("/images/pokeball-solid-mask.svg")',
    });
    expect(
      collectionSummary.querySelector(
        '[data-collection-icon="for-trade"]',
      ),
    ).toHaveStyle({
      maskImage: 'url("/images/pogo_trade_icon.png")',
    });

    fireEvent.click(screen.getByRole("button", { name: /view pokemon/i }));
    expect(screen.getByText("Public collection")).toBeInTheDocument();
  });

  it.each([
    ["caught", "/pokemon/Misty?filter=caught"],
    ["for trade", "/pokemon/Misty?filter=trade"],
    ["wanted", "/pokemon/Misty?filter=wanted"],
    ["favorites", "/pokemon/Misty?filter=favorites"],
  ])(
    "links the %s summary to that public collection filter",
    async (summary, expectedLocation) => {
      render(
        <MemoryRouter initialEntries={["/profile/misty"]}>
          <Routes>
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/pokemon/:username" element={<CatalogLocation />} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.click(
        await screen.findByRole("button", {
          name: new RegExp(`view misty's ${summary} pokemon`, "i"),
        }),
      );

      expect(screen.getByText(expectedLocation)).toBeInTheDocument();
    },
  );

  it("keeps Registered informational because it has no catalog destination", async () => {
    render(
      <MemoryRouter initialEntries={["/profile/misty"]}>
        <Routes>
          <Route path="/profile/:username" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    const summary = await screen.findByLabelText(/collection summary/i);
    expect(within(summary).getByText("Registered")).toBeInTheDocument();
    expect(
      within(summary).queryByRole("button", { name: /registered/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps collection metrics informational when the collection is private", async () => {
    mocks.fetchProfile.mockResolvedValue({
      ...profile,
      viewer: {
        ...profile.viewer,
        can_view_collection: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/profile/misty"]}>
        <Routes>
          <Route path="/profile/:username" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    const summary = await screen.findByLabelText(/collection summary/i);
    expect(within(summary).queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /view pokemon/i }),
    ).not.toBeInTheDocument();
  });

  it("sends a friend request from a public profile action", async () => {
    render(
      <MemoryRouter initialEntries={["/profile/misty"]}>
        <Routes>
          <Route path="/profile/:username" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /add friend/i }));
    await waitFor(() =>
      expect(mocks.sendRequest).toHaveBeenCalledWith("Misty"),
    );
  });

  it("keeps location selection in the draft until Save and discards it on Cancel", async () => {
    const ownProfile = {
      ...profile,
      location: "Vernon",
      user: { ...profile.user, user_id: "user-adam", username: "Adam", pokemonGoName: "Adam" },
      viewer: { relationship: "self", can_view_profile: true, can_view_collection: true },
    };
    mocks.updateProfile.mockClear().mockResolvedValue({ success: true });
    mocks.updateUserDetails.mockClear().mockResolvedValue({ success: true });
    mocks.fetchOwnProfile.mockResolvedValue(ownProfile);
    mocks.fetchLocationSuggestions.mockResolvedValue([
      { displayName: "Kelowna, British Columbia, Canada" },
    ]);
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes><Route path="/profile" element={<Profile />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), {
      target: { value: "Kelowna" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Kelowna, British Columbia, Canada" }));
    expect(mocks.updateUserDetails).not.toHaveBeenCalled();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByRole("textbox", { name: "Location" })).toHaveValue("Vernon");

    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), {
      target: { value: "Kelowna" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Kelowna, British Columbia, Canada" }));
    mocks.fetchOwnProfile.mockResolvedValue({ ...ownProfile, location: "Kelowna, British Columbia, Canada" });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ location: "Kelowna, British Columbia, Canada" }),
    ));
    expect(mocks.updateUserDetails).toHaveBeenCalledWith("user-adam", {
      pokemonGoName: "Adam",
      trainerCode: "",
      location: "Kelowna, British Columbia, Canada",
    });
    expect(await screen.findByText("Kelowna, British Columbia, Canada")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Location" })).not.toBeInTheDocument();
  });

  it("saves caught Pokemon selected for the owner showcase", async () => {
    const ownProfile = {
      ...profile,
      user: {
        ...profile.user,
        user_id: "user-adam",
        username: "Adam",
        pokemonGoName: "Adam",
      },
      viewer: {
        relationship: "self",
        can_view_profile: true,
        can_view_collection: true,
      },
    };
    mocks.fetchOwnProfile.mockResolvedValue(ownProfile);
    mocks.updateProfile.mockResolvedValue({ success: true });
    mocks.updateUserDetails.mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    const card = screen.getByRole("region", {
      name: /adam's trainer card/i,
    });
    expect(within(card).getByLabelText(/pokemon go name/i)).toHaveValue("Adam");
    expect(
      screen.queryByRole("heading", { name: /edit profile/i }),
    ).not.toBeInTheDocument();
    const titlePicker = within(card).getByRole("group", {
      name: /trainer titles/i,
    });
    ([
      ["Raid Regular", ["/images/raid_face.png"]],
      ["Shadow Raider", ["/images/shadow_search.png"]],
      ["Super Mega Raider", ["/images/pokemon_details_cp_mega.png"]],
      ["Max Battler", ["/images/gigantamax_title_mask.png"]],
      ["Battle League Trainer", ["/images/pvp_title_mask.png"]],
      ["Rocket Hunter", ["/images/teamrocket_r_full.png"]],
      ["Shiny Hunter", ["/images/shiny_search.png"]],
      ["Pokedex Collector", ["/images/kanto_search.png"]],
      ["Costume Collector", ["/images/costume_search.png"]],
      ["Hundo Hunter", ["/images/appraisal_04.png"]],
      ["Lucky Trader", ["/images/lucky-icon.png"]],
      ["Egg Hatcher", ["/images/ic_egg_inv.png"]],
      ["Route Explorer", ["/images/route_icon.png"]],
    ] satisfies Array<[string, string[]]>).forEach(([label, assets]) => {
      const choice = within(titlePicker).getByRole("button", {
        name: new RegExp(`^${label}`, "i"),
      });
      assets.forEach((asset) => {
        expect(
          choice.querySelector(`[data-title-asset="${asset}"]`),
        ).toBeInTheDocument();
      });
    });
    expect(
      within(titlePicker)
        .getByRole("button", { name: /^size collector/i })
        .querySelector(".trainer-title-visual-fallback svg"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(titlePicker).getByRole("button", {
        name: /egg hatcher/i,
      }),
    );
    expect(
      within(titlePicker).getByRole("button", {
        name: /party player/i,
      }),
    ).toBeDisabled();
    fireEvent.click(
      within(titlePicker).getByRole("button", {
        name: /shiny hunter/i,
      }),
    );
    expect(
      within(titlePicker).getByRole("button", {
        name: /party player/i,
      }),
    ).toBeEnabled();
    fireEvent.click(
      within(titlePicker).getByRole("button", {
        name: /max battler/i,
      }),
    );
    expect(
      within(card).queryByLabelText(/choose pokemon for featured slot/i),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(card).getByRole("button", {
        name: /choose featured pokemon for slot 1/i,
      }),
    );
    const picker = within(card).getByLabelText(
      /choose pokemon for featured slot 1/i,
    );
    expect(
      within(picker).getByRole("button", {
        name: /choose lucario for featured slot 1/i,
      }),
    ).toBeEnabled();
    fireEvent.click(
      within(picker).getByRole("button", {
        name: /choose lucario for featured slot 1/i,
      }),
    );
    expect(
      within(card).queryByLabelText(/choose pokemon for featured slot/i),
    ).not.toBeInTheDocument();
    expect(
      within(card).getByRole("button", {
        name: /change featured pokemon in slot 1, currently lucario/i,
      }),
    ).toBeVisible();
    fireEvent.click(
      within(card).getByRole("button", { name: /save profile/i }),
    );

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          highlight_instance_ids: ["instance-lucario"],
          trainer_titles: [
            "raid-regular",
            "egg-hatcher",
            "max-battler",
          ],
        }),
      ),
    );
  });

  it("reorders featured Pokemon with the accessible keyboard gesture", async () => {
    const ownProfile = {
      ...profile,
      user: {
        ...profile.user,
        user_id: "user-adam",
        username: "Adam",
        pokemonGoName: "Adam",
      },
      highlights: [
        {
          instance_id: "featured-bulbasaur",
          variant_id: "0001-default",
          pokemon_id: 1,
          nickname: "Buddy",
          cp: 1115,
          is_caught: true,
          disabled: false,
        },
        {
          instance_id: "featured-charmander",
          variant_id: "0004-default",
          pokemon_id: 4,
          nickname: "Blaze",
          cp: 980,
          is_caught: true,
          disabled: false,
        },
      ],
      viewer: {
        relationship: "self",
        can_view_profile: true,
        can_view_collection: true,
      },
    };
    mocks.fetchOwnProfile.mockResolvedValue(ownProfile);
    mocks.updateProfile.mockResolvedValue({ success: true });
    mocks.updateUserDetails.mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    const card = screen.getByRole("region", {
      name: /adam's trainer card/i,
    });
    const buddySlot = within(card).getByRole("button", {
      name: /change featured pokemon in slot 1, currently buddy/i,
    });

    fireEvent.keyDown(buddySlot, {
      key: "ArrowRight",
      altKey: true,
    });

    expect(
      within(card).getByRole("button", {
        name: /change featured pokemon in slot 1, currently blaze/i,
      }),
    ).toBeVisible();
    expect(
      within(card).getByRole("button", {
        name: /change featured pokemon in slot 2, currently buddy/i,
      }),
    ).toBeVisible();

    fireEvent.click(
      within(card).getByRole("button", { name: /save profile/i }),
    );
    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          highlight_instance_ids: [
            "featured-charmander",
            "featured-bulbasaur",
          ],
        }),
      ),
    );
  });

  it("offers profile setup when the signed-in trainer has never customized it", async () => {
    mocks.fetchOwnProfile.mockResolvedValue({
      ...profile,
      user: {
        user_id: "user-adam",
        username: "Adam",
        app_joined_at: "2026-01-01T00:00:00Z",
      },
      trainer_titles: [],
      location: null,
      trainer_code: null,
      stats: {
        caught: 0,
        for_trade: 0,
        wanted: 0,
        favorites: 0,
        registered: 0,
      },
      highlights: [],
      preferences: {
        user_id: "user-adam",
        profile_visibility: "public",
        collection_visibility: "public",
        friend_request_permission: "everyone",
        trainer_code_visibility: "friends",
        show_location: false,
        show_pokemon_go_name: true,
      },
      viewer: {
        relationship: "self",
        can_view_profile: true,
        can_view_collection: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /make this trainer profile yours/i,
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /customize profile/i }));
    const card = screen.getByRole("region", {
      name: /adam's trainer card/i,
    });
    expect(within(card).getByLabelText(/pokemon go name/i)).toBeInTheDocument();
    expect(
      within(card).getByLabelText("Trainer level", { exact: true }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("group", { name: /trainer titles/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /edit profile/i }),
    ).not.toBeInTheDocument();
    expect(mocks.fetchProfile).not.toHaveBeenCalled();
  });

  it("cancels inline edits and restores the saved trainer card", async () => {
    const ownProfile = {
      ...profile,
      user: {
        ...profile.user,
        user_id: "user-adam",
        username: "Adam",
        pokemonGoName: "Adam",
      },
      viewer: {
        relationship: "self",
        can_view_profile: true,
        can_view_collection: true,
      },
    };
    mocks.fetchOwnProfile.mockResolvedValue(ownProfile);

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    const card = screen.getByRole("region", {
      name: /adam's trainer card/i,
    });
    fireEvent.change(within(card).getByLabelText(/pokemon go name/i), {
      target: { value: "Unsaved name" },
    });
    expect(within(card).getByLabelText(/pokemon go name/i)).toHaveValue(
      "Unsaved name",
    );

    fireEvent.click(within(card).getByRole("button", { name: /cancel/i }));

    expect(
      within(card).queryByLabelText(/pokemon go name/i),
    ).not.toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Adam" })).toBeVisible();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
