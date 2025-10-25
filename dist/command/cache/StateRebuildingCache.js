"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStateCache = exports.NoStateRebuildingCache = void 0;
/**
 * No-op cache implementation
 */
class NoStateRebuildingCache {
    fetchAndMerge(key, merger) {
        return merger(null);
    }
}
exports.NoStateRebuildingCache = NoStateRebuildingCache;
/**
 * In-memory cache with LRU eviction
 */
class InMemoryStateCache {
    cache = new Map();
    capacity;
    constructor(capacity = 1000) {
        this.capacity = capacity;
    }
    async fetchAndMerge(key, merger) {
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
    buildKey(key) {
        return `${key.subject}:${key.instanceClass.name}:${key.sourcingMode}`;
    }
}
exports.InMemoryStateCache = InMemoryStateCache;
