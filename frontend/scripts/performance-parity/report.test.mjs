import assert from 'node:assert/strict';
import test from 'node:test';
import { compareReports } from './compare.mjs';
import { makeReport, median, percentile, validateReport } from './report.mjs';

const contract = {
  profiles: {
    'browser-proxy': {
      referenceImplementation: 'vite',
      candidateImplementation: 'native-web',
      requiredRouteMetrics: ['route_ready_ms'],
      requiredInteractionMetrics: ['interaction_ready_ms'],
    },
  },
  routes: [{ id: 'route.home' }],
  interactions: [{ id: 'interaction.menu' }],
};

const sample = (scenarioId, metric, value, sampleIndex = 0) => ({
  scenarioId,
  metric,
  value,
  sampleIndex,
  unit: 'ms',
  direction: 'lower',
});

const report = (implementation, samples) => makeReport({
  implementation,
  profile: 'browser-proxy',
  samples,
});

test('computes deterministic median and nearest-rank p95', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(percentile([1, 2, 3, 4, 100], 0.95), 100);
});

test('passes only when native median and p95 are no slower', () => {
  const reference = report('vite', [
    sample('route.home', 'route_ready_ms', 100, 0),
    sample('route.home', 'route_ready_ms', 120, 1),
    sample('interaction.menu', 'interaction_ready_ms', 50, 0),
  ]);
  const candidate = report('native-web', [
    sample('route.home', 'route_ready_ms', 90, 0),
    sample('route.home', 'route_ready_ms', 110, 1),
    sample('interaction.menu', 'interaction_ready_ms', 49, 0),
  ]);
  assert.equal(compareReports({ reference, candidate, contract, profile: 'browser-proxy' }).status, 'pass');
});

test('fails slower and missing native evidence', () => {
  const reference = report('vite', [
    sample('route.home', 'route_ready_ms', 100),
    sample('interaction.menu', 'interaction_ready_ms', 50),
  ]);
  const candidate = report('native-web', [sample('route.home', 'route_ready_ms', 101)]);
  const result = compareReports({ reference, candidate, contract, profile: 'browser-proxy' });
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some((failure) => failure.includes('exceeded Vite')));
  assert.ok(result.failures.some((failure) => failure.includes('missing native evidence')));
});

test('can enforce one bounded feature without requiring unrelated evidence', () => {
  const reference = report('vite', [sample('interaction.menu', 'interaction_ready_ms', 50)]);
  const candidate = report('native-web', [sample('interaction.menu', 'interaction_ready_ms', 45)]);
  const result = compareReports({
    reference,
    candidate,
    contract,
    profile: 'browser-proxy',
    scenarioPrefix: 'interaction.',
  });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.rows.map(({ scenarioId }) => scenarioId), ['interaction.menu']);
});

test('rejects a bounded feature prefix that matches no contract scenarios', () => {
  const reference = report('vite', []);
  const candidate = report('native-web', []);
  const result = compareReports({
    reference,
    candidate,
    contract,
    profile: 'browser-proxy',
    scenarioPrefix: 'interaction.missing.',
  });
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some((failure) => failure.includes('no required scenarios')));
});

test('rejects malformed samples instead of comparing them', () => {
  const malformed = report('vite', [sample('route.home', 'route_ready_ms', Number.NaN)]);
  assert.ok(validateReport(malformed).some((failure) => failure.includes('finite')));
});

test('rejects comparisons that used different workloads', () => {
  const environmentContract = {
    ...contract,
    profiles: {
      'browser-proxy': {
        ...contract.profiles['browser-proxy'],
        requiredEnvironmentMatches: ['workloadId'],
      },
    },
  };
  const reference = {
    ...report('vite', [
      sample('route.home', 'route_ready_ms', 100),
      sample('interaction.menu', 'interaction_ready_ms', 50),
    ]),
    environment: { workloadId: 'large' },
  };
  const candidate = {
    ...report('native-web', [
      sample('route.home', 'route_ready_ms', 90),
      sample('interaction.menu', 'interaction_ready_ms', 40),
    ]),
    environment: { workloadId: 'small' },
  };
  const result = compareReports({
    reference,
    candidate,
    contract: environmentContract,
    profile: 'browser-proxy',
  });
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some((failure) => failure.includes('workloadId differs')));
});

test('rejects fewer samples than the declared repetition count', () => {
  const repeatedContract = {
    ...contract,
    profiles: {
      'browser-proxy': {
        ...contract.profiles['browser-proxy'],
        requiredEnvironmentMatches: ['repetitions'],
        minimumSamplesFromEnvironment: 'repetitions',
      },
    },
  };
  const reference = {
    ...report('vite', [
      sample('route.home', 'route_ready_ms', 100),
      sample('interaction.menu', 'interaction_ready_ms', 50),
    ]),
    environment: { repetitions: 2 },
  };
  const candidate = {
    ...report('native-web', [
      sample('route.home', 'route_ready_ms', 90),
      sample('interaction.menu', 'interaction_ready_ms', 40),
    ]),
    environment: { repetitions: 2 },
  };
  const result = compareReports({
    reference,
    candidate,
    contract: repeatedContract,
    profile: 'browser-proxy',
  });
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some((failure) => failure.includes('insufficient evidence')));
});

test('requires the declared repetition count for global physical evidence', () => {
  const physicalContract = {
    profiles: {
      'physical-android': {
        referenceImplementation: 'vite',
        candidateImplementation: 'native-android',
        requiredEnvironmentMatches: ['repetitions'],
        minimumSamplesFromEnvironment: 'repetitions',
        requiredGlobalMetrics: ['frame_time_p95_ms'],
      },
    },
    routes: [],
    interactions: [],
  };
  const reference = {
    ...makeReport({
      implementation: 'vite',
      profile: 'physical-android',
      samples: [sample('global.runtime', 'frame_time_p95_ms', 5)],
    }),
    environment: { repetitions: 2 },
  };
  const candidate = {
    ...makeReport({
      implementation: 'native-android',
      profile: 'physical-android',
      samples: [sample('global.runtime', 'frame_time_p95_ms', 4)],
    }),
    environment: { repetitions: 2 },
  };
  const result = compareReports({
    reference,
    candidate,
    contract: physicalContract,
    profile: 'physical-android',
  });
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some((failure) => failure.includes('insufficient evidence')));
});
