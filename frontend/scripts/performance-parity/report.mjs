import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const REPORT_SCHEMA_VERSION = 1;

const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const currentCommit = (cwd = process.cwd()) => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
};

export const validateReport = (report) => {
  const failures = [];
  if (!report || typeof report !== 'object') return ['report must be an object'];
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION) failures.push('schemaVersion must be 1');
  if (!['vite', 'native-web', 'native-android'].includes(report.implementation)) {
    failures.push(`unsupported implementation: ${report.implementation}`);
  }
  if (!['browser-proxy', 'physical-android', 'android-diagnostic'].includes(report.profile)) {
    failures.push(`unsupported profile: ${report.profile}`);
  }
  if (!Array.isArray(report.samples)) failures.push('samples must be an array');
  else report.samples.forEach((sample, index) => {
    const prefix = `samples[${index}]`;
    if (!sample?.scenarioId) failures.push(`${prefix}.scenarioId is required`);
    if (!sample?.metric) failures.push(`${prefix}.metric is required`);
    if (!['ms', 'bytes', 'count', 'fps', 'percent'].includes(sample?.unit)) {
      failures.push(`${prefix}.unit is invalid`);
    }
    if (!['lower', 'higher'].includes(sample?.direction)) {
      failures.push(`${prefix}.direction is invalid`);
    }
    if (!finiteNonNegative(sample?.value)) failures.push(`${prefix}.value must be finite and non-negative`);
    if (!Number.isInteger(sample?.sampleIndex) || sample.sampleIndex < 0) {
      failures.push(`${prefix}.sampleIndex must be a non-negative integer`);
    }
  });
  return failures;
};

export const makeReport = ({ implementation, profile, environment = {}, commit = currentCommit(), samples = [] }) => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  implementation,
  profile,
  createdAt: new Date().toISOString(),
  commit,
  environment,
  samples,
});

export const writeReport = (path, report) => {
  const failures = validateReport(report);
  if (failures.length) throw new Error(`Invalid performance report:\n${failures.join('\n')}`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
};

export const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export const metricKey = ({ scenarioId, metric, phase = '' }) => `${scenarioId}\u0000${metric}\u0000${phase}`;

export const groupSamples = (samples) => {
  const groups = new Map();
  for (const sample of samples.filter(({ diagnostic }) => !diagnostic)) {
    const key = metricKey(sample);
    const group = groups.get(key) ?? {
      scenarioId: sample.scenarioId,
      metric: sample.metric,
      phase: sample.phase ?? '',
      unit: sample.unit,
      direction: sample.direction,
      values: [],
    };
    group.values.push(sample.value);
    groups.set(key, group);
  }
  return groups;
};
