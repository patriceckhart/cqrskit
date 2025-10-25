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
export class ClassNameEventTypeResolver implements EventTypeResolver {
  getEventType(clazz: new (...args: any[]) => any): string {
    return clazz.name;
  }

  getClass(eventType: string): new (...args: any[]) => any {
    throw new Error(
      `ClassNameEventTypeResolver cannot resolve class from type '${eventType}'. ` +
      `Use ConfiguredEventTypeResolver instead and register your event classes.`
    );
  }
}

/**
 * Resolver with explicit type-to-class mappings
 */
export class ConfiguredEventTypeResolver implements EventTypeResolver {
  private typeToClass = new Map<string, new (...args: any[]) => any>();
  private classToType = new Map<new (...args: any[]) => any, string>();

  /**
   * Register an event class with its type identifier
   * @param eventType The event type string
   * @param clazz The class constructor
   */
  register(eventType: string, clazz: new (...args: any[]) => any): this {
    this.typeToClass.set(eventType, clazz);
    this.classToType.set(clazz, eventType);
    return this;
  }

  getEventType(clazz: new (...args: any[]) => any): string {
    const type = this.classToType.get(clazz);
    if (!type) {
      throw new Error(`No event type registered for class ${clazz.name}`);
    }
    return type;
  }

  getClass(eventType: string): new (...args: any[]) => any {
    const clazz = this.typeToClass.get(eventType);
    if (!clazz) {
      throw new Error(`No class registered for event type '${eventType}'`);
    }
    return clazz;
  }
}
