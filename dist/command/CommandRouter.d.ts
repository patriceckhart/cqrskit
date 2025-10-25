import { Command } from './Command';
import { CommandHandlerDefinition } from './CommandHandlerDefinition';
import { StateRebuildingHandlerDefinition } from './StateRebuildingHandlerDefinition';
import { EventStoreAdapter } from '../persistence/EventStoreAdapter';
import { EventTypeResolver } from '../types/EventTypeResolver';
import { EventDataMarshaller } from '../serialization/EventDataMarshaller';
import { EventUpcasters } from '../upcaster/EventUpcaster';
import { StateRebuildingCache } from './cache/StateRebuildingCache';
/**
 * Metadata propagation mode
 */
export declare enum MetadataPropagationMode {
    NONE = "NONE",
    SHALLOW = "SHALLOW",
    DEEP = "DEEP"
}
/**
 * Configuration for CommandRouter
 */
export interface CommandRouterConfig {
    eventStore: EventStoreAdapter;
    eventTypeResolver: EventTypeResolver;
    eventDataMarshaller: EventDataMarshaller;
    commandHandlers: CommandHandlerDefinition<any, any, any>[];
    stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[];
    eventSource: string;
    cache?: StateRebuildingCache;
    upcasters?: EventUpcasters;
    metadataPropagation?: {
        mode: MetadataPropagationMode;
        keys?: string[];
    };
}
/**
 * Routes commands to appropriate handlers and manages event sourcing
 */
export declare class CommandRouter {
    private eventStore;
    private eventTypeResolver;
    private eventDataMarshaller;
    private commandHandlers;
    private stateRebuildingHandlers;
    private eventSource;
    private cache;
    private upcasters?;
    private metadataPropagation;
    constructor(config: CommandRouterConfig);
    /**
     * Send a command and return the result
     */
    send<TResult>(command: Command, metadata?: Record<string, any>): Promise<TResult>;
    /**
     * Rebuild state from historical events
     */
    private rebuildState;
    /**
     * Apply state rebuilding handlers to an event
     */
    private applyStateRebuilding;
    /**
     * Validate subject condition before command execution
     */
    private validateSubjectCondition;
    /**
     * Propagate metadata based on configuration
     */
    private propagateMetadata;
}
