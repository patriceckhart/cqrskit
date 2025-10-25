import { EventHandlerDefinition } from '../eventhandler/EventHandlerDefinition';

/**
 * Metadata key for storing event handler definitions
 */
const EVENT_HANDLERS_KEY = Symbol('cqrskit:eventHandlers');

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
export function EventHandling(options: EventHandlingOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
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
export function extractEventHandlers(
  instance: any,
  eventClass: new (...args: any[]) => any
): EventHandlerDefinition<any>[] {
  const metadata = instance.constructor[EVENT_HANDLERS_KEY];
  if (!metadata) {
    return [];
  }

  return metadata.map((meta: any) => ({
    group: meta.group,
    eventClass,
    handler: meta.method.bind(instance)
  }));
}

/**
 * Get all event handler metadata from a class
 */
export function getEventHandlerMetadata(target: any): any[] {
  return target[EVENT_HANDLERS_KEY] || [];
}
