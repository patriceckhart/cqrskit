"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandlingTestFixture = void 0;
/**
 * Fluent API for testing command handlers using Given-When-Then pattern
 */
class CommandHandlingTestFixture {
    stateRebuildingHandlers = [];
    commandHandler;
    instanceClass;
    static create() {
        return new CommandHandlingTestFixture();
    }
    /**
     * Register state rebuilding handlers
     */
    withStateRebuildingHandlers(handlers) {
        this.stateRebuildingHandlers = handlers;
        return this;
    }
    /**
     * Register the command handler to test
     */
    using(instanceClass, handler) {
        this.instanceClass = instanceClass;
        this.commandHandler = handler;
        return this;
    }
    /**
     * Start the Given phase
     */
    given() {
        if (!this.commandHandler || !this.instanceClass) {
            throw new Error('Command handler not configured. Call using() first.');
        }
        return new GivenPhase(this.instanceClass, this.commandHandler, this.stateRebuildingHandlers);
    }
}
exports.CommandHandlingTestFixture = CommandHandlingTestFixture;
/**
 * Given phase - set up initial state
 */
class GivenPhase {
    instanceClass;
    commandHandler;
    stateRebuildingHandlers;
    instance = null;
    constructor(instanceClass, commandHandler, stateRebuildingHandlers) {
        this.instanceClass = instanceClass;
        this.commandHandler = commandHandler;
        this.stateRebuildingHandlers = stateRebuildingHandlers;
    }
    /**
     * Start with no prior state
     */
    givenNothing() {
        return new WhenPhase(this.instanceClass, this.commandHandler, this.stateRebuildingHandlers, null);
    }
    /**
     * Start with events that build up state
     */
    givenEvents(...events) {
        let instance = null;
        for (const event of events) {
            instance = this.applyStateRebuilding(instance, event);
        }
        return new WhenPhase(this.instanceClass, this.commandHandler, this.stateRebuildingHandlers, instance);
    }
    /**
     * Start with explicit state
     */
    givenState(instance) {
        return new WhenPhase(this.instanceClass, this.commandHandler, this.stateRebuildingHandlers, instance);
    }
    applyStateRebuilding(instance, event) {
        const eventName = event.constructor.name;
        for (const handlerDef of this.stateRebuildingHandlers) {
            if (handlerDef.eventClass.name === eventName) {
                const handler = handlerDef.handler;
                instance = handler(instance, event);
            }
        }
        return instance;
    }
}
/**
 * When phase - execute command
 */
class WhenPhase {
    instanceClass;
    commandHandler;
    stateRebuildingHandlers;
    instance;
    capturedEvents = [];
    result;
    error;
    constructor(instanceClass, commandHandler, stateRebuildingHandlers, instance) {
        this.instanceClass = instanceClass;
        this.commandHandler = commandHandler;
        this.stateRebuildingHandlers = stateRebuildingHandlers;
        this.instance = instance;
    }
    /**
     * Execute command
     */
    async when(command, metadata = {}) {
        const publisher = {
            publish: (event, eventMetadata = {}, preconditions = []) => {
                this.capturedEvents.push({ event, metadata: eventMetadata, preconditions });
            }
        };
        try {
            const handlerLength = this.commandHandler.length;
            if (handlerLength === 2) {
                // ForCommand variant
                this.result = await this.commandHandler(command, publisher);
            }
            else if (handlerLength === 3) {
                // ForInstanceAndCommand variant
                this.result = await this.commandHandler(this.instance, command, publisher);
            }
            else {
                // ForInstanceAndCommandAndMetadata variant
                this.result = await this.commandHandler(this.instance, command, metadata, publisher);
            }
        }
        catch (error) {
            this.error = error;
        }
        return new ExpectPhase(this.result, this.error, this.capturedEvents, this.instance, this.stateRebuildingHandlers);
    }
}
/**
 * Expect phase - assert results
 */
class ExpectPhase {
    result;
    error;
    capturedEvents;
    instance;
    stateRebuildingHandlers;
    currentEventIndex = 0;
    constructor(result, error, capturedEvents = [], instance = null, stateRebuildingHandlers = []) {
        this.result = result;
        this.error = error;
        this.capturedEvents = capturedEvents;
        this.instance = instance;
        this.stateRebuildingHandlers = stateRebuildingHandlers;
    }
    /**
     * Expect successful execution (no error)
     */
    expectSuccessfulExecution() {
        if (this.error) {
            throw new Error(`Expected successful execution but got error: ${this.error.message}`);
        }
        return this;
    }
    /**
     * Expect execution to fail with error
     */
    expectFailure(errorMessage) {
        if (!this.error) {
            throw new Error('Expected execution to fail but it succeeded');
        }
        if (errorMessage && !this.error.message.includes(errorMessage)) {
            throw new Error(`Expected error message to contain '${errorMessage}' but got '${this.error.message}'`);
        }
        return this;
    }
    /**
     * Expect specific result
     */
    expectResult(expected) {
        if (JSON.stringify(this.result) !== JSON.stringify(expected)) {
            throw new Error(`Expected result ${JSON.stringify(expected)} but got ${JSON.stringify(this.result)}`);
        }
        return this;
    }
    /**
     * Expect exact number of events
     */
    expectEventCount(count) {
        if (this.capturedEvents.length !== count) {
            throw new Error(`Expected ${count} events but got ${this.capturedEvents.length}`);
        }
        return this;
    }
    /**
     * Expect no events were published
     */
    expectNoEvents() {
        return this.expectEventCount(0);
    }
    /**
     * Expect a single event
     */
    expectSingleEvent(expected) {
        this.expectEventCount(1);
        return this.expectEvent(expected);
    }
    /**
     * Expect next event to match
     */
    expectEvent(expected) {
        if (this.currentEventIndex >= this.capturedEvents.length) {
            throw new Error(`Expected event at index ${this.currentEventIndex} but only ${this.capturedEvents.length} events were captured`);
        }
        const actual = this.capturedEvents[this.currentEventIndex].event;
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Event at index ${this.currentEventIndex} does not match.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
        this.currentEventIndex++;
        return this;
    }
    /**
     * Expect event with metadata
     */
    expectEventWithMetadata(expected, metadata) {
        this.expectEvent(expected);
        const actualMetadata = this.capturedEvents[this.currentEventIndex - 1].metadata;
        if (JSON.stringify(actualMetadata) !== JSON.stringify(metadata)) {
            throw new Error(`Metadata for event at index ${this.currentEventIndex - 1} does not match.\nExpected: ${JSON.stringify(metadata)}\nActual: ${JSON.stringify(actualMetadata)}`);
        }
        return this;
    }
    /**
     * Get all captured events
     */
    getCapturedEvents() {
        return this.capturedEvents.map(ce => ce.event);
    }
    /**
     * Get the result
     */
    getResult() {
        return this.result;
    }
    /**
     * Get the error if any
     */
    getError() {
        return this.error;
    }
}
