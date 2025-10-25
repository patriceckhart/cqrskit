import { StateRebuildingHandler } from './StateRebuildingHandler';

/**
 * Configuration object for state rebuilding handlers
 */
export interface StateRebuildingHandlerDefinition<TInstance, TEvent> {
  /** The type of instance this handler builds */
  instanceClass: new (...args: any[]) => TInstance;
  /** The event type this handler processes */
  eventClass: new (...args: any[]) => TEvent;
  /** The handler function */
  handler: StateRebuildingHandler<TInstance, TEvent>;
}
