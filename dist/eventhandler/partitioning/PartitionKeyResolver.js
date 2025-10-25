"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultPartitionKeyResolver = void 0;
/**
 * Default hash-based partition resolver
 */
class DefaultPartitionKeyResolver {
    partitionCount;
    constructor(partitionCount = 10) {
        this.partitionCount = partitionCount;
    }
    resolve(sequenceId) {
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < sequenceId.length; i++) {
            const char = sequenceId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % this.partitionCount;
    }
}
exports.DefaultPartitionKeyResolver = DefaultPartitionKeyResolver;
