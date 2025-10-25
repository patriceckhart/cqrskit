"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerConfigurableLevelSubjectEventSequenceResolver = exports.PerSubjectEventSequenceResolver = void 0;
/**
 * Uses event subject as sequence ID (events for same subject processed sequentially)
 */
class PerSubjectEventSequenceResolver {
    rawEventBased;
    constructor(rawEventBased = true) {
        this.rawEventBased = rawEventBased;
    }
    resolve(eventOrRawEvent, metadata, rawEvent) {
        if (this.rawEventBased) {
            return eventOrRawEvent.subject;
        }
        else {
            return rawEvent.subject;
        }
    }
    // Make it callable as both types
    call(thisArg, ...args) {
        return this.resolve(args[0], args[1], args[2]);
    }
}
exports.PerSubjectEventSequenceResolver = PerSubjectEventSequenceResolver;
/**
 * Uses a specific level of the subject hierarchy for sequence ID
 * Example: subject "/order/123/item/456" with level 2 -> "/order/123"
 */
class PerConfigurableLevelSubjectEventSequenceResolver {
    level;
    rawEventBased;
    constructor(level, rawEventBased = true) {
        this.level = level;
        this.rawEventBased = rawEventBased;
    }
    resolve(eventOrRawEvent, metadata, rawEvent) {
        const subject = this.rawEventBased
            ? eventOrRawEvent.subject
            : rawEvent.subject;
        const parts = subject.split('/').filter(p => p.length > 0);
        return '/' + parts.slice(0, this.level).join('/');
    }
    call(thisArg, ...args) {
        return this.resolve(args[0], args[1], args[2]);
    }
}
exports.PerConfigurableLevelSubjectEventSequenceResolver = PerConfigurableLevelSubjectEventSequenceResolver;
