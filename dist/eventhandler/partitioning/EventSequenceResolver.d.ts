import { RawEvent } from '../../types/Event';
/**
 * Extracts sequence ID from events for partition resolution
 */
export type EventSequenceResolverForRawEvent = (event: RawEvent) => string;
/**
 * Extracts sequence ID from converted events
 */
export type EventSequenceResolverForObjectAndMetadataAndRawEvent = (event: any, metadata: Record<string, any>, rawEvent: RawEvent) => string;
/**
 * Union type for sequence resolvers
 */
export type EventSequenceResolver = EventSequenceResolverForRawEvent | EventSequenceResolverForObjectAndMetadataAndRawEvent;
/**
 * Uses event subject as sequence ID (events for same subject processed sequentially)
 */
export declare class PerSubjectEventSequenceResolver {
    private rawEventBased;
    constructor(rawEventBased?: boolean);
    resolve(eventOrRawEvent: any, metadata?: Record<string, any>, rawEvent?: RawEvent): string;
    call(thisArg: any, ...args: any[]): string;
}
/**
 * Uses a specific level of the subject hierarchy for sequence ID
 * Example: subject "/order/123/item/456" with level 2 -> "/order/123"
 */
export declare class PerConfigurableLevelSubjectEventSequenceResolver {
    private level;
    private rawEventBased;
    constructor(level: number, rawEventBased?: boolean);
    resolve(eventOrRawEvent: any, metadata?: Record<string, any>, rawEvent?: RawEvent): string;
    call(thisArg: any, ...args: any[]): string;
}
