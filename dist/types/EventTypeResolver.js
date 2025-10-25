"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguredEventTypeResolver = exports.ClassNameEventTypeResolver = void 0;
/**
 * Simple resolver using class names as event types
 */
class ClassNameEventTypeResolver {
    getEventType(clazz) {
        return clazz.name;
    }
    getClass(eventType) {
        throw new Error(`ClassNameEventTypeResolver cannot resolve class from type '${eventType}'. ` +
            `Use ConfiguredEventTypeResolver instead and register your event classes.`);
    }
}
exports.ClassNameEventTypeResolver = ClassNameEventTypeResolver;
/**
 * Resolver with explicit type-to-class mappings
 */
class ConfiguredEventTypeResolver {
    typeToClass = new Map();
    classToType = new Map();
    /**
     * Register an event class with its type identifier
     * @param eventType The event type string
     * @param clazz The class constructor
     */
    register(eventType, clazz) {
        this.typeToClass.set(eventType, clazz);
        this.classToType.set(clazz, eventType);
        return this;
    }
    getEventType(clazz) {
        const type = this.classToType.get(clazz);
        if (!type) {
            throw new Error(`No event type registered for class ${clazz.name}`);
        }
        return type;
    }
    getClass(eventType) {
        const clazz = this.typeToClass.get(eventType);
        if (!clazz) {
            throw new Error(`No class registered for event type '${eventType}'`);
        }
        return clazz;
    }
}
exports.ConfiguredEventTypeResolver = ConfiguredEventTypeResolver;
