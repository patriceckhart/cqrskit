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
  fetchAndMerge<TInstance>(
    key: CacheKey<TInstance>,
    merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>
  ): CacheValue<TInstance> | Promise<CacheValue<TInstance>>;
}

/**
 * No-op cache implementation
 */
export class NoStateRebuildingCache implements StateRebuildingCache {
  fetchAndMerge<TInstance>(
    key: CacheKey<TInstance>,
    merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>
  ): CacheValue<TInstance> | Promise<CacheValue<TInstance>> {
    return merger(null);
  }
}

/**
 * In-memory cache with LRU eviction
 */
export class InMemoryStateCache implements StateRebuildingCache {
  private cache = new Map<string, any>();
  private capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
  }

  async fetchAndMerge<TInstance>(
    key: CacheKey<TInstance>,
    merger: (cached: CacheValue<TInstance> | null) => CacheValue<TInstance> | Promise<CacheValue<TInstance>>
  ): Promise<CacheValue<TInstance>> {
    const cacheKey = this.buildKey(key);
    const cached = this.cache.get(cacheKey) || null;

    // Move to end (most recently used)
    if (cached) {
      this.cache.delete(cacheKey);
    }

    const merged = await merger(cached);
    this.cache.set(cacheKey, merged);

    // Evict oldest if over capacity
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return merged;
  }

  private buildKey<TInstance>(key: CacheKey<TInstance>): string {
    return `${key.subject}:${key.instanceClass.name}:${key.sourcingMode}`;
  }
}
