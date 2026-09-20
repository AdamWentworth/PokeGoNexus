import { markNativeUiPerformance } from './nativeUiPerformanceTrace';

export const captureNativeUiInteractionStart = (): number => Date.now();

export const markNativeUiPerformanceAfterPaint = (
  event: string,
  startedAt: number,
): void => {
  if (process.env.NODE_ENV === 'test') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      markNativeUiPerformance(event, {
        interactionLatencyMs: Math.max(0, Date.now() - startedAt),
      });
    });
  });
};

export const runNativeUiWorkAfterPaint = (work: () => void): void => {
  if (process.env.NODE_ENV === 'test') {
    work();
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(work);
  });
};
