import {
  EventStoreAdapter,
  StreamOptions,
  RawEvent,
  EventToPublish,
  Precondition
} from '../../src';

/**
 * Simple in-memory event store adapter for testing and demos
 *
 * This demonstrates how easy it is to create a custom adapter
 * for any database or event store.
 */
export class InMemoryAdapter implements EventStoreAdapter {
  private events: RawEvent[] = [];
  private idCounter = 0;

  async *streamEvents(
    subject: string,
    options?: StreamOptions,
    recursive: boolean = true
  ): AsyncIterable<RawEvent> {
    let filteredEvents = this.filterEventsBySubject(subject, recursive);

    // Apply bounds
    if (options?.lowerBound) {
      const lowerIndex = filteredEvents.findIndex(e => e.id === options.lowerBound);
      if (lowerIndex >= 0) {
        filteredEvents = filteredEvents.slice(
          lowerIndex + (options.includeLowerBound ? 0 : 1)
        );
      }
    }

    if (options?.upperBound) {
      const upperIndex = filteredEvents.findIndex(e => e.id === options.upperBound);
      if (upperIndex >= 0) {
        filteredEvents = filteredEvents.slice(
          0,
          upperIndex + (options.includeUpperBound ? 1 : 0)
        );
      }
    }

    // Apply latestByEventType filter
    if (options?.latestByEventType) {
      const latestByType = new Map<string, RawEvent>();
      for (const event of filteredEvents) {
        if (event.type === options.latestByEventType) {
          latestByType.set(event.subject, event);
        }
      }
      filteredEvents = Array.from(latestByType.values());
    }

    for (const event of filteredEvents) {
      yield event;
    }
  }

  async *observeEvents(
    subject: string,
    options?: StreamOptions,
    recursive: boolean = true
  ): AsyncIterable<RawEvent> {
    // First, yield historical events
    for await (const event of this.streamEvents(subject, options, recursive)) {
      yield event;
    }

    // Then wait for new events (in a real implementation, this would use pub/sub)
    // For this demo, we just return
    // In practice, you'd set up event listeners here
  }

  async publishEvents(
    events: EventToPublish[],
    preconditions?: Precondition[]
  ): Promise<RawEvent[]> {
    // Check preconditions
    if (preconditions) {
      for (const precondition of preconditions) {
        this.checkPrecondition(precondition);
      }
    }

    // Create and store events
    const publishedEvents: RawEvent[] = [];

    for (const event of events) {
      const rawEvent: RawEvent = {
        id: `event-${this.idCounter++}`,
        type: event.type,
        source: event.source,
        subject: event.subject,
        time: new Date().toISOString(),
        data: event.data,
        metadata: event.metadata || {}
      };

      this.events.push(rawEvent);
      publishedEvents.push(rawEvent);
    }

    return publishedEvents;
  }

  async ping(): Promise<void> {
    // Always healthy for in-memory adapter
  }

  /**
   * Filter events by subject
   */
  private filterEventsBySubject(subject: string, recursive: boolean): RawEvent[] {
    if (recursive) {
      // Include all events where subject starts with the given subject
      return this.events.filter(e =>
        e.subject === subject || e.subject.startsWith(subject + '/')
      );
    } else {
      // Exact match only
      return this.events.filter(e => e.subject === subject);
    }
  }

  /**
   * Check a precondition
   */
  private checkPrecondition(precondition: Precondition): void {
    if (precondition.type === 'isSubjectNew') {
      const subject = precondition.payload.subject as string;
      const exists = this.events.some(e => e.subject === subject);
      if (exists) {
        throw new Error(`Precondition failed: subject '${subject}' already exists`);
      }
    }
    // Add more precondition types as needed
  }

  /**
   * Get all events (for testing)
   */
  getAllEvents(): RawEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
    this.idCounter = 0;
  }
}
