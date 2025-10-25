import { RawEvent } from '../types/Event';
/**
 * Event handler that processes events asynchronously
 */
export type EventHandlerForObject<TEvent> = (event: TEvent) => void | Promise<void>;
/**
 * Event handler with metadata
 */
export type EventHandlerForObjectAndMetadata<TEvent> = (event: TEvent, metadata: Record<string, any>) => void | Promise<void>;
/**
 * Event handler with metadata and raw event
 */
export type EventHandlerForObjectAndMetadataAndRawEvent<TEvent> = (event: TEvent, metadata: Record<string, any>, rawEvent: RawEvent) => void | Promise<void>;
/**
 * Union type for all event handler variants
 */
export type EventHandler<TEvent> = EventHandlerForObject<TEvent> | EventHandlerForObjectAndMetadata<TEvent> | EventHandlerForObjectAndMetadataAndRawEvent<TEvent>;
