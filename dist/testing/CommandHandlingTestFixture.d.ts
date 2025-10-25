import { Command } from '../command/Command';
import { CommandHandler } from '../command/CommandHandler';
import { StateRebuildingHandlerDefinition } from '../command/StateRebuildingHandlerDefinition';
import { Precondition } from '../types/Event';
/**
 * Captured event during command execution
 */
interface CapturedEvent {
    event: any;
    metadata: Record<string, any>;
    preconditions: Precondition[];
}
/**
 * Fluent API for testing command handlers using Given-When-Then pattern
 */
export declare class CommandHandlingTestFixture<TInstance, TCommand extends Command, TResult> {
    private stateRebuildingHandlers;
    private commandHandler?;
    private instanceClass?;
    static create<TInstance, TCommand extends Command, TResult>(): CommandHandlingTestFixture<TInstance, TCommand, TResult>;
    /**
     * Register state rebuilding handlers
     */
    withStateRebuildingHandlers(handlers: StateRebuildingHandlerDefinition<any, any>[]): this;
    /**
     * Register the command handler to test
     */
    using(instanceClass: new (...args: any[]) => TInstance, handler: CommandHandler<TInstance, TCommand, TResult>): this;
    /**
     * Start the Given phase
     */
    given(): GivenPhase<TInstance, TCommand, TResult>;
}
/**
 * Given phase - set up initial state
 */
declare class GivenPhase<TInstance, TCommand extends Command, TResult> {
    private instanceClass;
    private commandHandler;
    private stateRebuildingHandlers;
    private instance;
    constructor(instanceClass: new (...args: any[]) => TInstance, commandHandler: CommandHandler<TInstance, TCommand, TResult>, stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[]);
    /**
     * Start with no prior state
     */
    givenNothing(): WhenPhase<TInstance, TCommand, TResult>;
    /**
     * Start with events that build up state
     */
    givenEvents(...events: any[]): WhenPhase<TInstance, TCommand, TResult>;
    /**
     * Start with explicit state
     */
    givenState(instance: TInstance): WhenPhase<TInstance, TCommand, TResult>;
    private applyStateRebuilding;
}
/**
 * When phase - execute command
 */
declare class WhenPhase<TInstance, TCommand extends Command, TResult> {
    private instanceClass;
    private commandHandler;
    private stateRebuildingHandlers;
    private instance;
    private capturedEvents;
    private result?;
    private error?;
    constructor(instanceClass: new (...args: any[]) => TInstance, commandHandler: CommandHandler<TInstance, TCommand, TResult>, stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[], instance: TInstance | null);
    /**
     * Execute command
     */
    when(command: TCommand, metadata?: Record<string, any>): Promise<ExpectPhase<TInstance, TCommand, TResult>>;
}
/**
 * Expect phase - assert results
 */
declare class ExpectPhase<TInstance, TCommand extends Command, TResult> {
    private result?;
    private error?;
    private capturedEvents;
    private instance;
    private stateRebuildingHandlers;
    private currentEventIndex;
    constructor(result?: TResult | undefined, error?: Error | undefined, capturedEvents?: CapturedEvent[], instance?: TInstance | null, stateRebuildingHandlers?: StateRebuildingHandlerDefinition<any, any>[]);
    /**
     * Expect successful execution (no error)
     */
    expectSuccessfulExecution(): this;
    /**
     * Expect execution to fail with error
     */
    expectFailure(errorMessage?: string): this;
    /**
     * Expect specific result
     */
    expectResult(expected: TResult): this;
    /**
     * Expect exact number of events
     */
    expectEventCount(count: number): this;
    /**
     * Expect no events were published
     */
    expectNoEvents(): this;
    /**
     * Expect a single event
     */
    expectSingleEvent(expected: any): this;
    /**
     * Expect next event to match
     */
    expectEvent(expected: any): this;
    /**
     * Expect event with metadata
     */
    expectEventWithMetadata(expected: any, metadata: Record<string, any>): this;
    /**
     * Get all captured events
     */
    getCapturedEvents(): any[];
    /**
     * Get the result
     */
    getResult(): TResult | undefined;
    /**
     * Get the error if any
     */
    getError(): Error | undefined;
}
export {};
