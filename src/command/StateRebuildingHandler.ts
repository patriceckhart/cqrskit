import { RawEvent } from '../types/Event';

/**
 * State rebuilding handler that applies events to reconstruct aggregate state
 */
export type StateRebuildingHandlerFromObject<TInstance, TEvent> = (
  instance: TInstance | null,
  event: TEvent
) => TInstance;

/**
 * State rebuilding handler with access to raw event
 */
export type StateRebuildingHandlerFromObjectAndRawEvent<TInstance, TEvent> = (
  instance: TInstance | null,
  event: TEvent,
  rawEvent: RawEvent | null
) => TInstance;

/**
 * State rebuilding handler with metadata
 */
export type StateRebuildingHandlerFromObjectAndMetadata<TInstance, TEvent> = (
  instance: TInstance | null,
  event: TEvent,
  metadata: Record<string, any>
) => TInstance;

/**
 * State rebuilding handler with metadata and subject
 */
export type StateRebuildingHandlerFromObjectAndMetadataAndSubject<TInstance, TEvent> = (
  instance: TInstance | null,
  event: TEvent,
  metadata: Record<string, any>,
  subject: string
) => TInstance;

/**
 * State rebuilding handler with metadata, subject, and raw event
 */
export type StateRebuildingHandlerFromObjectAndMetadataAndSubjectAndRawEvent<TInstance, TEvent> = (
  instance: TInstance | null,
  event: TEvent,
  metadata: Record<string, any>,
  subject: string,
  rawEvent: RawEvent | null
) => TInstance;

/**
 * Union type for all state rebuilding handler variants
 */
export type StateRebuildingHandler<TInstance, TEvent> =
  | StateRebuildingHandlerFromObject<TInstance, TEvent>
  | StateRebuildingHandlerFromObjectAndRawEvent<TInstance, TEvent>
  | StateRebuildingHandlerFromObjectAndMetadata<TInstance, TEvent>
  | StateRebuildingHandlerFromObjectAndMetadataAndSubject<TInstance, TEvent>
  | StateRebuildingHandlerFromObjectAndMetadataAndSubjectAndRawEvent<TInstance, TEvent>;
