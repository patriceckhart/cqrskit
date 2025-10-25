/**
 * Represents the current processing position
 */
export interface Progress {
    /** Last processed event ID */
    eventId: string | null;
}
/**
 * Tracks event processing progress for each group and partition
 */
export interface ProgressTracker {
    /**
     * Get current progress for a group and partition
     */
    current(group: string, partition: number): Promise<Progress>;
    /**
     * Proceed to next position atomically
     */
    proceed(group: string, partition: number, execution: () => Promise<Progress>): Promise<void>;
}
/**
 * In-memory progress tracker (for single-instance deployments)
 */
export declare class InMemoryProgressTracker implements ProgressTracker {
    private progress;
    private key;
    current(group: string, partition: number): Promise<Progress>;
    proceed(group: string, partition: number, execution: () => Promise<Progress>): Promise<void>;
}
