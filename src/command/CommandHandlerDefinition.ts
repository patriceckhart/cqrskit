import { Command } from './Command';
import { CommandHandler } from './CommandHandler';
import { SourcingMode } from './SourcingMode';

/**
 * Configuration object linking command type, handler, state type, and sourcing strategy
 */
export interface CommandHandlerDefinition<TInstance, TCommand extends Command, TResult> {
  /** The type of instance this handler works with */
  instanceClass: new (...args: any[]) => TInstance;
  /** The command type this handler processes */
  commandClass: new (...args: any[]) => TCommand;
  /** The handler function */
  handler: CommandHandler<TInstance, TCommand, TResult>;
  /** Sourcing mode for event fetching */
  sourcingMode: SourcingMode;
}
