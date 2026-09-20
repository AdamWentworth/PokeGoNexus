import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contract = JSON.parse(readFileSync(
  new URL('../../performance-parity/contract.json', import.meta.url),
  'utf8',
));

test('public information and legal pages remain explicit route contracts', () => {
  const routes = new Map(contract.routes.map((route) => [route.id, route]));
  const expected = [
    ['route.getting-started', '/getting-started', '/native/info/getting-started'],
    ['route.help', '/help', '/native/info/help'],
    ['route.faq', '/faq', '/native/info/faq'],
    ['route.about', '/about', '/native/info/about'],
    ['route.safety', '/safety', '/native/info/safety'],
    ['route.privacy', '/privacy', '/native/info/privacy'],
    ['route.terms', '/terms', '/native/info/terms'],
    ['route.data-deletion', '/data-deletion', '/native/info/data-deletion'],
  ];
  for (const [id, vite, native] of expected) {
    assert.deepEqual(routes.get(id), { id, auth: 'guest', vite, native });
  }
});

test('FAQ interaction performance remains pinned across Vite and native', () => {
  const interactions = new Map(
    contract.interactions.map((interaction) => [interaction.id, interaction]),
  );
  assert.deepEqual(interactions.get('interaction.information.faq.category-result'), {
    id: 'interaction.information.faq.category-result',
    vite: 'selected FAQ topic questions visible',
    nativeEvent: 'information_faq_category_result_painted',
  });
  assert.deepEqual(interactions.get('interaction.information.faq.answer-result'), {
    id: 'interaction.information.faq.answer-result',
    vite: 'changed FAQ answer visibility committed',
    nativeEvent: 'information_faq_answer_result_painted',
  });
  assert.deepEqual(interactions.get('interaction.information.faq.search-result'), {
    id: 'interaction.information.faq.search-result',
    vite: 'matching FAQ search results visible',
    nativeEvent: 'information_faq_search_result_painted',
  });
  assert.deepEqual(interactions.get('interaction.information.faq.clear-result'), {
    id: 'interaction.information.faq.clear-result',
    vite: 'common FAQ questions restored',
    nativeEvent: 'information_faq_clear_result_painted',
  });
});
