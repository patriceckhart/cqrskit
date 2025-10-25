import { EventHandlerDefinition } from '../eventhandler/EventHandlerDefinition';
/**
 * Options for @EventHandling decorator
 */
export interface EventHandlingOptions {
    group: string;
}
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
export declare function EventHandling(options: EventHandlingOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Extract event handler definitions from a class instance
 */
export declare function extractEventHandlers(instance: any, eventClass: new (...args: any[]) => any): EventHandlerDefinition<any>[];
/**
 * Get all event handler metadata from a class
 */
export declare function getEventHandlerMetadata(target: any): any[];
