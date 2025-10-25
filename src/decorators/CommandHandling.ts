import { SourcingMode } from '../command/SourcingMode';
import { CommandHandlerDefinition } from '../command/CommandHandlerDefinition';

/**
 * Metadata key for storing command handler definitions
 */
const COMMAND_HANDLERS_KEY = Symbol('cqrskit:commandHandlers');

/**
 * Options for @CommandHandling decorator
 */
export interface CommandHandlingOptions {
  sourcingMode?: SourcingMode;
}

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
export function CommandHandling(options: CommandHandlingOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const sourcingMode = options.sourcingMode || SourcingMode.RECURSIVE;
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
export function extractCommandHandlers(
  instance: any,
  instanceClass: new (...args: any[]) => any,
  commandClass: new (...args: any[]) => any
): CommandHandlerDefinition<any, any, any>[] {
  const metadata = instance.constructor[COMMAND_HANDLERS_KEY];
  if (!metadata) {
    return [];
  }

  return metadata.map((meta: any) => ({
    instanceClass,
    commandClass,
    handler: meta.method.bind(instance),
    sourcingMode: meta.sourcingMode
  }));
}

/**
 * Get all command handler metadata from a class
 */
export function getCommandHandlerMetadata(target: any): any[] {
  return target[COMMAND_HANDLERS_KEY] || [];
}
