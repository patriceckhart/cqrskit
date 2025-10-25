import { Client } from 'genesisdb';
import { EventStoreAdapter, StreamOptions } from '../persistence/EventStoreAdapter';
import { RawEvent, EventToPublish, Precondition } from '../types/Event';

/**
 * Configuration for Genesis DB adapter
 */
export interface GenesisDBConfig {
  /** Genesis DB API URL (or set GENESISDB_API_URL env var) */
  apiUrl?: string;
  /** Auth token (or set GENESISDB_AUTH_TOKEN env var) */
  authToken?: string;
  /** API version (or set GENESISDB_API_VERSION env var) */
  apiVersion?: string;
  /** Source identifier for published events */
  source: string;
}

/**
 * Genesis DB implementation of EventStoreAdapter
 */
export class GenesisDBAdapter implements EventStoreAdapter {
  private client: Client;
  private source: string;

  constructor(config: GenesisDBConfig) {
    // Set environment variables if provided
    if (config.apiUrl) {
      process.env.GENESISDB_API_URL = config.apiUrl;
    }
    if (config.authToken) {
      process.env.GENESISDB_AUTH_TOKEN = config.authToken;
    }
    if (config.apiVersion) {
      process.env.GENESISDB_API_VERSION = config.apiVersion;
    }

    this.client = new Client();
    this.source = config.source;
  }

  async *streamEvents(
    subject: string,
    options?: StreamOptions,
    recursive: boolean = true
  ): AsyncIterable<RawEvent> {
    const streamOptions: any = {};

    if (options?.lowerBound) {
      streamOptions.lowerBound = options.lowerBound;
      streamOptions.includeLowerBoundEvent = options.includeLowerBound ?? false;
    }

    if (options?.upperBound) {
      streamOptions.upperBound = options.upperBound;
      streamOptions.includeUpperBoundEvent = options.includeUpperBound ?? false;
    }

    if (options?.latestByEventType) {
      streamOptions.latestByEventType = options.latestByEventType;
    }

    // Genesis DB uses the subject path to determine recursion
    // If recursive, we use the subject as-is; Genesis DB handles hierarchical queries
    const stream = await this.client.streamEvents(subject, streamOptions);

    for await (const event of stream) {
      yield this.mapToRawEvent(event);
    }
  }

  async *observeEvents(
    subject: string,
    options?: StreamOptions,
    recursive: boolean = true
  ): AsyncIterable<RawEvent> {
    const observeOptions: any = {};

    if (options?.lowerBound) {
      observeOptions.lowerBound = options.lowerBound;
      observeOptions.includeLowerBoundEvent = options.includeLowerBound ?? false;
    }

    if (options?.upperBound) {
      observeOptions.upperBound = options.upperBound;
      observeOptions.includeUpperBoundEvent = options.includeUpperBound ?? false;
    }

    if (options?.latestByEventType) {
      observeOptions.latestByEventType = options.latestByEventType;
    }

    for await (const event of this.client.observeEvents(subject, observeOptions)) {
      yield this.mapToRawEvent(event);
    }
  }

  async publishEvents(
    events: EventToPublish[],
    preconditions?: Precondition[]
  ): Promise<RawEvent[]> {
    const genesisEvents = events.map(event => ({
      source: event.source || this.source,
      subject: event.subject,
      type: event.type,
      data: event.data,
      ...(event.metadata && Object.keys(event.metadata).length > 0 ? { metadata: event.metadata } : {})
    }));

    const genesisPreconditions = preconditions?.map(pc => ({
      type: pc.type,
      payload: pc.payload
    }));

    // Commit events (Genesis DB commitEvents doesn't return the committed events)
    await this.client.commitEvents(genesisEvents, genesisPreconditions);

    // Stream back the latest events for each subject to get the committed events with IDs
    const publishedEvents: RawEvent[] = [];

    for (const event of events) {
      // Get the latest event of this type for this subject
      for await (const evt of await this.client.streamEvents(event.subject, {
        latestByEventType: event.type
      })) {
        publishedEvents.push(this.mapToRawEvent(evt));
        break; // Only take the first (latest) one
      }
    }

    return publishedEvents;
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  private mapToRawEvent(event: any): RawEvent {
    return {
      id: event.id,
      type: event.type,
      source: event.source,
      subject: event.subject,
      time: event.time,
      data: event.data || {},
      metadata: event.metadata || {}
    };
  }
}
