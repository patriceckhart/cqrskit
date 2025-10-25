"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryProgressTracker = void 0;
/**
 * In-memory progress tracker (for single-instance deployments)
 */
class InMemoryProgressTracker {
    progress = new Map();
    key(group, partition) {
        return `${group}:${partition}`;
    }
    async current(group, partition) {
        const key = this.key(group, partition);
        return this.progress.get(key) || { eventId: null };
    }
    async proceed(group, partition, execution) {
        const key = this.key(group, partition);
        const newProgress = await execution();
        this.progress.set(key, newProgress);
    }
}
exports.InMemoryProgressTracker = InMemoryProgressTracker;
