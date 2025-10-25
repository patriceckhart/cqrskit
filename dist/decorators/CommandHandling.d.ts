import { SourcingMode } from '../command/SourcingMode';
import { CommandHandlerDefinition } from '../command/CommandHandlerDefinition';
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
export declare function CommandHandling(options?: CommandHandlingOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Extract command handler definitions from a class instance
 */
export declare function extractCommandHandlers(instance: any, instanceClass: new (...args: any[]) => any, commandClass: new (...args: any[]) => any): CommandHandlerDefinition<any, any, any>[];
/**
 * Get all command handler metadata from a class
 */
export declare function getCommandHandlerMetadata(target: any): any[];
