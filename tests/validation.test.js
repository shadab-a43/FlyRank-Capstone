import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, validateSettings } from '../.test-build/validation.js';

const validValues = {
  name: 'Shadab',
  email: 'shadab@example.com',
  theme: 'system',
};

test('requires a name', () => {
  const errors = validateSettings({ ...validValues, name: '  ' });

  assert.equal(errors.name, 'Name is required.');
});

test('requires an email', () => {
  const errors = validateSettings({ ...validValues, email: '' });

  assert.equal(errors.email, 'Email is required.');
});

test('rejects an invalid email format', () => {
  const errors = validateSettings({ ...validValues, email: 'not-an-email' });

  assert.equal(errors.email, 'Enter a valid email address.');
});

test('accepts valid settings for every theme option', () => {
  for (const theme of ['light', 'dark', 'system']) {
    assert.deepEqual(validateSettings({ ...validValues, theme }), {});
  }
});

test('resolves light and dark themes directly', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('resolves the system theme from the system preference', () => {
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
});