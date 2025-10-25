"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandling = CommandHandling;
exports.extractCommandHandlers = extractCommandHandlers;
exports.getCommandHandlerMetadata = getCommandHandlerMetadata;
const SourcingMode_1 = require("../command/SourcingMode");
/**
 * Metadata key for storing command handler definitions
 */
const COMMAND_HANDLERS_KEY = Symbol('cqrskit:commandHandlers');
/**
 * Decorator for marking command handler methods
 *
 * @example
 * ```typescript
 * class TaskHandlers {
 *   @CommandHandling({ sourcingMode: SourcingMode.LOCAL })
 *   async handleCreate(
 *     command: CreateTaskCommand,
 *     publisher: CommandEventPublisher<Task>
 *   ): Promise<string> {
 *     publisher.publish(new TaskCreatedEvent(...));
 *     return command.taskId;
 *   }
 * }
 * ```
 */
function CommandHandling(options = {}) {
    return function (target, propertyKey, descriptor) {
        const sourcingMode = options.sourcingMode || SourcingMode_1.SourcingMode.RECURSIVE;
        const originalMethod = descriptor.value;
        // Store metadata about this handler
        if (!target.constructor[COMMAND_HANDLERS_KEY]) {
            target.constructor[COMMAND_HANDLERS_KEY] = [];
        }
        target.constructor[COMMAND_HANDLERS_KEY].push({
            method: originalMethod,
            sourcingMode,
            propertyKey
        });
        return descriptor;
    };
}
/**
 * Extract command handler definitions from a class instance
 */
function extractCommandHandlers(instance, instanceClass, commandClass) {
    const metadata = instance.constructor[COMMAND_HANDLERS_KEY];
    if (!metadata) {
        return [];
    }
    return metadata.map((meta) => ({
        instanceClass,
        commandClass,
        handler: meta.method.bind(instance),
        sourcingMode: meta.sourcingMode
    }));
}
/**
 * Get all command handler metadata from a class
 */
function getCommandHandlerMetadata(target) {
    return target[COMMAND_HANDLERS_KEY] || [];
}
