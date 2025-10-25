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
export declare class GenesisDBAdapter implements EventStoreAdapter {
    private client;
    private source;
    constructor(config: GenesisDBConfig);
    streamEvents(subject: string, options?: StreamOptions, recursive?: boolean): AsyncIterable<RawEvent>;
    observeEvents(subject: string, options?: StreamOptions, recursive?: boolean): AsyncIterable<RawEvent>;
    publishEvents(events: EventToPublish[], preconditions?: Precondition[]): Promise<RawEvent[]>;
    ping(): Promise<void>;
    private mapToRawEvent;
}
