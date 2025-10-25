"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonEventDataMarshaller = void 0;
/**
 * Default JSON-based marshaller
 */
class JsonEventDataMarshaller {
    serialize(data) {
        return {
            ...data.metadata,
            payload: data.payload
        };
    }
    deserialize(json, clazz) {
        const { payload, ...metadata } = json;
        // Simple deserialization - create instance and copy properties
        // For more complex scenarios, users can implement custom marshallers
        const instance = Object.create(clazz.prototype);
        Object.assign(instance, payload);
        return {
            metadata,
            payload: instance
        };
    }
}
exports.JsonEventDataMarshaller = JsonEventDataMarshaller;
