import { StateRebuildingHandlerDefinition } from '../command/StateRebuildingHandlerDefinition';

/**
 * Metadata key for storing state rebuilding handler definitions
 */
const STATE_REBUILDING_HANDLERS_KEY = Symbol('cqrskit:stateRebuildingHandlers');

/**
 * Decorator for marking state rebuilding methods
 *
 * @example
 * ```typescript
 * class TaskHandlers {
 *   @StateRebuilding()
 *   onTaskCreated(task: Task | null, event: TaskCreatedEvent): Task {
 *     return new Task(event.taskId, event.title, event.description, null, TaskStatus.TODO);
 *   }
 *
 *   @StateRebuilding()
 *   onTaskAssigned(task: Task, event: TaskAssignedEvent): Task {
 *     return new Task(task.id, task.title, task.description, event.assignee, task.status);
 *   }
 * }
 * ```
 */
export function StateRebuilding() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // Store metadata about this handler
    if (!target.constructor[STATE_REBUILDING_HANDLERS_KEY]) {
      target.constructor[STATE_REBUILDING_HANDLERS_KEY] = [];
    }

    target.constructor[STATE_REBUILDING_HANDLERS_KEY].push({
      method: originalMethod,
      propertyKey
    });

    return descriptor;
  };
}

/**
 * Extract state rebuilding handler definitions from a class instance
 */
export function extractStateRebuildingHandlers(
  instance: any,
  instanceClass: new (...args: any[]) => any,
  eventClass: new (...args: any[]) => any
): StateRebuildingHandlerDefinition<any, any>[] {
  const metadata = instance.constructor[STATE_REBUILDING_HANDLERS_KEY];
  if (!metadata) {
    return [];
  }

  return metadata.map((meta: any) => ({
    instanceClass,
    eventClass,
    handler: meta.method.bind(instance)
  }));
}

/**
 * Get all state rebuilding handler metadata from a class
 */
export function getStateRebuildingHandlerMetadata(target: any): any[] {
  return target[STATE_REBUILDING_HANDLERS_KEY] || [];
}
