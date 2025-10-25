import {
  EventStoreAdapter,
  RawEvent,
  EventToPublish,
  Precondition,
  StreamOptions
} from '../../src';

/**
 * PostgreSQL Event Store Adapter
 *
 * This adapter demonstrates how to integrate CQRSKit with PostgreSQL for event storage.
 * Unlike MySQL, PostgreSQL has native LISTEN/NOTIFY for real-time event streaming.
 *
 * Requirements:
 * - npm install pg
 *
 * Database Schema:
 *
 * CREATE TABLE events (
 *   id VARCHAR(255) PRIMARY KEY,
 *   subject VARCHAR(500) NOT NULL,
 *   type VARCHAR(255) NOT NULL,
 *   data JSONB NOT NULL,
 *   metadata JSONB DEFAULT '{}'::jsonb,
 *   source VARCHAR(255) NOT NULL,
 *   time VARCHAR(50) NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * CREATE INDEX idx_subject ON events(subject);
 * CREATE INDEX idx_type ON events(type);
 * CREATE INDEX idx_time ON events(time);
 * CREATE INDEX idx_subject_time ON events(subject, time);
 * CREATE INDEX idx_data ON events USING GIN(data);
 * CREATE INDEX idx_metadata ON events USING GIN(metadata);
 *
 * -- Trigger for NOTIFY on insert
 * CREATE OR REPLACE FUNCTION notify_event_insert()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   PERFORM pg_notify('events_channel',
 *     json_build_object(
 *       'id', NEW.id,
 *       'subject', NEW.subject,
 *       'type', NEW.type
 *     )::text
 *   );
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER event_insert_trigger
 * AFTER INSERT ON events
 * FOR EACH ROW
 * EXECUTE FUNCTION notify_event_insert();
 */

// Using 'any' for pg to avoid requiring it as a dependency
type PostgreSQLPool = any;
type PostgreSQLClient = any;

export interface PostgreSQLAdapterConfig {
  /**
   * PostgreSQL connection pool (from pg)
   * Example: new Pool({ host, user, password, database })
   */
  pool: PostgreSQLPool;

  /**
   * Table name for storing events (default: 'events')
   */
  tableName?: string;

  /**
   * Channel name for LISTEN/NOTIFY (default: 'events_channel')
   */
  channelName?: string;
}

export class PostgreSQLAdapter implements EventStoreAdapter {
  private pool: PostgreSQLPool;
  private tableName: string;
  private channelName: string;

  constructor(config: PostgreSQLAdapterConfig) {
    this.pool = config.pool;
    this.tableName = config.tableName || 'events';
    this.channelName = config.channelName || 'events_channel';
  }

  /**
   * Stream historical events from PostgreSQL
   */
  async *streamEvents(
    subject: string,
    options?: StreamOptions,
    recursive?: boolean
  ): AsyncIterable<RawEvent> {
    const client = await this.pool.connect();

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (recursive) {
        conditions.push(`(subject = $${paramIndex} OR subject LIKE $${paramIndex + 1})`);
        params.push(subject, `${subject}/%`);
        paramIndex += 2;
      } else {
        conditions.push(`subject = $${paramIndex}`);
        params.push(subject);
        paramIndex++;
      }

      // Add event ID bounds
      if (options?.lowerBound) {
        const comparison = options.includeLowerBound ? '>=' : '>';
        conditions.push(`time ${comparison} (SELECT time FROM ${this.tableName} WHERE id = $${paramIndex})`);
        params.push(options.lowerBound);
        paramIndex++;
      }

      if (options?.upperBound) {
        const comparison = options.includeUpperBound ? '<=' : '<';
        conditions.push(`time ${comparison} (SELECT time FROM ${this.tableName} WHERE id = $${paramIndex})`);
        params.push(options.upperBound);
        paramIndex++;
      }

      // Build query
      let query = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} ORDER BY time ASC`;

      // Execute query
      const result = await client.query(query, params);

      // Yield events
      for (const row of result.rows) {
        yield this.mapRowToRawEvent(row);
      }

      // Handle latestByEventType
      if (options?.latestByEventType) {
        const latestQuery = `
          SELECT * FROM ${this.tableName}
          WHERE subject = $1 AND type = $2
          ORDER BY time DESC
          LIMIT 1
        `;
        const latestResult = await client.query(latestQuery, [
          subject,
          options.latestByEventType
        ]);

        if (latestResult.rows.length > 0) {
          yield this.mapRowToRawEvent(latestResult.rows[0]);
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Observe events in real-time using PostgreSQL LISTEN/NOTIFY
   */
  async *observeEvents(
    subject: string,
    options?: StreamOptions,
    recursive?: boolean
  ): AsyncIterable<RawEvent> {
    // First, stream all historical events
    for await (const event of this.streamEvents(subject, options, recursive)) {
      yield event;
    }

    // Then listen for new events via NOTIFY
    const client = await this.pool.connect();

    try {
      await client.query(`LISTEN ${this.channelName}`);

      // Create async generator for notifications
      const notificationQueue: any[] = [];
      let resolveNext: ((value: any) => void) | null = null;

      client.on('notification', async (msg: any) => {
        if (msg.channel !== this.channelName) return;

        try {
          const payload = JSON.parse(msg.payload);

          // Check if this event matches our subject
          const eventSubject = payload.subject;
          const matches = recursive
            ? eventSubject === subject || eventSubject.startsWith(`${subject}/`)
            : eventSubject === subject;

          if (matches) {
            // Fetch full event details
            const result = await client.query(
              `SELECT * FROM ${this.tableName} WHERE id = $1`,
              [payload.id]
            );

            if (result.rows.length > 0) {
              const event = this.mapRowToRawEvent(result.rows[0]);

              if (resolveNext) {
                resolveNext(event);
                resolveNext = null;
              } else {
                notificationQueue.push(event);
              }
            }
          }
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      });

      // Yield events as they arrive
      while (true) {
        if (notificationQueue.length > 0) {
          yield notificationQueue.shift();
        } else {
          // Wait for next notification
          const event = await new Promise<RawEvent>((resolve) => {
            resolveNext = resolve;
          });
          yield event;
        }
      }
    } finally {
      await client.query(`UNLISTEN ${this.channelName}`);
      client.release();
    }
  }

  /**
   * Publish events to PostgreSQL
   */
  async publishEvents(
    events: EventToPublish[],
    preconditions?: Precondition[]
  ): Promise<RawEvent[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check preconditions
      if (preconditions && preconditions.length > 0) {
        for (const precondition of preconditions) {
          await this.checkPrecondition(client, precondition);
        }
      }

      // Insert events
      const publishedEvents: RawEvent[] = [];
      const time = new Date().toISOString();

      for (const event of events) {
        const id = this.generateId();
        const rawEvent: RawEvent = {
          id,
          subject: event.subject,
          type: event.type,
          data: event.data,
          metadata: event.metadata || {},
          source: event.source,
          time
        };

        const query = `
          INSERT INTO ${this.tableName} (id, subject, type, data, metadata, source, time)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        await client.query(query, [
          rawEvent.id,
          rawEvent.subject,
          rawEvent.type,
          rawEvent.data,
          rawEvent.metadata,
          rawEvent.source,
          rawEvent.time
        ]);

        publishedEvents.push(rawEvent);
      }

      await client.query('COMMIT');

      // NOTIFY will be triggered automatically by the trigger

      return publishedEvents;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if adapter is healthy
   */
  async ping(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Check precondition
   *
   * Supports precondition types:
   * - isSubjectNew: { subject: string } - subject must not exist
   * - lastEventId: { subject: string, expectedLastEventId: string } - optimistic locking
   */
  private async checkPrecondition(
    client: PostgreSQLClient,
    precondition: Precondition
  ): Promise<void> {
    if (precondition.type === 'isSubjectNew') {
      const subject = precondition.payload.subject;
      const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE subject = $1`;
      const result = await client.query(query, [subject]);

      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`Precondition failed: subject '${subject}' already exists`);
      }
    } else if (precondition.type === 'lastEventId') {
      const subject = precondition.payload.subject;
      const expectedId = precondition.payload.expectedLastEventId;

      const query = `
        SELECT id FROM ${this.tableName}
        WHERE subject = $1
        ORDER BY time DESC
        LIMIT 1
      `;
      const result = await client.query(query, [subject]);
      const lastEventId = result.rows.length > 0 ? result.rows[0].id : null;

      if (lastEventId !== expectedId) {
        throw new Error(
          `Precondition failed for subject '${subject}': ` +
          `expected last event ID '${expectedId}', but got '${lastEventId}'`
        );
      }
    }
  }

  /**
   * Helper: Map database row to RawEvent
   */
  private mapRowToRawEvent(row: any): RawEvent {
    return {
      id: row.id,
      subject: row.subject,
      type: row.type,
      data: row.data, // Already parsed by pg (JSONB)
      metadata: row.metadata || {},
      source: row.source,
      time: row.time
    };
  }

  /**
   * Helper: Generate unique event ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
