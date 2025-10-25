import { Precondition } from '../types/Event';

/**
 * Publisher for capturing events during command execution
 */
export interface CommandEventPublisher<TInstance> {
  /**
   * Publish an event with optional metadata and preconditions
   * @param event The event to publish
   * @param metadata Optional metadata to attach to the event
   * @param preconditions Optional preconditions for conditional publishing
   */
  publish<TEvent>(
    event: TEvent,
    metadata?: Record<string, any>,
    preconditions?: Precondition[]
  ): void;
}
