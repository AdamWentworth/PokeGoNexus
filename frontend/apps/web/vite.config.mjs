// vite.config.mjs
import { defineConfig, loadEnv } from 'vite';
import react            from '@vitejs/plugin-react';
import fs               from 'node:fs';
import path             from 'node:path';

const isCI = process.env.CI === 'true';
const isWindows = process.platform === 'win32';
const allowLocalParallelTests = process.env.VITEST_ALLOW_PARALLEL === '1';
const lowMemoryMode =
  isWindows ||
  process.env.VITEST_LOW_MEMORY === '1' ||
  (!isCI && !allowLocalParallelTests);
const enableHtmlReport = process.env.VITEST_HTML_REPORT === '1';
const appCoreRoot = path.resolve(__dirname, '../../packages/app-core');
const webRoot = __dirname;
const sharedAssetsRoot = path.resolve(__dirname, '../../../assets');
const testArtifactsRoot = path.resolve(webRoot, '.artifacts/tests');
const appCoreSetupFile = `/@fs/${path
  .resolve(appCoreRoot, 'tests/setupTests.ts')
  .replace(/\\/g, '/')}`;

const mediaContentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
]);

const serveSharedMediaAsset = (req, res, next) => {
  if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
    next();
    return;
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  const isSharedMediaPath = pathname.startsWith('/media/');
  const isLegacyImagesPath = pathname.startsWith('/images/');
  if (!isSharedMediaPath && !isLegacyImagesPath) {
    next();
    return;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(
      isSharedMediaPath ? pathname.slice('/media/'.length) : pathname.slice(1),
    );
  } catch {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const filePath = path.resolve(sharedAssetsRoot, relativePath);
  if (!filePath.startsWith(`${sharedAssetsRoot}${path.sep}`)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      next();
      return;
    }

    const contentType = mediaContentTypes.get(path.extname(filePath).toLowerCase());
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  });
};

const sharedMediaAssetsPlugin = () => ({
  name: 'go-shared-media-assets',
  configureServer(server) {
    server.middlewares.use(serveSharedMediaAsset);
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveSharedMediaAsset);
  },
});

const serveE2eEvents = (req, res, next) => {
  if (!req.url || req.method !== 'GET') {
    next();
    return;
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/__e2e/events/getUpdates') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end('{}');
    return;
  }

  if (pathname !== '/__e2e/events/sse') {
    next();
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (!res.writableEnded) {
      res.end();
    }
  });
};

const e2eEventsPlugin = (enabled) => ({
  name: 'go-e2e-events',
  configureServer(server) {
    if (enabled) {
      server.middlewares.use(serveE2eEvents);
    }
  },
  configurePreviewServer(server) {
    if (enabled) {
      server.middlewares.use(serveE2eEvents);
    }
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, '');
  const isE2e =
    mode === 'e2e' ||
    process.env.VITE_EVENTS_API_URL?.includes('/__e2e/events') === true;
  const assetOrigin = (env.VITE_ASSET_ORIGIN || 'https://pokegonexus.com').replace(/\/+$/, '');
  const devProxyTarget = env.DEV_PROXY_TARGET?.trim().replace(/\/+$/, '');
  const devSearchProxyTarget = env.DEV_SEARCH_PROXY_TARGET
    ?.trim()
    .replace(/\/+$/, '');
  const devProxyHost = env.DEV_PROXY_HOST?.trim();
  const devProxySecure = env.DEV_PROXY_SECURE !== 'false';
  const assetProxyTarget = devProxyTarget || assetOrigin;
  const apiProxyTarget = (
    process.env.E2E_REAL_API_ORIGIN ||
    devProxyTarget ||
    process.env.VITE_ASSET_ORIGIN ||
    env.VITE_ASSET_ORIGIN ||
    (() => {
      try {
        return new URL(env.VITE_AUTH_API_URL).origin;
      } catch {
        return 'https://pokegonexus.com';
      }
    })()
  ).replace(/\/+$/, '');

  return {
    root: appCoreRoot,
    envDir: webRoot,
    plugins: [sharedMediaAssetsPlugin(), e2eEventsPlugin(isE2e), react()],
    resolve: {
      alias: {
        '@': path.resolve(appCoreRoot, 'src'),
        '@tests': path.resolve(appCoreRoot, 'tests'),
        '@shared-contracts': path.resolve(__dirname, '../../packages/shared-contracts/src')
      }
    },
    server : {
      port: 3000,
      hmr: true,
      overlay: true,
      proxy: {
        // Keep legacy /images paths functional in dev without local public/images files.
        '/images': {
          target: assetProxyTarget,
          changeOrigin: true,
          secure: devProxySecure,
          ...(devProxyHost ? { headers: { host: devProxyHost } } : {}),
        },
        ...(devSearchProxyTarget
          ? {
              '/api/search': {
                target: devSearchProxyTarget,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/search/, '/api'),
                configure(proxy) {
                  proxy.on('proxyReq', (proxyReq) => {
                    // Native React Native Web parity checks run on a sibling localhost port.
                    // Do not forward that browser Origin to services that correctly only trust
                    // the canonical frontend origin.
                    proxyReq.removeHeader('origin');
                  });
                },
              },
            }
          : {}),
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: devProxySecure,
          ...(devProxyHost ? { headers: { host: devProxyHost } } : {}),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              // Allow the local native-web renderer to reuse the canonical Vite API proxy.
              // This is development-only and never changes production service CORS policy.
              proxyReq.removeHeader('origin');
            });
            proxy.on('proxyRes', (proxyRes) => {
              const cookies = proxyRes.headers['set-cookie'];
              if (!Array.isArray(cookies)) {
                return;
              }

              proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
                cookie
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=None/gi, '; SameSite=Lax'),
              );
            });
          },
        },
      },
    },

    build: {
      // Keep logs during development, but strip console/debugger in production bundles.
      minify: 'esbuild',
      target: 'esnext',
      esbuild: {
        drop: ['console', 'debugger'],
      },
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            // Keep only clearly isolated heavy libraries split out.
            // Note: aggressive vendor splitting (react/router/state/utils)
            // created circular chunk dependencies in production.
            if (id.includes('html2canvas')) {
              return 'vendor-capture';
            }
            if (id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('/idb/')) {
              return 'vendor-idb';
            }
            if (id.includes('/ol/')) {
              return 'vendor-maps';
            }

            // Let Rollup/Vite decide for the rest to avoid cyclic chunks.
            return undefined;
          }
        }
      }
    },

    cacheDir: path.join(testArtifactsRoot, '.vitest'),

    /* ---------- Vitest --------------------------------------------------- */
    test: {
      globals    : true,
      environment: 'jsdom',
      setupFiles : [appCoreSetupFile],
      testTimeout: 10000,

      isolate        : true,
      pool           : lowMemoryMode ? 'forks' : 'threads',
      maxWorkers     : lowMemoryMode ? 1 : 4,
      fileParallelism: lowMemoryMode ? false : true,
      sequence       : {
        shuffle: false,
        concurrent: false,
        hooks: 'list'
      },

      include: [
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
      ],

      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**'
      ],

      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json'],
        reportsDirectory: path.join(testArtifactsRoot, 'coverage'),
        thresholds: {
          // Preserve meaningful headroom beneath the current aggregate while
          // preventing a large untested feature from silently diluting it.
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 72
        },
        exclude: [
          'tests/**',
          '**/*.d.ts',
          '**/*.config.{js,ts}',
          '**/types/**'
        ]
      },

      reporters: [
        'default',
        ...(enableHtmlReport
          ? [
              [
                'html',
                {
                  outputFile: path.join(testArtifactsRoot, 'reports/html/index.html'),
                },
              ],
            ]
          : []),
        ...(isCI
          ? [
              [
                'junit',
                {
                  outputFile: path.join(testArtifactsRoot, 'reports/junit.xml'),
                  classname: ({ filepath }) =>
                    filepath.replace(/\.test\.[jt]sx?$/, ''),
                  suiteName: 'Frontend Tests',
                },
              ],
            ]
          : []),
      ],

      watch: {
        coverage: {
          enabled: false
        }
      }
    },
  };
});
