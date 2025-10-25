import { RawEvent, EventToPublish, Precondition } from '../types/Event';

/**
 * Options for streaming events
 */
export interface StreamOptions {
  /** Start from this event ID (exclusive unless includeLowerBound is true) */
  lowerBound?: string;
  /** Include the lower bound event itself */
  includeLowerBound?: boolean;
  /** Stop at this event ID (inclusive if includeUpperBound is true) */
  upperBound?: string;
  /** Include the upper bound event itself */
  includeUpperBound?: boolean;
  /** Return only latest event per event type (for snapshot queries) */
  latestByEventType?: string;
}

/**
 * Abstract adapter interface for event stores.
 * Implement this interface to integrate with any event store database.
 */
export interface EventStoreAdapter {
  /**
   * Stream historical events for a given subject
   * @param subject The subject path (supports hierarchical queries with recursive option)
   * @param options Streaming options (bounds, filters)
   * @param recursive Whether to include child subjects
   */
  streamEvents(
    subject: string,
    options?: StreamOptions,
    recursive?: boolean
  ): AsyncIterable<RawEvent>;

  /**
   * Observe events in real-time (listen for new events)
   * @param subject The subject path
   * @param options Observation options
   * @param recursive Whether to include child subjects
   */
  observeEvents(
    subject: string,
    options?: StreamOptions,
    recursive?: boolean
  ): AsyncIterable<RawEvent>;

  /**
   * Publish events atomically with optional preconditions
   * @param events Events to publish
   * @param preconditions Optional preconditions for conditional publishing
   * @returns The published events with assigned IDs
   */
  publishEvents(
    events: EventToPublish[],
    preconditions?: Precondition[]
  ): Promise<RawEvent[]>;

  /**
   * Health check for the connection
   */
  ping?(): Promise<void>;
}
