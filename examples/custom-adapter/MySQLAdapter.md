# MySQL Adapter for CQRSKit

This adapter demonstrates how to integrate CQRSKit with MySQL for event storage.

## Installation

```bash
npm install mysql2
```

## Database Setup

Create the events table:

```sql
CREATE TABLE events (
  id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  type VARCHAR(255) NOT NULL,
  data TEXT NOT NULL,
  metadata TEXT,
  source VARCHAR(255) NOT NULL,
  time VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subject (subject),
  INDEX idx_type (type),
  INDEX idx_time (time),
  INDEX idx_subject_time (subject, time)
);
```

## Usage

```typescript
import mysql from 'mysql2';
import { MySQLAdapter } from './examples/custom-adapter/MySQLAdapter';
import { CommandRouter } from 'cqrskit';

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'cqrs_events',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create adapter
const eventStore = new MySQLAdapter({
  pool,
  tableName: 'events' // optional, defaults to 'events'
});

// Test connection
await eventStore.ping();

// Use with CommandRouter
const commandRouter = new CommandRouter({
  eventStore,
  // ... other config
});
```

## Features

### Supported
- Event storage and retrieval
- Subject-based queries (exact and recursive)
- Event ID-based bounds (lowerBound, upperBound)
- Preconditions (optimistic locking)
- Transaction support

### Limitations
- **Real-time events**: Uses polling (1 second interval) instead of true streaming
- For production real-time use cases, consider:
  - MySQL binlog replication
  - Message queue (RabbitMQ, Kafka, Redis Streams)
  - Hybrid approach: MySQL for storage + Redis pub/sub for notifications

## Production Considerations

### Indexing
The schema includes indexes for common query patterns. Add additional indexes based on your usage:

```sql
-- For recursive subject queries
CREATE INDEX idx_subject_prefix ON events(subject(255));

-- For event type filtering
CREATE INDEX idx_type_time ON events(type, time);

-- For metadata queries (if needed)
CREATE INDEX idx_metadata ON events((CAST(metadata AS CHAR(255))));
```

### Partitioning
For high-volume systems, consider table partitioning by date:

```sql
ALTER TABLE events
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  -- Add more partitions
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### Connection Pool
Tune connection pool based on your workload:

```typescript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'cqrs_events',
  waitForConnections: true,
  connectionLimit: 50,      // Increase for high concurrency
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});
```

### Real-time Events
For production real-time event processing, use a hybrid approach:

```typescript
import { MySQLAdapter } from './MySQLAdapter';
import { RedisAdapter } from './RedisAdapter'; // Hypothetical

class HybridAdapter implements EventStoreAdapter {
  constructor(
    private mysql: MySQLAdapter,
    private redis: RedisAdapter
  ) {}

  // Store in MySQL
  async publishEvents(events: EventToPublish[]): Promise<RawEvent[]> {
    const published = await this.mysql.publishEvents(events);
    // Notify via Redis
    await this.redis.publish(events);
    return published;
  }

  // Stream from MySQL
  streamEvents(...args) {
    return this.mysql.streamEvents(...args);
  }

  // Observe via Redis, fallback to MySQL
  async *observeEvents(subject: string, options?: StreamOptions) {
    // Historical events from MySQL
    for await (const event of this.mysql.streamEvents(subject, options)) {
      yield event;
    }

    // Real-time events from Redis
    for await (const event of this.redis.subscribe(subject)) {
      yield event;
    }
  }
}
```

## Testing

```typescript
import { describe, it } from 'node:test';
import assert from 'assert';
import mysql from 'mysql2';
import { MySQLAdapter } from './MySQLAdapter';

describe('MySQLAdapter', () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'cqrs_events_test'
  });

  const adapter = new MySQLAdapter({ pool });

  it('should publish and stream events', async () => {
    const events = [{
      subject: '/test/1',
      type: 'TestEvent',
      data: { foo: 'bar' },
      metadata: {},
      source: 'test'
    }];

    const published = await adapter.publishEvents(events);
    assert.equal(published.length, 1);

    const streamed: any[] = [];
    for await (const event of adapter.streamEvents('/test/1')) {
      streamed.push(event);
    }

    assert.equal(streamed.length, 1);
    assert.equal(streamed[0].type, 'TestEvent');
  });
});
```

## Migration from Genesis DB

If you're migrating from Genesis DB:

1. **Keep the same event structure** - Both adapters use the same `RawEvent` interface
2. **Export events from Genesis DB** - Stream all events and insert into MySQL
3. **Update configuration** - Swap `GenesisDBAdapter` with `MySQLAdapter`
4. **Test thoroughly** - Ensure all queries work as expected

```typescript
// Migration script
async function migrateFromGenesisDB() {
  const genesisDB = new GenesisDBAdapter({ /* config */ });
  const mysql = new MySQLAdapter({ /* config */ });

  for await (const event of genesisDB.streamEvents('/', {}, true)) {
    await mysql.publishEvents([{
      subject: event.subject,
      type: event.type,
      data: event.data,
      metadata: event.metadata,
      source: event.source
    }]);
  }
}
```

## Alternative: PostgreSQL

For PostgreSQL, the adapter would be very similar. Key differences:

- Use `pg` package instead of `mysql2`
- Use `$1, $2` placeholders instead of `?`
- PostgreSQL has better JSON support: `JSONB` type
- PostgreSQL has `LISTEN/NOTIFY` for real-time events

See `PostgreSQLAdapter.ts` for a PostgreSQL implementation.
