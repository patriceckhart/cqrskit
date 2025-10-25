import { SourcingMode } from '../SourcingMode';
/**
 * Cache key for state rebuilding
 */
export interface CacheKey<TInstance> {
    subject: string;
    instanceClass: new (...args: any[]) => TInstance;
    sourcingMode: SourcingMode;
}
/**
 * Cached state value
 */
export interface CacheValue<TInstance> {
    /** Last event ID included in this state */
    eventId: string;
    /** The reconstructed instance */
    instance: TInstance;
    /** Map of sourced subject IDs (for recursive sourcing) */
    sourcedSubjectIds: Map<string, string>;
}
/**
 * Cache for reconstructed aggregate state
 */
export interface StateRebuildingCache {
    /**
     * Fetch cached value and merge with new state
     */
    fetchAndMerge<TInstance>(key: CacheKey<TInstance>, merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>): CacheValue<TInstance> | Promise<CacheValue<TInstance>>;
}
/**
 * No-op cache implementation
 */
export declare class NoStateRebuildingCache implements StateRebuildingCache {
    fetchAndMerge<TInstance>(key: CacheKey<TInstance>, merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>): CacheValue<TInstance> | Promise<CacheValue<TInstance>>;
}
/**
 * In-memory cache with LRU eviction
 */
export declare class InMemoryStateCache implements StateRebuildingCache {
    private cache;
    private capacity;
    constructor(capacity?: number);
    fetchAndMerge<TInstance>(key: CacheKey<TInstance>, merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>): Promise<CacheValue<TInstance>>;
    private buildKey;
}
