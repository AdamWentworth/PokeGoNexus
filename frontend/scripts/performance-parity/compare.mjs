#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  groupSamples,
  median,
  metricKey,
  percentile,
  readJson,
  validateReport,
} from './report.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, '../..');
const defaultContractPath = resolve(frontendDirectory, 'performance-parity/contract.json');

const parseArgs = (args) => {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`);
    const name = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${name}`);
    parsed[name] = next;
    index += 1;
  }
  return parsed;
};

const format = (value, unit) => value == null ? 'missing' : `${value.toFixed(value >= 100 ? 1 : 2)} ${unit}`;
const outcomeIcon = (status) => status === 'pass' ? 'PASS' : 'FAIL';

export const compareReports = ({ reference, candidate, contract, profile, scenarioPrefix = '' }) => {
  const failures = [
    ...validateReport(reference).map((failure) => `reference: ${failure}`),
    ...validateReport(candidate).map((failure) => `candidate: ${failure}`),
  ];
  const profileContract = contract.profiles?.[profile];
  if (!profileContract) failures.push(`contract has no profile named ${profile}`);
  if (reference.profile !== profile) failures.push(`reference profile is ${reference.profile}, expected ${profile}`);
  if (candidate.profile !== profile) failures.push(`candidate profile is ${candidate.profile}, expected ${profile}`);
  if (profileContract && reference.implementation !== profileContract.referenceImplementation) {
    failures.push(`reference implementation is ${reference.implementation}, expected ${profileContract.referenceImplementation}`);
  }
  if (profileContract && candidate.implementation !== profileContract.candidateImplementation) {
    failures.push(`candidate implementation is ${candidate.implementation}, expected ${profileContract.candidateImplementation}`);
  }
  for (const key of profileContract?.requiredEnvironmentMatches ?? []) {
    const referenceValue = reference.environment?.[key];
    const candidateValue = candidate.environment?.[key];
    if (referenceValue == null || candidateValue == null) {
      failures.push(`environment.${key} is missing from ${[
        referenceValue == null && 'reference',
        candidateValue == null && 'candidate',
      ].filter(Boolean).join(' and ')}`);
    } else if (referenceValue !== candidateValue) {
      failures.push(`environment.${key} differs: Vite=${referenceValue}, native=${candidateValue}`);
    }
  }

  const referenceGroups = groupSamples(reference.samples ?? []);
  const candidateGroups = groupSamples(candidate.samples ?? []);
  const requirements = [];
  const requiredRouteMetrics = profileContract?.requiredRouteMetrics ?? [];
  const requiredInteractionMetrics = profileContract?.requiredInteractionMetrics ?? [];
  const minimumSamplesKey = profileContract?.minimumSamplesFromEnvironment;
  const minimumSamples = minimumSamplesKey
    ? Number(reference.environment?.[minimumSamplesKey])
    : 0;
  if (minimumSamplesKey && (!Number.isInteger(minimumSamples) || minimumSamples < 1)) {
    failures.push(`environment.${minimumSamplesKey} must be a positive integer sample count`);
  }
  const includesScenario = (scenarioId) => !scenarioPrefix || scenarioId.startsWith(scenarioPrefix);
  for (const route of contract.routes ?? []) {
    if (!includesScenario(route.id)) continue;
    for (const metric of requiredRouteMetrics) requirements.push({ scenarioId: route.id, metric, phase: '' });
  }
  for (const interaction of contract.interactions ?? []) {
    if (!includesScenario(interaction.id)) continue;
    for (const metric of requiredInteractionMetrics) requirements.push({ scenarioId: interaction.id, metric, phase: '' });
  }
  if (includesScenario('global.runtime')) {
    for (const metric of profileContract?.requiredGlobalMetrics ?? []) {
      requirements.push({ scenarioId: 'global.runtime', metric, phase: '' });
    }
  }
  if (scenarioPrefix && requirements.length === 0) {
    failures.push(`contract has no required scenarios beginning with ${scenarioPrefix}`);
  }

  const rows = [];
  for (const requirement of requirements) {
    const key = metricKey(requirement);
    const baseline = referenceGroups.get(key);
    const native = candidateGroups.get(key);
    if (!baseline || !native) {
      const missing = [!baseline && 'Vite', !native && 'native'].filter(Boolean).join(' and ');
      rows.push({ ...requirement, status: 'fail', reason: `missing ${missing} evidence` });
      continue;
    }
    if (baseline.unit !== native.unit || baseline.direction !== native.direction) {
      rows.push({ ...requirement, status: 'fail', reason: 'unit or direction mismatch' });
      continue;
    }
    if (
      Number.isInteger(minimumSamples)
      && minimumSamples > 0
      && (baseline.values.length < minimumSamples || native.values.length < minimumSamples)
    ) {
      rows.push({
        ...requirement,
        status: 'fail',
        reason: `insufficient evidence: expected at least ${minimumSamples} samples`,
        referenceSamples: baseline.values.length,
        candidateSamples: native.values.length,
      });
      continue;
    }
    const referenceMedian = median(baseline.values);
    const candidateMedian = median(native.values);
    const referenceP95 = percentile(baseline.values, 0.95);
    const candidateP95 = percentile(native.values, 0.95);
    const passes = baseline.direction === 'lower'
      ? candidateMedian <= referenceMedian && candidateP95 <= referenceP95
      : candidateMedian >= referenceMedian && candidateP95 >= referenceP95;
    rows.push({
      ...requirement,
      status: passes ? 'pass' : 'fail',
      reason: passes ? '' : `native ${baseline.direction === 'lower' ? 'exceeded' : 'fell below'} Vite`,
      unit: baseline.unit,
      referenceMedian,
      candidateMedian,
      referenceP95,
      candidateP95,
      referenceSamples: baseline.values.length,
      candidateSamples: native.values.length,
    });
  }
  failures.push(...rows.filter(({ status }) => status === 'fail').map(
    ({ scenarioId, metric, reason }) => `${scenarioId}/${metric}: ${reason}`,
  ));
  return { status: failures.length ? 'fail' : 'pass', profile, failures, rows };
};

export const renderMarkdown = (result) => {
  const lines = [
    `# Performance parity: ${result.status.toUpperCase()}`,
    '',
    `Profile: \`${result.profile}\``,
    '',
    '| Result | Scenario | Metric | Vite median / p95 | Native median / p95 | Evidence |',
    '| --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const row of result.rows) {
    const reference = row.referenceMedian == null ? 'missing' : `${format(row.referenceMedian, row.unit)} / ${format(row.referenceP95, row.unit)}`;
    const candidate = row.candidateMedian == null ? 'missing' : `${format(row.candidateMedian, row.unit)} / ${format(row.candidateP95, row.unit)}`;
    const evidence = row.referenceSamples == null ? row.reason : `${row.referenceSamples} Vite, ${row.candidateSamples} native`;
    lines.push(`| ${outcomeIcon(row.status)} | \`${row.scenarioId}\` | \`${row.metric}\` | ${reference} | ${candidate} | ${evidence} |`);
  }
  if (result.failures.length) {
    lines.push('', '## Failures', '', ...result.failures.map((failure) => `- ${failure}`));
  }
  return `${lines.join('\n')}\n`;
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.reference || !args.candidate || !args.profile) {
      throw new Error('Usage: compare.mjs --reference vite.json --candidate native.json --profile browser-proxy [--scenario-prefix interaction.pokedex.] [--contract contract.json] [--output result.json]');
    }
    const contract = readJson(resolve(args.contract ?? defaultContractPath));
    const result = compareReports({
      reference: readJson(resolve(args.reference)),
      candidate: readJson(resolve(args.candidate)),
      contract,
      profile: args.profile,
      scenarioPrefix: args['scenario-prefix'] ?? '',
    });
    const output = resolve(args.output ?? 'performance-parity-result.json');
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(output.replace(/\.json$/i, '.md'), renderMarkdown(result));
    process.stdout.write(renderMarkdown(result));
    if (result.status !== 'pass') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
