const isValidEmail = require('../utils/validateEmail');

describe('email validation', () => {
  test.each([
    'trainer@example.com',
    'trainer.name+tag@sub.example.com'
  ])('accepts a structurally valid bounded address', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    '',
    '@example.com',
    'trainer.example.com',
    'trainer@@example.com',
    'trainer@example',
    'trainer@example.',
    'trainer @example.com',
    `trainer@${'a'.repeat(250)}.com`
  ])('rejects an invalid address without backtracking', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
