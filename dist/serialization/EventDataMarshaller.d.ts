/**
 * Event data with separated metadata and payload
 */
export interface EventData<TEvent> {
    metadata: Record<string, any>;
    payload: TEvent;
}
/**
 * Handles serialization/deserialization of events
 */
export interface EventDataMarshaller {
    /**
     * Serialize event data to JSON-compatible object
     */
    serialize<TEvent>(data: EventData<TEvent>): Record<string, any>;
    /**
     * Deserialize JSON object to event data
     */
    deserialize<TEvent>(json: Record<string, any>, clazz: new (...args: any[]) => TEvent): EventData<TEvent>;
}
/**
 * Default JSON-based marshaller
 */
export declare class JsonEventDataMarshaller implements EventDataMarshaller {
    serialize<TEvent>(data: EventData<TEvent>): Record<string, any>;
    deserialize<TEvent>(json: Record<string, any>, clazz: new (...args: any[]) => TEvent): EventData<TEvent>;
}
