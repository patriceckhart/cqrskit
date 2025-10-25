import { RawEvent } from '../types/Event';
/**
 * Result of an upcasting operation
 */
export interface UpcasterResult {
    /** New event type */
    type: string;
    /** Transformed event data */
    data: Record<string, any>;
}
/**
 * Transforms events from old versions to new versions
 */
export interface EventUpcaster {
    /**
     * Check if this upcaster can handle the given event
     */
    canUpcast(event: RawEvent): boolean;
    /**
     * Transform the event. Can return multiple events (split), single event (transform), or empty (drop).
     */
    upcast(event: RawEvent): UpcasterResult[];
}
/**
 * Chains multiple upcasters together
 */
export declare class EventUpcasters {
    private upcasters;
    add(upcaster: EventUpcaster): this;
    /**
     * Apply all upcasters to an event, potentially multiple times
     */
    upcast(event: RawEvent): RawEvent[];
}
