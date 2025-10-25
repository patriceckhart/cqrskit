import {
  EventStoreAdapter,
  RawEvent,
  EventToPublish,
  Precondition,
  StreamOptions
} from '../../src';

/**
 * MySQL Event Store Adapter
 *
 * This adapter demonstrates how to integrate CQRSKit with MySQL for event storage.
 *
 * Requirements:
 * - npm install mysql2
 *
 * Database Schema:
 *
 * CREATE TABLE events (
 *   id VARCHAR(255) PRIMARY KEY,
 *   subject VARCHAR(500) NOT NULL,
 *   type VARCHAR(255) NOT NULL,
 *   data TEXT NOT NULL,
 *   metadata TEXT,
 *   source VARCHAR(255) NOT NULL,
 *   time VARCHAR(50) NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   INDEX idx_subject (subject),
 *   INDEX idx_type (type),
 *   INDEX idx_time (time),
 *   INDEX idx_subject_time (subject, time)
 * );
 */

// Using 'any' for mysql2 to avoid requiring it as a dependency
type MySQLConnection = any;
type MySQLPool = any;

export interface MySQLAdapterConfig {
  /**
   * MySQL connection pool (from mysql2)
   * Example: mysql.createPool({ host, user, password, database })
   */
  pool: MySQLPool;

  /**
   * Table name for storing events (default: 'events')
   */
  tableName?: string;
}

export class MySQLAdapter implements EventStoreAdapter {
  private pool: MySQLPool;
  private tableName: string;

  constructor(config: MySQLAdapterConfig) {
    this.pool = config.pool;
    this.tableName = config.tableName || 'events';
  }

  /**
   * Stream historical events from MySQL
   */
  async *streamEvents(
    subject: string,
    options?: StreamOptions,
    recursive?: boolean
  ): AsyncIterable<RawEvent> {
    const connection = await this.pool.promise().getConnection();

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];

      if (recursive) {
        conditions.push('(subject = ? OR subject LIKE ?)');
        params.push(subject, `${subject}/%`);
      } else {
        conditions.push('subject = ?');
        params.push(subject);
      }

      // Add event ID bounds
      if (options?.lowerBound) {
        const comparison = options.includeLowerBound ? '>=' : '>';
        conditions.push(`time ${comparison} (SELECT time FROM ?? WHERE id = ?)`);
        params.push(this.tableName, options.lowerBound);
      }

      if (options?.upperBound) {
        const comparison = options.includeUpperBound ? '<=' : '<';
        conditions.push(`time ${comparison} (SELECT time FROM ?? WHERE id = ?)`);
        params.push(this.tableName, options.upperBound);
      }

      // Build query
      let query = `SELECT * FROM ?? WHERE ${conditions.join(' AND ')} ORDER BY time ASC`;
      const queryParams = [this.tableName, ...params];

      // Execute query
      const [rows] = await connection.query(query, queryParams);

      // Yield events
      for (const row of rows) {
        yield this.mapRowToRawEvent(row);
      }

      // Handle latestByEventType
      if (options?.latestByEventType) {
        const latestQuery = `
          SELECT * FROM ??
          WHERE subject = ? AND type = ?
          ORDER BY time DESC
          LIMIT 1
        `;
        const [latestRows] = await connection.query(latestQuery, [
          this.tableName,
          subject,
          options.latestByEventType
        ]);

        if (latestRows.length > 0) {
          yield this.mapRowToRawEvent(latestRows[0]);
        }
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Observe events in real-time
   *
   * Note: MySQL doesn't have native event streaming like Genesis DB.
   * This implementation uses polling. For production, consider:
   * - Using MySQL binlog replication
   * - Using a message queue (RabbitMQ, Kafka)
   * - Using Redis pub/sub alongside MySQL
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

    // Then poll for new events
    let lastEventId: string | null = null;

    // Get the ID of the last historical event
    const historicalEvents: RawEvent[] = [];
    for await (const event of this.streamEvents(subject, options, recursive)) {
      historicalEvents.push(event);
    }
    if (historicalEvents.length > 0) {
      lastEventId = historicalEvents[historicalEvents.length - 1].id;
    }

    while (true) {
      await this.sleep(1000); // Poll every second

      const newEvents: RawEvent[] = [];

      for await (const event of this.streamEvents(
        subject,
        lastEventId ? { lowerBound: lastEventId, includeLowerBound: false } : undefined,
        recursive
      )) {
        newEvents.push(event);
      }

      // Yield new events
      for (const event of newEvents) {
        lastEventId = event.id;
        yield event;
      }
    }
  }

  /**
   * Publish events to MySQL
   */
  async publishEvents(
    events: EventToPublish[],
    preconditions?: Precondition[]
  ): Promise<RawEvent[]> {
    const connection = await this.pool.promise().getConnection();

    try {
      await connection.beginTransaction();

      // Check preconditions
      if (preconditions && preconditions.length > 0) {
        for (const precondition of preconditions) {
          await this.checkPrecondition(connection, precondition);
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
          INSERT INTO ?? (id, subject, type, data, metadata, source, time)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await connection.query(query, [
          this.tableName,
          rawEvent.id,
          rawEvent.subject,
          rawEvent.type,
          JSON.stringify(rawEvent.data),
          JSON.stringify(rawEvent.metadata),
          rawEvent.source,
          rawEvent.time
        ]);

        publishedEvents.push(rawEvent);
      }

      await connection.commit();
      return publishedEvents;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if adapter is healthy
   */
  async ping(): Promise<void> {
    const connection = await this.pool.promise().getConnection();
    try {
      await connection.query('SELECT 1');
    } finally {
      connection.release();
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
    connection: MySQLConnection,
    precondition: Precondition
  ): Promise<void> {
    if (precondition.type === 'isSubjectNew') {
      const subject = precondition.payload.subject;
      const query = `SELECT COUNT(*) as count FROM ?? WHERE subject = ?`;
      const [rows] = await connection.query(query, [this.tableName, subject]);

      if (rows[0].count > 0) {
        throw new Error(`Precondition failed: subject '${subject}' already exists`);
      }
    } else if (precondition.type === 'lastEventId') {
      const subject = precondition.payload.subject;
      const expectedId = precondition.payload.expectedLastEventId;

      const query = `
        SELECT id FROM ??
        WHERE subject = ?
        ORDER BY time DESC
        LIMIT 1
      `;
      const [rows] = await connection.query(query, [this.tableName, subject]);
      const lastEventId = rows.length > 0 ? rows[0].id : null;

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
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
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

  /**
   * Helper: Sleep for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
