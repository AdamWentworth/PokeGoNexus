import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { runtimeConfig } from '../config/runtimeConfig';
import { logDebug } from '../observability/logger';
import {
  classifyWebNavigation,
  trustedEmbeddedOrigins,
} from '../security/webNavigationPolicy';

const PRIMARY_PATH = '/pokemon';
const FALLBACK_PATH = '/';
const PROD_FRONTEND_APP_URL = 'https://pokegonexus.com';
const LOAD_TIMEOUT_MS = 8000;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

const resolveUrl = (baseUrl: string, path: string): string =>
  `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(path.trim() || '/')}`;

const WEBVIEW_DIAGNOSTIC_SCRIPT = `
(function () {
  var MOBILE_LAYOUT_PATCH_ID = '__mobile_caught_overlay_layout_patch__';
  var MOBILE_LAYOUT_PATCH_CSS = [
    '.purify-name-shadow-container{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;}',
    '.purify-name-shadow-container>.lucky-component{justify-self:start!important;margin-right:0!important;}',
    '.purify-name-shadow-container>.purify-component{justify-self:end!important;margin-left:0!important;}',
    '.purify-name-shadow-container>.name-container,.purify-name-shadow-container>.identity-name-slot{position:static!important;left:auto!important;transform:none!important;justify-self:center!important;text-align:center!important;white-space:nowrap!important;}',
    '.caught-instance .moves-content,.caught-instance .iv-component{box-sizing:border-box!important;padding-inline:12px!important;}',
    '.caught-instance .iv-label,.caught-instance .iv-display-label{padding-left:4px!important;}',
    '.caught-instance .iv-content,.caught-instance .iv-display-content{padding-right:8px!important;}',
    '.caught-instance .moves-container .type-icon{margin-left:4px!important;}'
  ].join('');

  var sent = 0;
  function post(type, payload) {
    try {
      if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return;
      if (sent > 200) return;
      sent += 1;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        __mobile_diag__: true,
        type: type,
        payload: payload,
        href: String(window.location && window.location.href || ''),
        ts: Date.now()
      }));
    } catch (_) {}
  }

  function ensureLayoutPatch() {
    try {
      if (document.getElementById(MOBILE_LAYOUT_PATCH_ID)) return true;
      var style = document.createElement('style');
      style.id = MOBILE_LAYOUT_PATCH_ID;
      style.type = 'text/css';
      style.appendChild(document.createTextNode(MOBILE_LAYOUT_PATCH_CSS));
      var parent = document.head || document.documentElement || document.body;
      if (!parent) return false;
      parent.appendChild(style);
      post('layout_patch_applied', true);
      return true;
    } catch (_) {
      return false;
    }
  }

  ensureLayoutPatch();
  if (!document.head) {
    document.addEventListener('DOMContentLoaded', ensureLayoutPatch);
  }

  post('bridge_ready', { readyState: document.readyState });
  post('user_agent', navigator.userAgent);

  var originalError = console.error;
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments).map(function (v) {
        return typeof v === 'string' ? v : JSON.stringify(v);
      });
      post('console_error', args.join(' | '));
    } catch (_) {}
    if (originalError) return originalError.apply(console, arguments);
  };

  window.addEventListener('error', function (event) {
    post('window_error', {
      message: event && event.message,
      source: event && event.filename,
      line: event && event.lineno,
      col: event && event.colno
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    post('unhandled_rejection', typeof reason === 'string' ? reason : JSON.stringify(reason));
  });

  var checks = 0;
  var timer = setInterval(function () {
    ensureLayoutPatch();
    checks += 1;
    var root = document.getElementById('root');
    var children = root ? root.childElementCount : -1;
    post('root_state', { checks: checks, exists: !!root, children: children, readyState: document.readyState });
    if (children > 0 || checks >= 12) {
      clearInterval(timer);
      if (children <= 0) {
        post('hydrate_failed', { checks: checks, children: children, readyState: document.readyState });
      } else {
        post('hydrate_ok', { checks: checks, children: children });
      }
    }
  }, 1000);
})();
true;
`;

type WebReplicaAppProps = {
  initialPath?: string;
  onOpenNativePath?: (path: string) => boolean;
};

const normalizeInitialPath = (value?: string): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return PRIMARY_PATH;
  return value;
};

export const WebReplicaApp = ({ initialPath, onOpenNativePath }: WebReplicaAppProps) => {
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAttemptedPathFallbackRef = useRef(false);
  const hasAttemptedHostFallbackRef = useRef(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState(runtimeConfig.api.frontendAppUrl);
  const requestedPath = normalizeInitialPath(initialPath);
  const [path, setPath] = useState(requestedPath);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const targetUrl = useMemo(
    () => resolveUrl(baseUrl, path),
    [baseUrl, path],
  );
  const trustedOrigins = useMemo(
    () => trustedEmbeddedOrigins(runtimeConfig.api.frontendAppUrl),
    [],
  );
  const embeddedOriginWhitelist = useMemo(
    () => [
      ...trustedOrigins.map((origin) => `${origin}/*`),
      'about:*',
      'blob:*',
      'data:*',
    ],
    [trustedOrigins],
  );
  const appOrigins = useMemo(() => {
    const values = [runtimeConfig.api.frontendAppUrl, PROD_FRONTEND_APP_URL];
    return values.flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
  }, []);

  const clearLoadTimeout = () => {
    if (!loadTimeoutRef.current) return;
    clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = null;
  };

  const handleLoadFailure = (
    kind: 'http' | 'navigation',
    details: string,
  ) => {
    clearLoadTimeout();

    // The pokemon route is the preferred entry, but if it fails we fall back once
    // to the root route so users can still interact with the app.
    if (path !== FALLBACK_PATH && !hasAttemptedPathFallbackRef.current) {
      hasAttemptedPathFallbackRef.current = true;
      hasCompletedInitialLoadRef.current = false;
      setIsLoading(true);
      setLoadError(null);
      setPath(FALLBACK_PATH);
      return;
    }

    if (
      baseUrl !== PROD_FRONTEND_APP_URL &&
      !hasAttemptedHostFallbackRef.current
    ) {
      hasAttemptedHostFallbackRef.current = true;
      hasAttemptedPathFallbackRef.current = false;
      hasCompletedInitialLoadRef.current = false;
      setIsLoading(true);
      setLoadError(null);
      setBaseUrl(PROD_FRONTEND_APP_URL);
      setPath(requestedPath);
      return;
    }

    hasCompletedInitialLoadRef.current = true;
    setIsLoading(false);
    setLoadError(
      `Failed to load ${targetUrl} (${kind}). ${details}`.trim(),
    );
  };

  const startLoading = () => {
    setLoadError(null);
    if (hasCompletedInitialLoadRef.current) return;
    clearLoadTimeout();
    setIsLoading(true);
    loadTimeoutRef.current = setTimeout(() => {
      handleLoadFailure('navigation', 'load timed out');
      loadTimeoutRef.current = null;
    }, LOAD_TIMEOUT_MS);
  };

  const stopLoading = () => {
    hasCompletedInitialLoadRef.current = true;
    clearLoadTimeout();
    setIsLoading(false);
  };

  const handleRetry = () => {
    hasAttemptedPathFallbackRef.current = false;
    hasAttemptedHostFallbackRef.current = false;
    hasCompletedInitialLoadRef.current = false;
    setLoadError(null);
    setIsLoading(true);
    setBaseUrl(runtimeConfig.api.frontendAppUrl);
    setPath(requestedPath);
    setReloadNonce((prev) => prev + 1);
  };

  const handleOpenInBrowser = () => {
    void Linking.openURL(targetUrl);
  };

  const handleNavigationRequest = (url: string): boolean => {
    const disposition = classifyWebNavigation(url, trustedOrigins);
    if (disposition === 'embedded') {
      if (hasCompletedInitialLoadRef.current && onOpenNativePath) {
        try {
          const parsed = new URL(url);
          if (appOrigins.includes(parsed.origin)) {
            const canonicalPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            if (onOpenNativePath(canonicalPath)) return false;
          }
        } catch {
          // Embedded non-HTTP documents stay in the canonical app.
        }
      }
      return true;
    }

    if (disposition === 'external') {
      void Linking.openURL(url).catch(() => {
        logDebug('webview-navigation', `Unable to open external URL: ${url}`);
      });
    }

    return false;
  };

  const handleWebViewDiagnosticMessage = (rawMessage: string): void => {
    try {
      const parsed = JSON.parse(rawMessage) as {
        __mobile_diag__?: boolean;
        type?: string;
        payload?: unknown;
      };
      if (!parsed.__mobile_diag__ || !parsed.type) return;

      const hint = `${parsed.type}${
        parsed.payload !== undefined ? `: ${JSON.stringify(parsed.payload)}` : ''
      }`;
      logDebug('webview-diag', hint);

      if (parsed.type === 'hydrate_failed') {
        handleLoadFailure(
          'navigation',
          'page loaded but app hydration did not complete',
        );
      }
    } catch {
      // Ignore non-JSON messages from page scripts.
    }
  };

  useEffect(
    () => () => {
      clearLoadTimeout();
    },
    [],
  );

  useEffect(() => {
    // Start the watchdog even if WebView load callbacks never fire.
    if (!hasCompletedInitialLoadRef.current) {
      startLoading();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUrl, reloadNonce]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View testID="web-replica-loading" style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Loading web replica...</Text>
        </View>
      ) : null}
      {loadError ? (
        <View testID="web-replica-error" style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Unable to load app</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <View style={styles.errorActions}>
            <Pressable accessibilityRole="button" onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleOpenInBrowser} style={styles.browserButton}>
              <Text style={styles.browserButtonText}>Open in Browser</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <WebView
        key={`${targetUrl}:${reloadNonce}`}
        testID="web-replica-webview"
        source={{ uri: targetUrl }}
        style={styles.webview}
        originWhitelist={embeddedOriginWhitelist}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={false}
        injectedJavaScriptBeforeContentLoaded={WEBVIEW_DIAGNOSTIC_SCRIPT}
        onShouldStartLoadWithRequest={(request) =>
          handleNavigationRequest(request.url)
        }
        onMessage={(event) =>
          handleWebViewDiagnosticMessage(event.nativeEvent.data)
        }
        onLoadStart={startLoading}
        onLoadEnd={stopLoading}
        onError={(event) => {
          const details =
            event.nativeEvent.description || `code ${event.nativeEvent.code}`;
          handleLoadFailure('navigation', details);
        }}
        onHttpError={(event) => {
          handleLoadFailure(
            'http',
            `${event.nativeEvent.statusCode} ${event.nativeEvent.description || ''}`.trim(),
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 20,
    gap: 12,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: '#e5e5e5',
    textAlign: 'center',
    fontSize: 13,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  retryButton: {
    backgroundColor: '#2b7fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  browserButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  browserButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
