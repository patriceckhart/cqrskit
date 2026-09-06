const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextVersion } = require('../scripts/release-version.cjs');

test('next increments patches and rolls patches and minors at 99', () => {
  assert.equal(nextVersion('0.0.1'), '0.0.2');
  assert.equal(nextVersion('0.0.98'), '0.0.99');
  assert.equal(nextVersion('0.0.99'), '0.1.0');
  assert.equal(nextVersion('0.1.99'), '0.2.0');
  assert.equal(nextVersion('0.99.98'), '0.99.99');
  assert.equal(nextVersion('0.99.99'), '1.0.0');
  assert.equal(nextVersion('1.0.0'), '1.0.1');
  assert.equal(nextVersion('1.99.99'), '2.0.0');
});

test('supports standard bumps and exact stable versions', () => {
  assert.equal(nextVersion('0.0.99', 'patch'), '0.0.100');
  assert.equal(nextVersion('0.0.3', 'minor'), '0.1.0');
  assert.equal(nextVersion('0.0.3', 'major'), '1.0.0');
  assert.equal(nextVersion('0.0.3', 'next', '0.2.0'), '0.2.0');
});

test('rejects invalid, equal, or older versions', () => {
  for (const version of ['0.0.2', '0.0.1', '01.0.0', 'bad', '1.0.0-beta', '1.0.0\n']) {
    assert.throws(() => nextVersion('0.0.2', 'next', version));
  }
  assert.throws(() => nextVersion('0.0.2', 'invalid'));
});
