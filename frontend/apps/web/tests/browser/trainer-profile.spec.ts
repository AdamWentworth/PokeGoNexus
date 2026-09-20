import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

import { attachBrowserDiagnostics } from "./support/diagnostics";
import { installE2eRoutes } from "./support/e2eRoutes";

const trainerUser = {
  user_id: "trainer-card-user",
  username: "TrainerCard",
  email: "trainer-card@pokegonexus.local",
  pokemonGoName: "NexusTrainer",
  trainerCode: "123456789012",
  location: "Vancouver, BC",
  accessTokenExpiry: "2099-01-01T00:00:00.000Z",
  refreshTokenExpiry: "2099-01-02T00:00:00.000Z",
};

const trainerProfile = {
  user: {
    user_id: trainerUser.user_id,
    username: trainerUser.username,
    pokemonGoName: "NexusTrainer",
    team: "Mystic",
    trainer_level: 50,
    total_xp: 88_000_000,
    pogo_started_on: "2016-07-06T00:00:00Z",
    app_joined_at: "2026-01-01T00:00:00Z",
  },
  trainer_titles: ["raid-regular", "shiny-hunter", "egg-hatcher"],
  location: "Vancouver, BC",
  trainer_code: "123456789012",
  stats: {
    caught: 2247,
    for_trade: 83,
    wanted: 17,
    favorites: 155,
    registered: 1024,
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
      nickname: null,
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

async function seedTrainerLogin(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate((user) => {
    localStorage.setItem("user", JSON.stringify(user));
  }, trainerUser);
}

async function dragShowcaseSlot(
  page: Page,
  source: Locator,
  destination: Locator,
  useTouch: boolean,
) {
  const sourceBox = await source.boundingBox();
  const destinationBox = await destination.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(destinationBox).not.toBeNull();
  if (!sourceBox || !destinationBox) return;

  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const end = {
    x: destinationBox.x + destinationBox.width / 2,
    y: destinationBox.y + destinationBox.height / 2,
  };

  if (useTouch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, id: 1 }],
    });
    const preview = page.locator(".trainer-card-highlight-drag-preview");
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    expect(previewBox).not.toBeNull();
    if (previewBox) {
      expect(
        Math.abs(previewBox.x + previewBox.width / 2 - end.x),
      ).toBeLessThan(20);
      expect(
        Math.abs(previewBox.y + previewBox.height / 2 - end.y),
      ).toBeLessThan(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(preview).toHaveCount(0);
    await session.detach();
    return;
  }

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  const preview = page.locator(".trainer-card-highlight-drag-preview");
  await expect(preview).toBeVisible();
  const previewBox = await preview.boundingBox();
  expect(previewBox).not.toBeNull();
  if (previewBox) {
    expect(
      Math.abs(previewBox.x + previewBox.width / 2 - end.x),
    ).toBeLessThan(20);
    expect(
      Math.abs(previewBox.y + previewBox.height / 2 - end.y),
    ).toBeLessThan(20);
  }
  await page.mouse.up();
  await expect(preview).toHaveCount(0);
}

test.describe("Trainer profile card", () => {
  test("keeps a public trainer profile and its collection links available while signed out", async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page, { trainerProfile });
      await page.goto(`/profile/${trainerUser.username}`, { waitUntil: "domcontentloaded" });

      const card = page.getByRole("region", {
        name: `${trainerUser.username}'s trainer card`,
      });
      await expect(card).toBeVisible();
      await expect(card.getByText("Buddy")).toBeVisible();
      await expect(page.getByRole("button", { name: "Action Menu" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add friend" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Block trainer" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

      await card.getByRole("button", {
        name: `View ${trainerUser.username}'s caught Pokemon`,
      }).click();
      await expect(page).toHaveURL(new RegExp(
        `/pokemon/${trainerUser.username}\\?filter=caught$`,
        "i",
      ));
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test("keeps trainer identity, showcase, and collection facts visible without horizontal overflow", async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page, { trainerProfile });
      await seedTrainerLogin(page);
      await page.goto("/profile", { waitUntil: "domcontentloaded" });

      const card = page.getByRole("region", {
        name: `${trainerUser.username}'s trainer card`,
      });
      await expect(card).toBeVisible();
      await expect(
        card.getByRole("heading", { name: "NexusTrainer" }),
      ).toBeVisible();
      await expect(card.getByText("88,000,000 XP")).toBeVisible();
      await expect(card.getByText("Jul 6, 2016")).toBeVisible();
      await expect(card.getByText("Raid Regular")).toBeVisible();
      await expect(card.getByText("Shiny Hunter")).toBeVisible();
      await expect(card.getByText("Egg Hatcher")).toBeVisible();
      const raidTitleIcon = card.locator(
        '[data-title-asset="/images/raid_face.png"]',
      );
      await expect(raidTitleIcon).toBeVisible();
      expect(
        await raidTitleIcon.evaluate(
          (element) => window.getComputedStyle(element).backgroundColor,
        ),
      ).toBe("rgb(94, 177, 244)");
      await expect(
        card.getByLabel("Featured Pokemon", { exact: true }),
      ).toBeVisible();
      await expect(card.getByLabel("Collection summary")).toBeVisible();
      await expect(
        card.getByLabel("Empty featured Pokemon slot 6"),
      ).toBeVisible();

      const layout = await page.locator(".trainer-page").evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        cardWidth:
          document
            .querySelector(".trainer-profile-card")
            ?.getBoundingClientRect().width ?? 0,
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.cardWidth).toBeLessThanOrEqual(layout.viewportWidth);

      const screenshotPath = testInfo.outputPath("trainer-profile.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach("trainer profile", {
        path: screenshotPath,
        contentType: "image/png",
      });

      const collectionButton = card.getByRole("button", {
        name: "View Pokemon",
      });
      await collectionButton.scrollIntoViewIfNeeded();
      await expect(collectionButton).toBeVisible();
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });

  test("edits and reorders featured Pokemon slots", async ({
    page,
  }, testInfo) => {
    const diagnostics = attachBrowserDiagnostics(page, testInfo);

    try {
      await installE2eRoutes(page, { trainerProfile });
      await seedTrainerLogin(page);
      await page.goto("/profile", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Edit" }).click();

      const card = page.getByRole("region", {
        name: `${trainerUser.username}'s trainer card`,
      });
      await expect(card).toHaveCount(1);
      await expect(card.getByLabel("Pokemon GO name")).toHaveValue(
        "NexusTrainer",
      );
      await expect(
        card.getByLabel("Trainer level", { exact: true }),
      ).toHaveValue("50");

      await expect(
        card.getByLabel(/choose pokemon for featured slot/i),
      ).toHaveCount(0);
      const titlePicker = card.getByRole("group", {
        name: "Trainer titles",
      });
      await expect(titlePicker).toBeVisible();
      await expect(
        titlePicker.getByRole("button", { name: /raid regular/i }),
      ).toHaveAttribute("aria-pressed", "true");
      await titlePicker
        .getByRole("button", { name: /raid regular/i })
        .click();
      await titlePicker
        .getByRole("button", { name: /max battler/i })
        .click();
      await card
        .getByRole("button", {
          name: "Change featured Pokemon in slot 1, currently Buddy",
        })
        .click();

      const picker = card.getByLabel("Choose Pokemon for featured slot 1");
      await expect(picker).toBeVisible();
      await expect(
        picker.getByRole("button", {
          name: "Keep Buddy in featured slot 1",
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        picker.getByRole("button", {
          name: /already in featured slot 2/i,
        }),
      ).toBeDisabled();

      const layout = await page.locator(".trainer-page").evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);

      const screenshotPath = testInfo.outputPath(
        "trainer-card-inline-editor.png",
      );
      await card.screenshot({ path: screenshotPath });
      await testInfo.attach("trainer card inline editor", {
        path: screenshotPath,
        contentType: "image/png",
      });

      await picker.getByRole("button", { name: "Clear slot" }).click();
      await expect(
        card.getByLabel("Choose Pokemon for featured slot 1"),
      ).toHaveCount(0);
      await expect(
        card.getByRole("button", {
          name: "Change featured Pokemon in slot 1, currently Charmander",
        }),
      ).toBeVisible();
      await card
        .getByRole("button", {
          name: "Choose featured Pokemon for slot 2",
        })
        .click();
      await card
        .getByLabel("Choose Pokemon for featured slot 2")
        .getByRole("button", {
          name: "Choose Buddy for featured slot 2",
        })
        .click();
      await expect(
        card.getByLabel("Choose Pokemon for featured slot 2"),
      ).toHaveCount(0);
      await expect(
        card.getByRole("button", {
          name: "Change featured Pokemon in slot 2, currently Buddy",
        }),
      ).toBeVisible();

      const buddySlot = card.getByRole("button", {
        name: "Change featured Pokemon in slot 2, currently Buddy",
      });
      const charmanderSlot = card.getByRole("button", {
        name: "Change featured Pokemon in slot 1, currently Charmander",
      });
      await dragShowcaseSlot(
        page,
        buddySlot,
        charmanderSlot,
        testInfo.project.name === "mobile-chrome",
      );

      await expect(
        card.getByRole("button", {
          name: "Change featured Pokemon in slot 1, currently Buddy",
        }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", {
          name: "Change featured Pokemon in slot 2, currently Charmander",
        }),
      ).toBeVisible();
      await expect(
        card.getByLabel(/choose pokemon for featured slot/i),
      ).toHaveCount(0);
      await card.getByRole("button", { name: "Save profile" }).click();
      await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
      ).toBeVisible();
      await expect(card.getByText("Max Battler", { exact: true })).toBeVisible();
      await expect(
        card.getByText("Shiny Hunter", { exact: true }),
      ).toBeVisible();
      await expect(
        card.getByText("Egg Hatcher", { exact: true }),
      ).toBeVisible();
      await expect(
        card.getByText("Raid Regular", { exact: true }),
      ).toHaveCount(0);

      await page.reload({ waitUntil: "domcontentloaded" });
      const reloadedCard = page.getByRole("region", {
        name: `${trainerUser.username}'s trainer card`,
      });
      await expect(
        reloadedCard.getByText("Max Battler", { exact: true }),
      ).toBeVisible();
      await expect(
        reloadedCard.getByText("Raid Regular", { exact: true }),
      ).toHaveCount(0);
    } finally {
      await diagnostics.flush();
    }

    expect(diagnostics.blockingErrors()).toEqual([]);
  });
});
