#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { buildAndroidFrameTimelineQuery } from './android-frame-timeline-query.mjs';

const frontendDirectory = resolve(import.meta.dirname, '../..');
const perfettoVersion = 'v58.2';
const traceProcessorUrl =
  `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${perfettoVersion}/linux-amd64/trace_processor_shell`;
const traceProcessorSha256 = '58042408e6cc861fb1a731c26bb082dc222285561eaa4e12a48a8b2b90dca7b9';

const parseArgs = (values) => {
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Expected --name value, received ${name ?? 'nothing'}.`);
    }
    parsed.set(name, value);
    index += 1;
  }
  return parsed;
};

const sleep = (milliseconds) => new Promise((resolveSleep) => {
  setTimeout(resolveSleep, milliseconds);
});

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const ensureTraceProcessor = async () => {
  const override = process.env.POKEGONEXUS_TRACE_PROCESSOR?.trim();
  if (override) {
    const executable = resolve(override);
    if (!existsSync(executable)) throw new Error(`Trace Processor does not exist: ${executable}`);
    return executable;
  }
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      'Automatic Trace Processor setup currently supports Linux x64; set POKEGONEXUS_TRACE_PROCESSOR.',
    );
  }
  const executable = resolve(
    frontendDirectory,
    `.artifacts/performance-parity/tools/trace_processor-${perfettoVersion}`,
  );
  if (existsSync(executable) && sha256(executable) === traceProcessorSha256) return executable;
  mkdirSync(dirname(executable), { recursive: true });
  const temporary = `${executable}.${process.pid}.download`;
  const response = await fetch(traceProcessorUrl);
  if (!response.ok) {
    throw new Error(`Trace Processor download failed: HTTP ${response.status}`);
  }
  writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
  const digest = sha256(temporary);
  if (digest !== traceProcessorSha256) {
    unlinkSync(temporary);
    throw new Error(`Trace Processor checksum mismatch: ${digest}`);
  }
  chmodSync(temporary, 0o755);
  renameSync(temporary, executable);
  return executable;
};

const runAdb = (adb, device, args, options = {}) => execFileSync(
  adb,
  ['-s', device, ...args],
  {
    encoding: options.binary ? undefined : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.quiet ? ['ignore', 'ignore', 'ignore'] : undefined,
  },
);

const waitForPerfetto = (child, readyText) => new Promise((resolveReady, rejectReady) => {
  let output = '';
  let settled = false;
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectReady(new Error(`Perfetto did not start within 10 seconds.\n${output}`));
  }, 10_000);
  const inspect = (chunk) => {
    output += chunk.toString();
    if (!settled && output.includes(readyText)) {
      settled = true;
      clearTimeout(timeout);
      resolveReady();
    }
  };
  child.stdout.on('data', inspect);
  child.stderr.on('data', inspect);
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    rejectReady(error);
  });
  child.once('exit', (status) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    rejectReady(new Error(`Perfetto exited before capture with status ${status}.\n${output}`));
  });
});

const waitForExit = (child) => new Promise((resolveExit, rejectExit) => {
  child.once('error', rejectExit);
  child.once('exit', (status) => {
    if (status === 0) resolveExit();
    else rejectExit(new Error(`Perfetto exited with status ${status}.`));
  });
});

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const device = args.get('--device');
  const layerMatch = args.get('--layer-match');
  const output = args.get('--output');
  if (!device || !layerMatch || !output) {
    throw new Error(
      'Usage: capture-android-frame-timeline.mjs --device ID --layer-match PACKAGE --output metrics.json',
    );
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(layerMatch)) {
    throw new Error(`Unsafe FrameTimeline layer match: ${layerMatch}`);
  }
  const adb = process.env.ADB_BIN?.trim() || resolve(
    process.env.ANDROID_SDK_ROOT?.trim()
      || process.env.ANDROID_HOME?.trim()
      || resolve(os.homedir(), 'Android/Sdk'),
    'platform-tools/adb',
  );
  if (!existsSync(adb)) throw new Error(`ADB was not found at ${adb}.`);
  const traceProcessor = await ensureTraceProcessor();
  const outputPath = resolve(output);
  const tracePath = outputPath.replace(/\.json$/i, '.pftrace');
  mkdirSync(dirname(outputPath), { recursive: true });

  const sizeText = runAdb(adb, device, ['shell', 'wm', 'size']);
  const sizes = [...sizeText.matchAll(/(\d+)x(\d+)/g)];
  const activeSize = sizes.at(-1);
  if (!activeSize) throw new Error(`Could not read Android display size from: ${sizeText}`);
  const width = Number(activeSize[1]);
  const height = Number(activeSize[2]);
  const x = Math.round(width * 0.5);
  const upperY = Math.round(height * 0.34);
  const lowerY = Math.round(height * 0.76);
  const swipe = (fromY, toY) => {
    runAdb(adb, device, [
      'shell', 'input', 'swipe', String(x), String(fromY), String(x), String(toY), '300',
    ]);
  };
  const scrollCycles = async (cycles) => {
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      swipe(lowerY, upperY);
      await sleep(100);
      swipe(upperY, lowerY);
      await sleep(100);
    }
  };

  // Stabilize scroll position, toolbar state, shaders, and gesture handling
  // before the system trace begins. Vite and native use this exact workload.
  await scrollCycles(1);
  await sleep(500);

  const remoteTrace = `/data/misc/perfetto-traces/pokegonexus-frame-${process.pid}.pftrace`;
  const config = [
    'buffers: { size_kb: 32768 fill_policy: RING_BUFFER }',
    'data_sources: { config { name: "android.surfaceflinger.frametimeline" } }',
    'duration_ms: 8000',
    '',
  ].join('\n');
  const perfetto = spawn(adb, [
    '-s', device, 'shell', 'perfetto', '--txt', '-c', '-', '-o', remoteTrace,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = waitForExit(perfetto);
  perfetto.stdin.end(config);
  await waitForPerfetto(perfetto, 'Connected to the Perfetto traced service');
  await scrollCycles(6);
  await exited;

  try {
    runAdb(adb, device, ['pull', remoteTrace, tracePath]);
  } finally {
    runAdb(adb, device, ['shell', 'rm', '-f', remoteTrace], { quiet: true });
  }
  const sql = buildAndroidFrameTimelineQuery(layerMatch);
  const queryResult = execFileSync(
    traceProcessor,
    ['query', tracePath, sql],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  const jsonStart = queryResult.indexOf('{');
  const jsonEnd = queryResult.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error(`Trace Processor did not return FrameTimeline metrics:\n${queryResult}`);
  }
  const metrics = JSON.parse(queryResult.slice(jsonStart, jsonEnd + 1));
  if (
    !Number.isInteger(metrics.frameCount)
    || metrics.frameCount < 30
    || !Number.isFinite(metrics.frameTimeP95Ms)
    || !Number.isFinite(metrics.jankyFramesPercent)
    || typeof metrics.layerName !== 'string'
  ) {
    throw new Error(`Insufficient FrameTimeline evidence: ${JSON.stringify(metrics)}`);
  }
  const result = {
    ...metrics,
    source: 'android-surfaceflinger-frametimeline',
    perfettoVersion,
    workload: {
      id: 'physical-scroll-v1',
      measuredCycles: 6,
      swipeDurationMs: 300,
      x,
      upperY,
      lowerY,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`Android FrameTimeline: ${outputPath} (${metrics.frameCount} frames)\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
