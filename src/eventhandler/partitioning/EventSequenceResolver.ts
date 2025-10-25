import { RawEvent } from '../../types/Event';

/**
 * Extracts sequence ID from events for partition resolution
 */
export type EventSequenceResolverForRawEvent = (event: RawEvent) => string;

/**
 * Extracts sequence ID from converted events
 */
export type EventSequenceResolverForObjectAndMetadataAndRawEvent = (
  event: any,
  metadata: Record<string, any>,
  rawEvent: RawEvent
) => string;

/**
 * Union type for sequence resolvers
 */
export type EventSequenceResolver =
  | EventSequenceResolverForRawEvent
  | EventSequenceResolverForObjectAndMetadataAndRawEvent;

/**
 * Uses event subject as sequence ID (events for same subject processed sequentially)
 */
export class PerSubjectEventSequenceResolver {
  constructor(private rawEventBased: boolean = true) {}

  resolve(eventOrRawEvent: any, metadata?: Record<string, any>, rawEvent?: RawEvent): string {
    if (this.rawEventBased) {
      return (eventOrRawEvent as RawEvent).subject;
    } else {
      return rawEvent!.subject;
    }
  }

  // Make it callable as both types
  call(thisArg: any, ...args: any[]): string {
    return this.resolve(args[0], args[1], args[2]);
  }
}

/**
 * Uses a specific level of the subject hierarchy for sequence ID
 * Example: subject "/order/123/item/456" with level 2 -> "/order/123"
 */
export class PerConfigurableLevelSubjectEventSequenceResolver {
  constructor(
    private level: number,
    private rawEventBased: boolean = true
  ) {}

  resolve(eventOrRawEvent: any, metadata?: Record<string, any>, rawEvent?: RawEvent): string {
    const subject = this.rawEventBased
      ? (eventOrRawEvent as RawEvent).subject
      : rawEvent!.subject;

    const parts = subject.split('/').filter(p => p.length > 0);
    return '/' + parts.slice(0, this.level).join('/');
  }

  call(thisArg: any, ...args: any[]): string {
    return this.resolve(args[0], args[1], args[2]);
  }
}
