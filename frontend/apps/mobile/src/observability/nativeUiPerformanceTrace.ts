import { logDebug } from './logger';
import { runtimeConfig } from '../config/runtimeConfig';

let flowStartedAt: number | null = null;

export const markNativeUiPerformance = (
  event: string,
  meta?: Record<string, unknown>,
): void => {
  const releaseProbe = process.env.EXPO_PUBLIC_NATIVE_UI_PERFORMANCE === 'true';
  if ((!__DEV__ && !runtimeConfig.mobile.deviceSmokeMode && !releaseProbe) || process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  if (event === 'action_menu_anchor_pressed' || event === 'home_link_pressed') {
    flowStartedAt = now;
  }
  const payload = {
    elapsedFromAnchorMs: flowStartedAt === null ? null : now - flowStartedAt,
    ...meta,
  };
  if (__DEV__) {
    logDebug('ui-perf', event, payload);
    return;
  }
  // An opt-in release probe also works with the real account and normal routes,
  // without enabling fixture mode or React's development overhead.
  console.info(`[mobile:ui-perf] ${event}`, payload);
};
