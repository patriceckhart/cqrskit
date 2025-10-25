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
export class InMemoryProgressTracker implements ProgressTracker {
  private progress = new Map<string, Progress>();

  private key(group: string, partition: number): string {
    return `${group}:${partition}`;
  }

  async current(group: string, partition: number): Promise<Progress> {
    const key = this.key(group, partition);
    return this.progress.get(key) || { eventId: null };
  }

  async proceed(group: string, partition: number, execution: () => Promise<Progress>): Promise<void> {
    const key = this.key(group, partition);
    const newProgress = await execution();
    this.progress.set(key, newProgress);
  }
}
