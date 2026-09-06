const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const fromGenesis = createRequire(require.resolve('genesisdb'));
const { CloudEvent, HTTP } = fromGenesis('cloudevents');
const fromCloudEvents = createRequire(fromGenesis.resolve('cloudevents'));
const { validate, version } = fromCloudEvents('uuid');
const { Client } = require('genesisdb');

const eventProperties = {
  source: 'urn:cqrskit:test',
  subject: '/test/dependency-compatibility',
  type: 'test.Created',
  data: { message: 'Grüße', count: 42 }
};

test('CloudEvents generates valid unique UUID v4 identifiers', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const event = new CloudEvent(eventProperties);
    assert.equal(validate(event.id), true);
    assert.equal(version(event.id), 4);
    ids.add(event.id);
  }
  assert.equal(ids.size, 100);
});

test('CloudEvents validates and round-trips structured events', () => {
  const event = new CloudEvent(eventProperties);
  assert.equal(event.validate(), true);
  const message = HTTP.structured(event);
  const restored = HTTP.toEvent(message);
  assert.equal(restored.id, event.id);
  assert.equal(restored.subject, event.subject);
  assert.deepEqual(restored.data, eventProperties.data);
  assert.throws(() => new CloudEvent({ source: 'urn:test' }));
});

test('GenesisDB parses streamed CloudEvents with upgraded dependencies', async (t) => {
  const event = new CloudEvent(eventProperties);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://genesis.invalid/api/v1/stream');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.body).subject, eventProperties.subject);
    return new Response(`${JSON.stringify(event)}\n`, {
      headers: { 'Content-Type': 'application/x-ndjson' }
    });
  });
  const client = new Client({
    apiUrl: 'https://genesis.invalid',
    apiVersion: 'v1',
    authToken: 'test-token'
  });
  const events = await client.streamEvents(eventProperties.subject);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, event.id);
  assert.deepEqual(events[0].data, eventProperties.data);
});

test('built package loads its public GenesisDB adapter', () => {
  const { GenesisDBAdapter } = require('../dist');
  assert.equal(typeof GenesisDBAdapter, 'function');
});
