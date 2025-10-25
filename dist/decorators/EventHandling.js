"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandling = EventHandling;
exports.extractEventHandlers = extractEventHandlers;
exports.getEventHandlerMetadata = getEventHandlerMetadata;
/**
 * Metadata key for storing event handler definitions
 */
const EVENT_HANDLERS_KEY = Symbol('cqrskit:eventHandlers');
/**
 * Decorator for marking event handler methods
 *
 * @example
 * ```typescript
 * class TaskListProjector {
 *   @EventHandling({ group: 'task-list' })
 *   async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
 *     // Update read model
 *     await this.database.tasks.insert({
 *       id: event.taskId,
 *       title: event.title,
 *       status: 'TODO'
 *     });
 *   }
 *
 *   @EventHandling({ group: 'task-list' })
 *   async onTaskCompleted(
 *     event: TaskCompletedEvent,
 *     metadata: Record<string, any>
 *   ): Promise<void> {
 *     await this.database.tasks.update(
 *       { id: event.taskId },
 *       { status: 'COMPLETED', completedAt: event.completedAt }
 *     );
 *   }
 * }
 * ```
 */
function EventHandling(options) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        // Store metadata about this handler
        if (!target.constructor[EVENT_HANDLERS_KEY]) {
            target.constructor[EVENT_HANDLERS_KEY] = [];
        }
        target.constructor[EVENT_HANDLERS_KEY].push({
            method: originalMethod,
            group: options.group,
            propertyKey
        });
        return descriptor;
    };
}
/**
 * Extract event handler definitions from a class instance
 */
function extractEventHandlers(instance, eventClass) {
    const metadata = instance.constructor[EVENT_HANDLERS_KEY];
    if (!metadata) {
        return [];
    }
    return metadata.map((meta) => ({
        group: meta.group,
        eventClass,
        handler: meta.method.bind(instance)
    }));
}
/**
 * Get all event handler metadata from a class
 */
function getEventHandlerMetadata(target) {
    return target[EVENT_HANDLERS_KEY] || [];
}
