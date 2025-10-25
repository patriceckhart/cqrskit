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
export class EventUpcasters {
  private upcasters: EventUpcaster[] = [];

  add(upcaster: EventUpcaster): this {
    this.upcasters.push(upcaster);
    return this;
  }

  /**
   * Apply all upcasters to an event, potentially multiple times
   */
  upcast(event: RawEvent): RawEvent[] {
    let events: RawEvent[] = [event];

    for (const upcaster of this.upcasters) {
      const newEvents: RawEvent[] = [];

      for (const evt of events) {
        if (upcaster.canUpcast(evt)) {
          const results = upcaster.upcast(evt);
          for (const result of results) {
            newEvents.push({
              ...evt,
              type: result.type,
              data: result.data
            });
          }
        } else {
          newEvents.push(evt);
        }
      }

      events = newEvents;
    }

    return events;
  }
}
