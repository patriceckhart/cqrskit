import { EventHandler } from './EventHandler';
import { EventHandlerDefinition } from './EventHandlerDefinition';
import { EventStoreAdapter } from '../persistence/EventStoreAdapter';
import { EventTypeResolver } from '../types/EventTypeResolver';
import { EventDataMarshaller } from '../serialization/EventDataMarshaller';
import { EventUpcasters } from '../upcaster/EventUpcaster';
import { ProgressTracker } from './progress/ProgressTracker';
import { PartitionKeyResolver } from './partitioning/PartitionKeyResolver';
import { EventSequenceResolver } from './partitioning/EventSequenceResolver';
import { RawEvent } from '../types/Event';

/**
 * Configuration for EventHandlingProcessor
 */
export interface EventHandlingProcessorConfig {
  group: string;
  eventStore: EventStoreAdapter;
  eventTypeResolver: EventTypeResolver;
  eventDataMarshaller: EventDataMarshaller;
  eventHandlers: EventHandlerDefinition<any>[];
  progressTracker: ProgressTracker;
  partitionKeyResolver: PartitionKeyResolver;
  eventSequenceResolver: EventSequenceResolver;
  subject: string;
  recursive?: boolean;
  partition: number;
  upcasters?: EventUpcasters;
  retryDelay?: number;
  maxRetries?: number;
}

/**
 * Processes events asynchronously for a specific group and partition
 */
export class EventHandlingProcessor {
  private config: EventHandlingProcessorConfig;
  private handlers: Map<string, EventHandlerDefinition<any>[]>;
  private running = false;
  private stopRequested = false;

  constructor(config: EventHandlingProcessorConfig) {
    this.config = {
      recursive: true,
      retryDelay: 1000,
      maxRetries: 3,
      ...config
    };

    // Index handlers by event class name
    this.handlers = new Map();
    for (const def of config.eventHandlers) {
      if (def.group === config.group) {
        const handlers = this.handlers.get(def.eventClass.name) || [];
        handlers.push(def);
        this.handlers.set(def.eventClass.name, handlers);
      }
    }
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopRequested = false;

    try {
      await this.run();
    } finally {
      this.running = false;
    }
  }

  /**
   * Stop processing events
   */
  stop(): void {
    this.stopRequested = true;
  }

  /**
   * Main processing loop
   */
  private async run(): Promise<void> {
    while (!this.stopRequested) {
      try {
        // Get current progress
        const progress = await this.config.progressTracker.current(
          this.config.group,
          this.config.partition
        );

        // Observe events from current position
        const options = progress.eventId
          ? { lowerBound: progress.eventId, includeLowerBound: false }
          : undefined;

        for await (const rawEvent of this.config.eventStore.observeEvents(
          this.config.subject,
          options,
          this.config.recursive
        )) {
          if (this.stopRequested) {
            break;
          }

          // Check if this event belongs to our partition (at raw event level)
          const sequenceId = this.resolveSequenceId(rawEvent, null, rawEvent);
          const partition = this.config.partitionKeyResolver.resolve(sequenceId);

          if (partition !== this.config.partition) {
            // Skip events not in our partition, but still update progress
            await this.config.progressTracker.proceed(
              this.config.group,
              this.config.partition,
              async () => ({ eventId: rawEvent.id })
            );
            continue;
          }

          // Process event with retries
          await this.processEventWithRetry(rawEvent);
        }
      } catch (error) {
        console.error(`Error in EventHandlingProcessor [${this.config.group}:${this.config.partition}]:`, error);

        // Wait before retrying
        await this.sleep(this.config.retryDelay!);
      }
    }
  }

  /**
   * Process a single event with retry logic
   */
  private async processEventWithRetry(rawEvent: RawEvent): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxRetries!) {
      try {
        await this.processEvent(rawEvent);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts < this.config.maxRetries!) {
          // Exponential backoff
          const delay = this.config.retryDelay! * Math.pow(2, attempts - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    console.error(
      `Failed to process event ${rawEvent.id} after ${attempts} attempts:`,
      lastError
    );

    // Still update progress to avoid being stuck on this event forever
    await this.config.progressTracker.proceed(
      this.config.group,
      this.config.partition,
      async () => ({ eventId: rawEvent.id })
    );
  }

  /**
   * Process a single event
   */
  private async processEvent(rawEvent: RawEvent): Promise<void> {
    // Apply upcasting
    const upcastedEvents = this.config.upcasters
      ? this.config.upcasters.upcast(rawEvent)
      : [rawEvent];

    for (const upcastedEvent of upcastedEvents) {
      try {
        // Deserialize event
        const eventClass = this.config.eventTypeResolver.getClass(upcastedEvent.type);
        const eventData = this.config.eventDataMarshaller.deserialize(
          upcastedEvent.data,
          eventClass
        );

        // Check partition again at converted event level
        const sequenceId = this.resolveSequenceId(
          upcastedEvent,
          eventData.payload,
          upcastedEvent
        );
        const partition = this.config.partitionKeyResolver.resolve(sequenceId);

        if (partition !== this.config.partition) {
          continue;
        }

        // Find and invoke matching handlers
        const handlers = this.handlers.get(eventClass.name) || [];

        for (const handlerDef of handlers) {
          const handler = handlerDef.handler;
          const handlerLength = handler.length;

          if (handlerLength === 1) {
            // ForObject
            await (handler as any)(eventData.payload);
          } else if (handlerLength === 2) {
            // ForObjectAndMetadata
            await (handler as any)(eventData.payload, eventData.metadata);
          } else {
            // ForObjectAndMetadataAndRawEvent
            await (handler as any)(eventData.payload, eventData.metadata, upcastedEvent);
          }
        }
      } catch (error) {
        // Skip events we can't process but log the error
        console.warn(`Skipping event ${upcastedEvent.id}:`, error);
      }
    }

    // Update progress
    await this.config.progressTracker.proceed(
      this.config.group,
      this.config.partition,
      async () => ({ eventId: rawEvent.id })
    );
  }

  /**
   * Resolve sequence ID from event
   */
  private resolveSequenceId(
    rawEvent: RawEvent,
    convertedEvent: any | null,
    metadata: RawEvent
  ): string {
    const resolver = this.config.eventSequenceResolver as any;

    // Try to determine resolver type by function arity
    if (resolver.length === 1) {
      // ForRawEvent
      return resolver(rawEvent);
    } else {
      // ForObjectAndMetadataAndRawEvent
      return resolver(convertedEvent, metadata.metadata, rawEvent);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
