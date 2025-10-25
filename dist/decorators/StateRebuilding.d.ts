import { StateRebuildingHandlerDefinition } from '../command/StateRebuildingHandlerDefinition';
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
export declare function StateRebuilding(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Extract state rebuilding handler definitions from a class instance
 */
export declare function extractStateRebuildingHandlers(instance: any, instanceClass: new (...args: any[]) => any, eventClass: new (...args: any[]) => any): StateRebuildingHandlerDefinition<any, any>[];
/**
 * Get all state rebuilding handler metadata from a class
 */
export declare function getStateRebuildingHandlerMetadata(target: any): any[];
