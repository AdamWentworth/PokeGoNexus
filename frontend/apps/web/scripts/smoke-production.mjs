#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = new URL(
  process.env.PRODUCTION_SMOKE_BASE_URL ?? "https://pokegonexus.com",
);
const allowHttp = process.env.PRODUCTION_SMOKE_ALLOW_HTTP === "1";
const outputPath = path.resolve(
  process.env.PRODUCTION_SMOKE_REPORT_PATH ??
    ".artifacts/production-smoke/report.json",
);
const timeoutMs = Number(process.env.PRODUCTION_SMOKE_TIMEOUT_MS ?? 20_000);

if (baseUrl.protocol !== "https:" && !allowHttp) {
  throw new Error(
    `Production smoke requires HTTPS (received ${baseUrl.origin}). ` +
      "Set PRODUCTION_SMOKE_ALLOW_HTTP=1 only for a local target.",
  );
}

if (baseUrl.username || baseUrl.password) {
  throw new Error("Production smoke URLs must not contain credentials.");
}

baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const htmlRoutes = [
  "/",
  "/getting-started",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/data-deletion",
  "/download",
  "/pokedex",
  "/raid",
  "/max",
  "/pvp",
  "/rankings",
  "/trade-board",
];

const results = [];

function smokeUrl(pathname) {
  return new URL(pathname.replace(/^\/+/, ""), baseUrl);
}

async function fetchWithTimeout(pathname, init = {}) {
  const startedAt = performance.now();
  const response = await fetch(smokeUrl(pathname), {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "Pokemon-Go-Nexus-production-smoke/1.0",
      ...init.headers,
    },
    ...init,
  });

  return {
    response,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

async function recordCheck(name, check) {
  const startedAt = performance.now();

  try {
    const details = await check();
    const result = {
      name,
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      ...details,
    };
    results.push(result);
    console.log(`PASS ${name} (${result.durationMs} ms)`);
  } catch (error) {
    const result = {
      name,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
    results.push(result);
    console.error(`FAIL ${name}: ${result.error}`);
  }
}

function assertResponse(response, expectedContentType) {
  if (!response.ok) {
    throw new Error(`received HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes(expectedContentType)) {
    throw new Error(
      `expected ${expectedContentType} but received ${contentType || "no content type"}`,
    );
  }
}

let homeHtml = "";

for (const route of htmlRoutes) {
  await recordCheck(`route ${route}`, async () => {
    const { response, durationMs } = await fetchWithTimeout(route);
    assertResponse(response, "text/html");
    const html = await response.text();

    if (!/<div\s+id=["']root["']><\/div>/i.test(html)) {
      throw new Error("application root element is missing");
    }
    if (!/<title>Pokémon Go Nexus<\/title>/i.test(html)) {
      throw new Error("product title is missing");
    }
    if (/https?:\/\/localhost(?::\d+)?/i.test(html)) {
      throw new Error("deployed HTML contains a localhost URL");
    }

    if (route === "/") homeHtml = html;

    return {
      status: response.status,
      responseMs: durationMs,
      bytes: Buffer.byteLength(html),
    };
  });
}

const assetPaths = [
  ...new Set(
    [...homeHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
      ([, assetPath]) => assetPath,
    ),
  ),
];

await recordCheck("deployed asset references", async () => {
  if (assetPaths.length === 0) {
    throw new Error("home document does not reference any built assets");
  }

  const assetResults = await Promise.all(
    assetPaths.map(async (assetPath) => {
      const { response } = await fetchWithTimeout(assetPath, {
        method: "HEAD",
      });
      if (!response.ok) {
        throw new Error(`${assetPath} returned HTTP ${response.status}`);
      }
      return assetPath;
    }),
  );

  return { checkedAssets: assetResults.length };
});

await recordCheck("web app manifest", async () => {
  const { response } = await fetchWithTimeout("/manifest.json");
  assertResponse(response, "application/json");
  const manifest = await response.json();

  if (manifest.name !== "Pokémon Go Nexus") {
    throw new Error(`unexpected manifest name: ${String(manifest.name)}`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error("manifest does not define application icons");
  }

  return { status: response.status, icons: manifest.icons.length };
});

await recordCheck("service worker", async () => {
  const { response } = await fetchWithTimeout("/sw.js", { method: "HEAD" });
  if (!response.ok) throw new Error(`received HTTP ${response.status}`);
  return { status: response.status };
});

const betaManifest = JSON.parse(await fs.readFile(new URL('../../../packages/app-core/src/pages/Download/android-beta.json', import.meta.url), 'utf8'));
if (betaManifest.release) {
  await recordCheck('Android APK download headers and resume', async () => {
    const release = betaManifest.release;
    const filename = `PokeGoNexus-Android-${release.versionCode}.apk`;
    const pathname = `/downloads/android/${filename}`;
    const { response } = await fetchWithTimeout(pathname, { method: 'HEAD', redirect: 'error' });
    assertResponse(response, 'application/vnd.android.package-archive');
    if (Number(response.headers.get('content-length')) !== release.sizeBytes) throw new Error('APK length differs from the release');
    if (response.headers.get('content-disposition') !== `attachment; filename="${filename}"`) throw new Error('APK filename/disposition is missing');
    const { response: range } = await fetchWithTimeout(pathname, { headers: { Range: 'bytes=0-3' }, redirect: 'error' });
    if (range.status !== 206 || range.headers.get('content-range') !== `bytes 0-3/${release.sizeBytes}`) throw new Error('APK download cannot resume using byte ranges');
    if (!Buffer.from(await range.arrayBuffer()).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error('Download does not begin with an APK/ZIP header');
    return { status: response.status, sizeBytes: release.sizeBytes, rangeStatus: range.status };
  });
  await recordCheck('missing APK returns 404 instead of the web app', async () => {
    const { response } = await fetchWithTimeout('/downloads/android/PokeGoNexus-Android-0.apk', { method: 'HEAD', redirect: 'error' });
    if (response.status !== 404) throw new Error(`expected 404 but received ${response.status}`);
    return { status: response.status };
  });
}

await recordCheck("public Pokémon catalog manifest", async () => {
  const { response } = await fetchWithTimeout("/api/pokemon/manifest");
  assertResponse(response, "application/json");
  const manifest = await response.json();

  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
    throw new Error("catalog schema version is missing");
  }
  if (!manifest.catalogVersion || !manifest.chunks?.catalog?.endpoint) {
    throw new Error("catalog version or catalog chunk is missing");
  }

  return {
    status: response.status,
    schemaVersion: manifest.schemaVersion,
    catalogVersion: manifest.catalogVersion,
  };
});

const report = {
  baseUrl: baseUrl.origin,
  checkedAt: new Date().toISOString(),
  ok: results.every((result) => result.ok),
  checks: results,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!report.ok) {
  const failedChecks = results.filter((result) => !result.ok).length;
  throw new Error(
    `${failedChecks} production smoke check${failedChecks === 1 ? "" : "s"} failed.`,
  );
}

console.log(`Production smoke passed (${results.length} checks).`);
console.log(`Report: ${outputPath}`);
