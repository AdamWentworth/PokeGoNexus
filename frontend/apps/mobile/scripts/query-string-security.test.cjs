const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const test = require('node:test');

// Resolve through Expo Router so this checks the dependency used by native
// navigation, including the CommonJS bridge to the patched ESM decoder.
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryString = routerRequire('query-string');

test('native route queries decode Unicode, plus signs and repeated parameters', () => {
  const parsed = queryString.parse('name=Pok%C3%A9mon+GO&tag=caught&tag=favorites&literal=%2B');
  assert.deepEqual({ ...parsed }, {
    name: 'Pokémon GO', tag: ['caught', 'favorites'], literal: '+',
  });
});

test('native route parameters survive query serialization', () => {
  const params = { name: 'Flabébé', search: 'CP > 2000 & shiny', tag: ['caught', 'favorites'] };
  assert.deepEqual({ ...queryString.parse(queryString.stringify(params)) }, params);
  const { url, query } = queryString.parseUrl('pokegonexus://pokemon?search=Mr.%20Mime');
  assert.equal(url, 'pokegonexus://pokemon');
  assert.equal(query.search, 'Mr. Mime');
});

test('malformed percent-encoded input completes without excessive decoding', () => {
  // Isolate a regression so a vulnerable decoder cannot hang the test runner.
  const result = spawnSync(process.execPath, ['-e', `
    const queryString = require(${JSON.stringify(routerRequire.resolve('query-string'))});
    const assert = require('node:assert/strict');
    const input = '%C2'.repeat(20_000);
    const parsed = queryString.parse('search=' + input + '&valid=Pok%C3%A9mon');
    assert.equal(typeof parsed.search, 'string');
    assert.equal(parsed.valid, 'Pokémon');
  `], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
