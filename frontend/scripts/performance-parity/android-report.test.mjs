import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const frontendDirectory = resolve(import.meta.dirname, '../..');
const builder = resolve(
  frontendDirectory,
  'apps/mobile/scripts/build-android-performance-report.mjs',
);

test('builds interaction, frame, jank, and memory evidence from Android diagnostics', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'pokegonexus-performance-report-'));
  try {
    const logcat = resolve(directory, 'device-logcat.txt');
    const gfxinfo = resolve(directory, 'flow-gfxinfo.txt');
    const frameTimeline = resolve(directory, 'flow-frame-timeline.json');
    const meminfo = resolve(directory, 'flow-meminfo.txt');
    const output = resolve(directory, 'report.json');
    writeFileSync(logcat, [
      '[mobile:ui-perf] action_menu_surface_painted {',
      '  interactionLatencyMs: 42,',
      '}',
      '[mobile:ui-perf] theme_visible_palette_committed {',
      '  interactionLatencyMs: 17,',
      '}',
      '[mobile:ui-perf] instance_overlay_target_committed {',
      '  interactionLatencyMs: 116,',
      '}',
      '[mobile:ui-perf] collection_search_menu_painted {',
      '  interactionLatencyMs: 21,',
      '}',
      '[mobile:ui-perf] collection_search_menu_painted {',
      '  interactionLatencyMs: 31,',
      '}',
      '[mobile:ui-perf] collection_typed_query_result_painted {',
      '  interactionLatencyMs: 91,',
      '}',
      '[mobile:ui-perf] collection_typed_query_result_painted {',
      '  interactionLatencyMs: 29,',
      '}',
      '[mobile:ui-perf] global_touch_next_frame {',
      '  interactionLatencyMs: 8,',
      '}',
    ].join('\n'));
    writeFileSync(gfxinfo, [
      '---PROFILEDATA---',
      'Flags,IntendedVsync,WorkloadTarget,FrameCompleted',
      '0,1000000000,8000000,1010000000',
      '0,2000000000,25000000,2020000000',
      '---PROFILEDATA---',
    ].join('\n'));
    writeFileSync(frameTimeline, JSON.stringify({
      frameCount: 720,
      frameTimeP95Ms: 3.5,
      frameTimePercentile: 95,
      jankyFramesPercent: 0,
      layerName: 'com.pokegonexus.mobile/MainActivity',
    }));
    writeFileSync(meminfo, 'TOTAL PSS: 123,456 KB\n');

    execFileSync(process.execPath, [
      builder,
      '--output', output,
      '--profile', 'physical-android',
      '--device-id', 'physical-test-device',
      '--device-kind', 'physical',
      '--runtime', 'standalone',
      '--repetitions', '5',
      '--refresh-hz', '60',
      '--workload-id', 'canonical-performance-fixtures-v1',
      '--frame-workload-id', 'physical-scroll-v1',
      '--catalog-entries', '1097',
      '--instance-entries', '180',
      '--pvp-entries', '62',
      '--logcat', logcat,
      '--gfxinfo', gfxinfo,
      '--frame-timeline', frameTimeline,
      '--meminfo', meminfo,
    ]);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(report.profile, 'physical-android');
    assert.equal(report.implementation, 'native-android');
    assert.equal(report.environment.runtime, 'standalone');
    assert.equal(report.environment.repetitions, 5);
    assert.equal(report.environment.instanceEntries, 180);
    assert.equal(report.environment.frameWorkloadId, 'physical-scroll-v1');
    assert.equal(report.environment.source, 'adb-logcat-surfaceflinger-frametimeline-meminfo');
    assert.ok(report.samples.some(({ scenarioId, metric, value }) => (
      scenarioId === 'interaction.action-menu.open'
        && metric === 'interaction_ready_ms'
        && value === 42
    )));
    assert.ok(report.samples.some(({ scenarioId, metric, value }) => (
      scenarioId === 'interaction.theme.toggle'
        && metric === 'interaction_ready_ms'
        && value === 17
    )));
    assert.ok(report.samples.some(({ scenarioId, metric, value }) => (
      scenarioId === 'interaction.instance.navigate'
        && metric === 'interaction_ready_ms'
        && value === 116
    )));
    assert.deepEqual(
      report.samples.filter(({ scenarioId }) => (
        scenarioId === 'interaction.collection.search-open'
      )).map(({ value }) => value),
      [21],
    );
    assert.deepEqual(
      report.samples.filter(({ scenarioId }) => (
        scenarioId === 'interaction.collection.typed-query'
      )).map(({ value }) => value),
      [29],
    );
    assert.ok(report.samples.some(({ metric, value }) => (
      metric === 'frame_time_p95_ms' && value === 3.5
    )));
    assert.ok(report.samples.some(({ metric, value }) => (
      metric === 'janky_frames_percent' && value === 0
    )));
    assert.ok(report.samples.some(({ metric, value }) => (
      metric === 'memory_pss_bytes' && value === 123_456 * 1024
    )));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects development-client data as physical release evidence', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'pokegonexus-performance-report-'));
  try {
    const result = spawnSync(process.execPath, [
      builder,
      '--output', resolve(directory, 'report.json'),
      '--profile', 'physical-android',
      '--device-id', 'physical-test-device',
      '--device-kind', 'physical',
      '--runtime', 'dev-client',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /standalone release APK/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects old FrameTimeline values that were mislabeled as p95', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'pokegonexus-old-frame-report-'));
  try {
    const timeline = resolve(directory, 'old-frame-timeline.json');
    writeFileSync(timeline, JSON.stringify({ frameCount: 100, frameTimeP95Ms: 3.5 }));
    const result = spawnSync(process.execPath, [
      builder, '--output', resolve(directory, 'report.json'), '--frame-timeline', timeline,
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Reprocess its trace with the corrected query/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
