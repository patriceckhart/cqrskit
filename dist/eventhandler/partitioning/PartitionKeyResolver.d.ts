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
export declare class DefaultPartitionKeyResolver implements PartitionKeyResolver {
    private partitionCount;
    constructor(partitionCount?: number);
    resolve(sequenceId: string): number;
}
