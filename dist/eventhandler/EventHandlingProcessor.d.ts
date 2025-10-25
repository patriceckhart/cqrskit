import { EventHandlerDefinition } from './EventHandlerDefinition';
import { EventStoreAdapter } from '../persistence/EventStoreAdapter';
import { EventTypeResolver } from '../types/EventTypeResolver';
import { EventDataMarshaller } from '../serialization/EventDataMarshaller';
import { EventUpcasters } from '../upcaster/EventUpcaster';
import { ProgressTracker } from './progress/ProgressTracker';
import { PartitionKeyResolver } from './partitioning/PartitionKeyResolver';
import { EventSequenceResolver } from './partitioning/EventSequenceResolver';
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
export declare class EventHandlingProcessor {
    private config;
    private handlers;
    private running;
    private stopRequested;
    constructor(config: EventHandlingProcessorConfig);
    /**
     * Start processing events
     */
    start(): Promise<void>;
    /**
     * Stop processing events
     */
    stop(): void;
    /**
     * Main processing loop
     */
    private run;
    /**
     * Process a single event with retry logic
     */
    private processEventWithRetry;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Resolve sequence ID from event
     */
    private resolveSequenceId;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Check if processor is running
     */
    isRunning(): boolean;
}
