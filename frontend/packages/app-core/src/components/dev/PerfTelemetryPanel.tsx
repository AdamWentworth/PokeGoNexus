import { useState } from 'react';

import { usePerfTelemetryStore } from '@/stores/usePerfTelemetryStore';
import {
  getPerfTelemetrySnapshot,
  shouldShowPerfPanel,
} from '@/utils/perfTelemetry';

const panelEnabled = shouldShowPerfPanel();

function formatMs(value?: number): string {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value.toFixed(1)} ms`;
}

function formatCount(value?: number): string {
  if (value == null || Number.isNaN(value)) return '--';
  return String(value);
}

export default function PerfTelemetryPanel() {
  const [expanded, setExpanded] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const firstPaintMs = usePerfTelemetryStore((s) => s.firstPaintMs);
  const firstContentfulPaintMs = usePerfTelemetryStore((s) => s.firstContentfulPaintMs);
  const variants = usePerfTelemetryStore((s) => s.variants);
  const images = usePerfTelemetryStore((s) => s.images);
  const renders = usePerfTelemetryStore((s) => s.renders);
  const topRenderHotspots = Object.entries(renders)
    .sort((a, b) => b[1].commits - a[1].commits)
    .slice(0, 4);

  const exportSnapshot = async (mode: 'copy' | 'download'): Promise<void> => {
    const snapshot = getPerfTelemetrySnapshot();
    const payload = JSON.stringify(snapshot, null, 2);

    if (mode === 'copy') {
      try {
        await navigator.clipboard.writeText(payload);
        setExportStatus('Copied JSON');
        return;
      } catch {
        setExportStatus('Clipboard failed');
        return;
      }
    }

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `perf-snapshot-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setExportStatus('Downloaded JSON');
  };

  if (!panelEnabled) return null;

  return (
    <div
      data-testid="perf-telemetry"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        maxWidth: 320,
        borderRadius: 8,
        border: '1px solid #2f3b4f',
        background: 'rgba(8, 12, 20, 0.92)',
        color: '#e7eefb',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 0,
          background: 'transparent',
          color: 'inherit',
          padding: '8px 10px',
          cursor: 'pointer',
        }}
      >
        {expanded ? 'Perf telemetry [-]' : 'Perf telemetry [+]'}
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 10px 10px', lineHeight: 1.6 }}>
          <div><strong>Paint</strong></div>
          <div>FP: {formatMs(firstPaintMs)}</div>
          <div>FCP: {formatMs(firstContentfulPaintMs)}</div>

          <div style={{ marginTop: 8 }}><strong>Variants pipeline</strong></div>
          <div>Fetch: {formatMs(variants?.fetchedMs)}</div>
          <div>Transform: {formatMs(variants?.transformMs)}</div>
          <div>Queue persist: {formatMs(variants?.persistMs)}</div>
          <div>Commit write: {formatMs(variants?.persistCommittedMs)}</div>
          <div>Queue-&gt;commit: {formatMs(variants?.persistEndToEndMs)}</div>
          <div>Total: {formatMs(variants?.totalMs)}</div>
          <div>Count: {formatCount(variants?.variantCount)}</div>

          <div style={{ marginTop: 8 }}><strong>Image timing</strong></div>
          <div>Loads: {images.loads}</div>
          <div>Errors: {images.errors}</div>
          <div>Last load: {formatMs(images.lastLoadMs)}</div>
          <div>Avg load: {formatMs(images.avgLoadMs)}</div>
          <div>P95 load: {formatMs(images.p95LoadMs)}</div>

          <div style={{ marginTop: 8 }}><strong>Render hotspots</strong></div>
          {topRenderHotspots.length === 0 ? (
            <div>--</div>
          ) : (
            topRenderHotspots.map(([id, metric]) => (
              <div key={id}>
                {id}: {formatCount(metric.commits)} commits ({formatMs(metric.avgMs)} avg)
              </div>
            ))
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => void exportSnapshot('copy')}
              style={{
                border: '1px solid #2f3b4f',
                background: '#101a2a',
                color: '#e7eefb',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={() => void exportSnapshot('download')}
              style={{
                border: '1px solid #2f3b4f',
                background: '#101a2a',
                color: '#e7eefb',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              Download JSON
            </button>
            {exportStatus && <span>{exportStatus}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
