/**
 * Maps sequence IDs to partition keys for parallel processing
 */
export interface PartitionKeyResolver {
  /**
   * Resolve partition key from sequence ID
   */
  resolve(sequenceId: string): number;
}

/**
 * Default hash-based partition resolver
 */
export class DefaultPartitionKeyResolver implements PartitionKeyResolver {
  private partitionCount: number;

  constructor(partitionCount: number = 10) {
    this.partitionCount = partitionCount;
  }

  resolve(sequenceId: string): number {
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
