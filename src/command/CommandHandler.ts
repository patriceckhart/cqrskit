import { Command } from './Command';
import { CommandEventPublisher } from './CommandEventPublisher';

/**
 * Command handler that processes commands without prior state (for NEW subjects)
 */
export type CommandHandlerForCommand<TInstance, TCommand extends Command, TResult> = (
  command: TCommand,
  publisher: CommandEventPublisher<TInstance>
) => TResult | Promise<TResult>;

/**
 * Command handler that processes commands with reconstructed state
 */
export type CommandHandlerForInstanceAndCommand<TInstance, TCommand extends Command, TResult> = (
  instance: TInstance,
  command: TCommand,
  publisher: CommandEventPublisher<TInstance>
) => TResult | Promise<TResult>;

/**
 * Command handler that processes commands with state and metadata
 */
export type CommandHandlerForInstanceAndCommandAndMetadata<TInstance, TCommand extends Command, TResult> = (
  instance: TInstance,
  command: TCommand,
  metadata: Record<string, any>,
  publisher: CommandEventPublisher<TInstance>
) => TResult | Promise<TResult>;

/**
 * Union type for all command handler variants
 */
export type CommandHandler<TInstance, TCommand extends Command, TResult> =
  | CommandHandlerForCommand<TInstance, TCommand, TResult>
  | CommandHandlerForInstanceAndCommand<TInstance, TCommand, TResult>
  | CommandHandlerForInstanceAndCommandAndMetadata<TInstance, TCommand, TResult>;
