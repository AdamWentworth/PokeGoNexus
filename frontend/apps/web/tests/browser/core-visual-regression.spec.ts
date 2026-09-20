import { expect, test, type Page } from "@playwright/test";

import { openActionMenu } from "./support/actionMenu";
import { installE2eRoutes } from "./support/e2eRoutes";

const addSignedInUser = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        accessTokenExpiry: "2099-01-01T00:00:00.000Z",
        allowLocation: false,
        email: "visual@example.test",
        location: "",
        pokemonGoName: "VisualTrainerGO",
        refreshTokenExpiry: "2099-01-02T00:00:00.000Z",
        trainerCode: "",
        user_id: "visual-user",
        username: "VisualTrainer",
      }),
    );
    window.localStorage.setItem(
      "pokegonexus-home-onboarding:visual-user",
      "dismissed",
    );
  });
};

const themeModes = ["dark", "light"] as const;
type ThemeMode = (typeof themeModes)[number];

const consolidatedPageBaselines: ReadonlyArray<{
  name: string;
  path: string;
  realImages?: boolean;
  readySelector?: string;
}> = [
  { name: "pokedex-catalog", path: "/pokedex" },
  { name: "trainer-settings", path: "/settings" },
  { name: "raid-planner", path: "/raid" },
  { name: "max-battles", path: "/max" },
  { name: "pvp-tools", path: "/pvp" },
  { name: "community-rankings", path: "/rankings" },
  {
    name: "trade-board-builder",
    path: "/trade-board",
    readySelector: ".trade-board-builder-page__empty",
  },
  { name: "raid-methodology", path: "/raid/methodology" },
  { name: "pvp-methodology", path: "/pvp/methodology" },
  { name: "help-information", path: "/help" },
  { name: "frequently-asked-questions", path: "/faq" },
  { name: "about-pokemon-go-nexus", path: "/about", realImages: true },
  { name: "trade-safety", path: "/safety" },
  {
    name: "page-not-found",
    path: "/this-route-does-not-exist",
    realImages: true,
    readySelector: ".not-found-card",
  },
];

const addThemePreference = async (page: Page, themeMode: ThemeMode) => {
  await page.addInitScript((mode) => {
    window.localStorage.setItem("isLightMode", String(mode === "light"));
  }, themeMode);
};

const themedSnapshotName = (snapshotName: string, themeMode: ThemeMode) =>
  themeMode === "dark"
    ? snapshotName
    : snapshotName.replace(/\.png$/, "-light.png");

const stabilizePage = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: [
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
      '[data-testid="perf-telemetry"] { visibility: hidden !important; }',
    ].join("\n"),
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        Promise.race([
          image.decode().catch(() => undefined),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
        ]),
      ),
    );
  });
};

const expectVisualBaseline = async (page: Page, snapshotName: string) => {
  await stabilizePage(page);
  await expect(page).toHaveScreenshot(snapshotName, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
};

const expectScrolledVisualBaseline = async (
  page: Page,
  selector: string,
  snapshotName: string,
) => {
  const element = page.locator(selector);
  await element.evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expectVisualBaseline(page, snapshotName);
};

test.describe("core responsive visual regression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !["chromium-desktop", "mobile-chrome"].includes(testInfo.project.name),
      "Visual baselines are maintained for representative desktop and mobile Chromium.",
    );
  });

  for (const themeMode of themeModes) {
    test(`matches the ${themeMode} signed-out Home baseline`, async ({ page }) => {
      await installE2eRoutes(page, { mockImages: false });
      await addThemePreference(page, themeMode);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", {
          name: "Build your collection. Find the right trade.",
        }),
      ).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("home-signed-out.png", themeMode),
      );
      await expectScrolledVisualBaseline(
        page,
        "#feature-directory",
        themedSnapshotName("home-feature-directory.png", themeMode),
      );
    });

    test(`matches the ${themeMode} registration method baseline`, async ({ page }) => {
      await installE2eRoutes(page, { mockImages: false });
      await addThemePreference(page, themeMode);
      await page.goto("/register", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Create your account" }),
      ).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("register-method.png", themeMode),
      );
    });

    test(`matches the ${themeMode} signed-in Home dashboard baseline`, async ({ page }) => {
      await installE2eRoutes(page);
      await addThemePreference(page, themeMode);
      await addSignedInUser(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Welcome back, VisualTrainerGO" }),
      ).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("home-dashboard.png", themeMode),
      );
    });

    test(`matches the ${themeMode} signed-in Action Menu baseline`, async ({ page }, testInfo) => {
      await installE2eRoutes(page, { mockImages: false });
      await addThemePreference(page, themeMode);
      await addSignedInUser(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await openActionMenu(page, testInfo.project.name);
      await expect(page.getByRole("dialog", { name: "Quick navigation" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close" })).toBeEnabled();
      await expectVisualBaseline(
        page,
        themedSnapshotName("action-menu-signed-in.png", themeMode),
      );

      await page.getByRole("button", { name: "Learn & support" }).click();
      await expect(
        page.getByRole("navigation", { name: "Learn and support" }),
      ).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("action-menu-support.png", themeMode),
      );
    });

    test(`matches the ${themeMode} offline status baseline`, async ({ page }) => {
      await installE2eRoutes(page, { mockImages: false });
      await addThemePreference(page, themeMode);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", {
          name: "Build your collection. Find the right trade.",
        }),
      ).toBeVisible();
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
        await expect(
          page.getByRole("alert").filter({ hasText: "You’re offline" }),
        ).toBeVisible();
        await expectVisualBaseline(
          page,
          themedSnapshotName("offline-status.png", themeMode),
        );
      } finally {
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
      }
    });

    test(`matches the ${themeMode} login baseline`, async ({ page }) => {
      await installE2eRoutes(page, { mockImages: false });
      await addThemePreference(page, themeMode);
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(page.getByLabel("Username or Email")).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("login-form.png", themeMode),
      );
    });

    test(`matches the ${themeMode} signed-in Search baseline`, async ({ page }) => {
      await installE2eRoutes(page);
      await addThemePreference(page, themeMode);
      await addSignedInUser(page);
      await page.goto("/search", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("search-signed-in.png", themeMode),
      );
    });

    test(`matches the ${themeMode} Trade Activity baseline`, async ({ page }) => {
      await installE2eRoutes(page);
      await addThemePreference(page, themeMode);
      await addSignedInUser(page);
      await page.goto("/trades", { waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: "Trade Activity" }).click();
      await expect(
        page.getByRole("heading", { name: "Your trades" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "No trades here" }),
      ).toBeVisible();
      await expectVisualBaseline(
        page,
        themedSnapshotName("trades-activity-empty.png", themeMode),
      );
    });

    for (const baseline of consolidatedPageBaselines) {
      test(`matches the ${themeMode} ${baseline.name} baseline`, async ({ page }) => {
        await installE2eRoutes(page, { mockImages: !baseline.realImages });
        await addThemePreference(page, themeMode);
        await addSignedInUser(page);
        await page.goto(baseline.path, { waitUntil: "domcontentloaded" });
        await expect(
          page.locator(baseline.readySelector ?? ".product-page-header"),
        ).toBeVisible();
        await expectVisualBaseline(
          page,
          themedSnapshotName(`${baseline.name}.png`, themeMode),
        );
      });
    }
  }
});
