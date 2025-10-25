"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateRebuilding = StateRebuilding;
exports.extractStateRebuildingHandlers = extractStateRebuildingHandlers;
exports.getStateRebuildingHandlerMetadata = getStateRebuildingHandlerMetadata;
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
function StateRebuilding() {
    return function (target, propertyKey, descriptor) {
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
function extractStateRebuildingHandlers(instance, instanceClass, eventClass) {
    const metadata = instance.constructor[STATE_REBUILDING_HANDLERS_KEY];
    if (!metadata) {
        return [];
    }
    return metadata.map((meta) => ({
        instanceClass,
        eventClass,
        handler: meta.method.bind(instance)
    }));
}
/**
 * Get all state rebuilding handler metadata from a class
 */
function getStateRebuildingHandlerMetadata(target) {
    return target[STATE_REBUILDING_HANDLERS_KEY] || [];
}
