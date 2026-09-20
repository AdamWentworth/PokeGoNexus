import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { attachBrowserDiagnostics } from "./support/diagnostics";
import { installE2eRoutes } from "./support/e2eRoutes";

const defaultRoutePaths = [
  "/",
  "/getting-started",
  "/help",
  "/faq",
  "/about",
  "/safety",
  "/this-route-does-not-exist",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/data-deletion",
  "/pokedex",
  "/pokemon",
  "/search",
  "/trades",
  "/raid",
  "/raid/methodology",
  "/max",
  "/pvp",
  "/pvp/methodology",
  "/rankings",
  "/trade-board",
];

const configuredRoutePaths = process.env.E2E_ROUTE_PATHS
  ? process.env.E2E_ROUTE_PATHS.split(",")
      .map((routePath) => routePath.trim())
      .filter(Boolean)
  : [];

const routePaths =
  configuredRoutePaths.length > 0 ? configuredRoutePaths : defaultRoutePaths;

const parsedSettleMs = Number(process.env.E2E_SETTLE_MS ?? 1500);
const settleMs = Number.isFinite(parsedSettleMs) ? parsedSettleMs : 1500;

function slugifyRoute(routePath: string) {
  return routePath === "/"
    ? "home"
    : routePath
        .replace(/^\//, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
}

test.describe("cross-browser route smoke", () => {
  for (const routePath of routePaths) {
    test(`loads ${routePath} without browser runtime errors`, async ({
      page,
    }, testInfo) => {
      await installE2eRoutes(page);
      const diagnostics = attachBrowserDiagnostics(page, testInfo);
      const screenshotsDir = testInfo.outputPath("route-screenshots");
      fs.mkdirSync(screenshotsDir, { recursive: true });

      try {
        const response = await page.goto(routePath, {
          waitUntil: "domcontentloaded",
        });
        expect(
          response?.ok(),
          `${routePath} document response should be OK`,
        ).toBe(true);

        await expect(page.locator("#root")).toBeAttached();
        await expect
          .poll(
            async () =>
              page
                .locator("#root")
                .evaluate(
                  (element) => element.textContent?.trim().length ?? 0,
                ),
            { message: `${routePath} should render app content` },
          )
          .toBeGreaterThan(0);

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(settleMs);
        await expect(page.locator(".app-error-fallback")).toHaveCount(0);

        const screenshotPath = path.join(
          screenshotsDir,
          `${slugifyRoute(routePath)}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach(`route-${slugifyRoute(routePath)}.png`, {
          path: screenshotPath,
          contentType: "image/png",
        });
      } finally {
        await diagnostics.flush();
      }

      const blockingErrors = diagnostics.blockingErrors();
      expect(
        blockingErrors,
        `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
      ).toEqual([]);
    });
  }
});
