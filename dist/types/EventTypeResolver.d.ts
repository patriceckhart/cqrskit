/**
 * Maps between TypeScript classes and event store type identifiers
 */
export interface EventTypeResolver {
    /**
     * Get event type string from class
     * @param clazz The class constructor
     */
    getEventType(clazz: new (...args: any[]) => any): string;
    /**
     * Get class constructor from event type string
     * @param eventType The event type identifier
     */
    getClass(eventType: string): new (...args: any[]) => any;
}
/**
 * Simple resolver using class names as event types
 */
export declare class ClassNameEventTypeResolver implements EventTypeResolver {
    getEventType(clazz: new (...args: any[]) => any): string;
    getClass(eventType: string): new (...args: any[]) => any;
}
/**
 * Resolver with explicit type-to-class mappings
 */
export declare class ConfiguredEventTypeResolver implements EventTypeResolver {
    private typeToClass;
    private classToType;
    /**
     * Register an event class with its type identifier
     * @param eventType The event type string
     * @param clazz The class constructor
     */
    register(eventType: string, clazz: new (...args: any[]) => any): this;
    getEventType(clazz: new (...args: any[]) => any): string;
    getClass(eventType: string): new (...args: any[]) => any;
}
