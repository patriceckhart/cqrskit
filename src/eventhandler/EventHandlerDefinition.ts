import { EventHandler } from './EventHandler';

/**
 * Configuration object linking event type to handler within a processing group
 */
export interface EventHandlerDefinition<TEvent> {
  /** Processing group name for partitioning and progress tracking */
  group: string;
  /** The event type this handler processes */
  eventClass: new (...args: any[]) => TEvent;
  /** The handler function */
  handler: EventHandler<TEvent>;
}
