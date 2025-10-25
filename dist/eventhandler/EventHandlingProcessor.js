"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandlingProcessor = void 0;
/**
 * Processes events asynchronously for a specific group and partition
 */
class EventHandlingProcessor {
    config;
    handlers;
    running = false;
    stopRequested = false;
    constructor(config) {
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
    async start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.stopRequested = false;
        try {
            await this.run();
        }
        finally {
            this.running = false;
        }
    }
    /**
     * Stop processing events
     */
    stop() {
        this.stopRequested = true;
    }
    /**
     * Main processing loop
     */
    async run() {
        while (!this.stopRequested) {
            try {
                // Get current progress
                const progress = await this.config.progressTracker.current(this.config.group, this.config.partition);
                // Observe events from current position
                const options = progress.eventId
                    ? { lowerBound: progress.eventId, includeLowerBound: false }
                    : undefined;
                for await (const rawEvent of this.config.eventStore.observeEvents(this.config.subject, options, this.config.recursive)) {
                    if (this.stopRequested) {
                        break;
                    }
                    // Check if this event belongs to our partition (at raw event level)
                    const sequenceId = this.resolveSequenceId(rawEvent, null, rawEvent);
                    const partition = this.config.partitionKeyResolver.resolve(sequenceId);
                    if (partition !== this.config.partition) {
                        // Skip events not in our partition, but still update progress
                        await this.config.progressTracker.proceed(this.config.group, this.config.partition, async () => ({ eventId: rawEvent.id }));
                        continue;
                    }
                    // Process event with retries
                    await this.processEventWithRetry(rawEvent);
                }
            }
            catch (error) {
                console.error(`Error in EventHandlingProcessor [${this.config.group}:${this.config.partition}]:`, error);
                // Wait before retrying
                await this.sleep(this.config.retryDelay);
            }
        }
    }
    /**
     * Process a single event with retry logic
     */
    async processEventWithRetry(rawEvent) {
        let attempts = 0;
        let lastError = null;
        while (attempts < this.config.maxRetries) {
            try {
                await this.processEvent(rawEvent);
                return; // Success
            }
            catch (error) {
                lastError = error;
                attempts++;
                if (attempts < this.config.maxRetries) {
                    // Exponential backoff
                    const delay = this.config.retryDelay * Math.pow(2, attempts - 1);
                    await this.sleep(delay);
                }
            }
        }
        // All retries failed
        console.error(`Failed to process event ${rawEvent.id} after ${attempts} attempts:`, lastError);
        // Still update progress to avoid being stuck on this event forever
        await this.config.progressTracker.proceed(this.config.group, this.config.partition, async () => ({ eventId: rawEvent.id }));
    }
    /**
     * Process a single event
     */
    async processEvent(rawEvent) {
        // Apply upcasting
        const upcastedEvents = this.config.upcasters
            ? this.config.upcasters.upcast(rawEvent)
            : [rawEvent];
        for (const upcastedEvent of upcastedEvents) {
            try {
                // Deserialize event
                const eventClass = this.config.eventTypeResolver.getClass(upcastedEvent.type);
                const eventData = this.config.eventDataMarshaller.deserialize(upcastedEvent.data, eventClass);
                // Check partition again at converted event level
                const sequenceId = this.resolveSequenceId(upcastedEvent, eventData.payload, upcastedEvent);
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
                        await handler(eventData.payload);
                    }
                    else if (handlerLength === 2) {
                        // ForObjectAndMetadata
                        await handler(eventData.payload, eventData.metadata);
                    }
                    else {
                        // ForObjectAndMetadataAndRawEvent
                        await handler(eventData.payload, eventData.metadata, upcastedEvent);
                    }
                }
            }
            catch (error) {
                // Skip events we can't process but log the error
                console.warn(`Skipping event ${upcastedEvent.id}:`, error);
            }
        }
        // Update progress
        await this.config.progressTracker.proceed(this.config.group, this.config.partition, async () => ({ eventId: rawEvent.id }));
    }
    /**
     * Resolve sequence ID from event
     */
    resolveSequenceId(rawEvent, convertedEvent, metadata) {
        const resolver = this.config.eventSequenceResolver;
        // Try to determine resolver type by function arity
        if (resolver.length === 1) {
            // ForRawEvent
            return resolver(rawEvent);
        }
        else {
            // ForObjectAndMetadataAndRawEvent
            return resolver(convertedEvent, metadata.metadata, rawEvent);
        }
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Check if processor is running
     */
    isRunning() {
        return this.running;
    }
}
exports.EventHandlingProcessor = EventHandlingProcessor;
