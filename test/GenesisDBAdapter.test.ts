import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { GenesisDBAdapter } from '../src/adapters/GenesisDBAdapter';
import { EventToPublish } from '../src/types/Event';

/**
 * Integration test for GenesisDBAdapter
 *
 * Requires Genesis DB running on localhost:8080
 * with Bearer Token "secret"
 *
 * Run with: npm test
 */
describe('GenesisDBAdapter Integration', () => {
  let adapter: GenesisDBAdapter;
  const testSubject = `/test/${Date.now()}`;

  before(() => {
    // Configure adapter for localhost
    adapter = new GenesisDBAdapter({
      apiUrl: 'http://localhost:8080',
      authToken: 'secret',
      apiVersion: 'v1',
      source: 'cqrskit-test'
    });
  });

  it('should ping Genesis DB successfully', async () => {
    console.log('Testing connection to Genesis DB...');
    await adapter.ping();
    console.log('✓ Connection successful');
  });

  it('should publish events to Genesis DB', async () => {
    console.log('\nPublishing test events...');

    const events: EventToPublish[] = [
      {
        source: 'cqrskit-test',
        subject: testSubject,
        type: 'test.TestEvent1',
        data: {
          message: 'First test event',
          timestamp: new Date().toISOString()
        },
        metadata: {
          testRun: 'integration-test',
          version: '1.0'
        }
      },
      {
        source: 'cqrskit-test',
        subject: testSubject,
        type: 'test.TestEvent2',
        data: {
          message: 'Second test event',
          count: 42
        },
        metadata: {
          testRun: 'integration-test'
        }
      }
    ];

    const publishedEvents = await adapter.publishEvents(events);

    console.log(`✓ Published ${publishedEvents.length} events`);

    assert.strictEqual(publishedEvents.length, 2, 'Should publish 2 events');
    assert.ok(publishedEvents[0].id, 'First event should have ID');
    assert.ok(publishedEvents[1].id, 'Second event should have ID');
    assert.strictEqual(publishedEvents[0].type, 'test.TestEvent1');
    assert.strictEqual(publishedEvents[1].type, 'test.TestEvent2');

    publishedEvents.forEach((event, index) => {
      console.log(`  Event ${index + 1}: ${event.id} (${event.type})`);
    });
  });

  it('should stream events from Genesis DB', async () => {
    console.log('\nStreaming events from Genesis DB...');

    const events = [];
    for await (const event of adapter.streamEvents(testSubject, undefined, false)) {
      events.push(event);
      console.log(`  Read event: ${event.id} (${event.type})`);
    }

    assert.ok(events.length >= 2, 'Should read at least 2 events');
    assert.strictEqual(events[0].subject, testSubject);
    assert.ok(events[0].data, 'Event should have data');

    console.log(`✓ Streamed ${events.length} events`);
  });

  it('should stream events recursively', async () => {
    console.log('\nTesting recursive streaming...');

    // Publish events to child subjects
    const childEvents: EventToPublish[] = [
      {
        source: 'cqrskit-test',
        subject: `${testSubject}/child1`,
        type: 'test.ChildEvent',
        data: { child: 1 }
      },
      {
        source: 'cqrskit-test',
        subject: `${testSubject}/child2`,
        type: 'test.ChildEvent',
        data: { child: 2 }
      }
    ];

    await adapter.publishEvents(childEvents);
    console.log('  Published child events');

    // Stream all events recursively
    const events = [];
    for await (const event of adapter.streamEvents(testSubject, undefined, true)) {
      events.push(event);
      console.log(`  Read event: ${event.subject} (${event.type})`);
    }

    const parentEvents = events.filter(e => e.subject === testSubject);
    const childEventsRead = events.filter(e => e.subject.startsWith(`${testSubject}/`));

    console.log(`  Parent events: ${parentEvents.length}`);
    console.log(`  Child events: ${childEventsRead.length}`);

    assert.ok(parentEvents.length >= 2, 'Should have parent events');
    assert.strictEqual(childEventsRead.length, 2, 'Should have 2 child events');

    console.log(`✓ Recursive streaming works`);
  });

  it('should stream events with lower bound', async () => {
    console.log('\nTesting streaming with bounds...');

    // Get all events
    const allEvents = [];
    for await (const event of adapter.streamEvents(testSubject, undefined, false)) {
      allEvents.push(event);
    }

    if (allEvents.length < 2) {
      console.log('  WARNING: Not enough events for bound testing');
      return;
    }

    // Stream from second event
    const fromSecond = [];
    for await (const event of adapter.streamEvents(testSubject, {
      lowerBound: allEvents[0].id,
      includeLowerBound: false
    }, false)) {
      fromSecond.push(event);
    }

    console.log(`  Events after first: ${fromSecond.length}`);
    assert.strictEqual(fromSecond.length, allEvents.length - 1);
    assert.strictEqual(fromSecond[0].id, allEvents[1].id);

    console.log('✓ Bounded streaming works');
  });

  it('should publish events with preconditions', async () => {
    console.log('\nTesting preconditions...');

    const newSubject = `/test/precondition/${Date.now()}`;

    // First event should succeed (subject is new)
    const events: EventToPublish[] = [{
      source: 'cqrskit-test',
      subject: newSubject,
      type: 'test.FirstEvent',
      data: { first: true }
    }];

    const preconditions = [{
      type: 'isSubjectNew',
      payload: { subject: newSubject }
    }];

    await adapter.publishEvents(events, preconditions);
    console.log('  ✓ First event published with isSubjectNew precondition');

    // Second event should fail (subject already exists)
    try {
      await adapter.publishEvents(events, preconditions);
      assert.fail('Should have thrown error for duplicate subject');
    } catch (error: any) {
      console.log('  ✓ Precondition correctly rejected duplicate subject');
      assert.ok(error.message, 'Should have error message');
    }
  });

  it('should observe new events in real-time', async () => {
    console.log('\nTesting real-time observation...');

    const observeSubject = `/test/observe/${Date.now()}`;
    const receivedEvents: any[] = [];

    // Start observing in background
    const observePromise = (async () => {
      let count = 0;
      for await (const event of adapter.observeEvents(observeSubject, undefined, false)) {
        receivedEvents.push(event);
        console.log(`  Observed event ${count + 1}: ${event.type}`);
        count++;
        if (count >= 2) break; // Stop after receiving 2 events
      }
    })();

    // Wait a bit for observation to start
    await sleep(100);

    // Publish events
    console.log('  Publishing events...');
    await adapter.publishEvents([
      {
        source: 'cqrskit-test',
        subject: observeSubject,
        type: 'test.ObservedEvent1',
        data: { order: 1 }
      }
    ]);

    await sleep(100);

    await adapter.publishEvents([
      {
        source: 'cqrskit-test',
        subject: observeSubject,
        type: 'test.ObservedEvent2',
        data: { order: 2 }
      }
    ]);

    // Wait for observation to complete
    await observePromise;

    assert.strictEqual(receivedEvents.length, 2, 'Should observe 2 events');
    console.log('✓ Real-time observation works');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
