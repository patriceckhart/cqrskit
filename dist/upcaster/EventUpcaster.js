"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventUpcasters = void 0;
/**
 * Chains multiple upcasters together
 */
class EventUpcasters {
    upcasters = [];
    add(upcaster) {
        this.upcasters.push(upcaster);
        return this;
    }
    /**
     * Apply all upcasters to an event, potentially multiple times
     */
    upcast(event) {
        let events = [event];
        for (const upcaster of this.upcasters) {
            const newEvents = [];
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
                }
                else {
                    newEvents.push(evt);
                }
            }
            events = newEvents;
        }
        return events;
    }
}
exports.EventUpcasters = EventUpcasters;
