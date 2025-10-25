import { Command } from '../command/Command';
import { CommandHandler } from '../command/CommandHandler';
import { StateRebuildingHandler } from '../command/StateRebuildingHandler';
import { StateRebuildingHandlerDefinition } from '../command/StateRebuildingHandlerDefinition';
import { CommandEventPublisher } from '../command/CommandEventPublisher';
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
export class CommandHandlingTestFixture<TInstance, TCommand extends Command, TResult> {
  private stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[] = [];
  private commandHandler?: CommandHandler<TInstance, TCommand, TResult>;
  private instanceClass?: new (...args: any[]) => TInstance;

  static create<TInstance, TCommand extends Command, TResult>(): CommandHandlingTestFixture<TInstance, TCommand, TResult> {
    return new CommandHandlingTestFixture();
  }

  /**
   * Register state rebuilding handlers
   */
  withStateRebuildingHandlers(handlers: StateRebuildingHandlerDefinition<any, any>[]): this {
    this.stateRebuildingHandlers = handlers;
    return this;
  }

  /**
   * Register the command handler to test
   */
  using(
    instanceClass: new (...args: any[]) => TInstance,
    handler: CommandHandler<TInstance, TCommand, TResult>
  ): this {
    this.instanceClass = instanceClass;
    this.commandHandler = handler;
    return this;
  }

  /**
   * Start the Given phase
   */
  given(): GivenPhase<TInstance, TCommand, TResult> {
    if (!this.commandHandler || !this.instanceClass) {
      throw new Error('Command handler not configured. Call using() first.');
    }

    return new GivenPhase(
      this.instanceClass,
      this.commandHandler,
      this.stateRebuildingHandlers
    );
  }
}

/**
 * Given phase - set up initial state
 */
class GivenPhase<TInstance, TCommand extends Command, TResult> {
  private instance: TInstance | null = null;

  constructor(
    private instanceClass: new (...args: any[]) => TInstance,
    private commandHandler: CommandHandler<TInstance, TCommand, TResult>,
    private stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[]
  ) {}

  /**
   * Start with no prior state
   */
  givenNothing(): WhenPhase<TInstance, TCommand, TResult> {
    return new WhenPhase(
      this.instanceClass,
      this.commandHandler,
      this.stateRebuildingHandlers,
      null
    );
  }

  /**
   * Start with events that build up state
   */
  givenEvents(...events: any[]): WhenPhase<TInstance, TCommand, TResult> {
    let instance: TInstance | null = null;

    for (const event of events) {
      instance = this.applyStateRebuilding(instance, event);
    }

    return new WhenPhase(
      this.instanceClass,
      this.commandHandler,
      this.stateRebuildingHandlers,
      instance
    );
  }

  /**
   * Start with explicit state
   */
  givenState(instance: TInstance): WhenPhase<TInstance, TCommand, TResult> {
    return new WhenPhase(
      this.instanceClass,
      this.commandHandler,
      this.stateRebuildingHandlers,
      instance
    );
  }

  private applyStateRebuilding(instance: TInstance | null, event: any): TInstance {
    const eventName = event.constructor.name;

    for (const handlerDef of this.stateRebuildingHandlers) {
      if (handlerDef.eventClass.name === eventName) {
        const handler = handlerDef.handler as any;
        instance = handler(instance, event);
      }
    }

    return instance!;
  }
}

/**
 * When phase - execute command
 */
class WhenPhase<TInstance, TCommand extends Command, TResult> {
  private capturedEvents: CapturedEvent[] = [];
  private result?: TResult;
  private error?: Error;

  constructor(
    private instanceClass: new (...args: any[]) => TInstance,
    private commandHandler: CommandHandler<TInstance, TCommand, TResult>,
    private stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[],
    private instance: TInstance | null
  ) {}

  /**
   * Execute command
   */
  async when(command: TCommand, metadata: Record<string, any> = {}): Promise<ExpectPhase<TInstance, TCommand, TResult>> {
    const publisher: CommandEventPublisher<TInstance> = {
      publish: (event, eventMetadata = {}, preconditions = []) => {
        this.capturedEvents.push({ event, metadata: eventMetadata, preconditions });
      }
    };

    try {
      const handlerLength = (this.commandHandler as any).length;

      if (handlerLength === 2) {
        // ForCommand variant
        this.result = await (this.commandHandler as any)(command, publisher);
      } else if (handlerLength === 3) {
        // ForInstanceAndCommand variant
        this.result = await (this.commandHandler as any)(this.instance, command, publisher);
      } else {
        // ForInstanceAndCommandAndMetadata variant
        this.result = await (this.commandHandler as any)(this.instance, command, metadata, publisher);
      }
    } catch (error) {
      this.error = error as Error;
    }

    return new ExpectPhase(
      this.result,
      this.error,
      this.capturedEvents,
      this.instance,
      this.stateRebuildingHandlers
    );
  }
}

/**
 * Expect phase - assert results
 */
class ExpectPhase<TInstance, TCommand extends Command, TResult> {
  private currentEventIndex = 0;

  constructor(
    private result?: TResult,
    private error?: Error,
    private capturedEvents: CapturedEvent[] = [],
    private instance: TInstance | null = null,
    private stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[] = []
  ) {}

  /**
   * Expect successful execution (no error)
   */
  expectSuccessfulExecution(): this {
    if (this.error) {
      throw new Error(`Expected successful execution but got error: ${this.error.message}`);
    }
    return this;
  }

  /**
   * Expect execution to fail with error
   */
  expectFailure(errorMessage?: string): this {
    if (!this.error) {
      throw new Error('Expected execution to fail but it succeeded');
    }
    if (errorMessage && !this.error.message.includes(errorMessage)) {
      throw new Error(
        `Expected error message to contain '${errorMessage}' but got '${this.error.message}'`
      );
    }
    return this;
  }

  /**
   * Expect specific result
   */
  expectResult(expected: TResult): this {
    if (JSON.stringify(this.result) !== JSON.stringify(expected)) {
      throw new Error(
        `Expected result ${JSON.stringify(expected)} but got ${JSON.stringify(this.result)}`
      );
    }
    return this;
  }

  /**
   * Expect exact number of events
   */
  expectEventCount(count: number): this {
    if (this.capturedEvents.length !== count) {
      throw new Error(
        `Expected ${count} events but got ${this.capturedEvents.length}`
      );
    }
    return this;
  }

  /**
   * Expect no events were published
   */
  expectNoEvents(): this {
    return this.expectEventCount(0);
  }

  /**
   * Expect a single event
   */
  expectSingleEvent(expected: any): this {
    this.expectEventCount(1);
    return this.expectEvent(expected);
  }

  /**
   * Expect next event to match
   */
  expectEvent(expected: any): this {
    if (this.currentEventIndex >= this.capturedEvents.length) {
      throw new Error(
        `Expected event at index ${this.currentEventIndex} but only ${this.capturedEvents.length} events were captured`
      );
    }

    const actual = this.capturedEvents[this.currentEventIndex].event;

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Event at index ${this.currentEventIndex} does not match.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
      );
    }

    this.currentEventIndex++;
    return this;
  }

  /**
   * Expect event with metadata
   */
  expectEventWithMetadata(expected: any, metadata: Record<string, any>): this {
    this.expectEvent(expected);

    const actualMetadata = this.capturedEvents[this.currentEventIndex - 1].metadata;

    if (JSON.stringify(actualMetadata) !== JSON.stringify(metadata)) {
      throw new Error(
        `Metadata for event at index ${this.currentEventIndex - 1} does not match.\nExpected: ${JSON.stringify(metadata)}\nActual: ${JSON.stringify(actualMetadata)}`
      );
    }

    return this;
  }

  /**
   * Get all captured events
   */
  getCapturedEvents(): any[] {
    return this.capturedEvents.map(ce => ce.event);
  }

  /**
   * Get the result
   */
  getResult(): TResult | undefined {
    return this.result;
  }

  /**
   * Get the error if any
   */
  getError(): Error | undefined {
    return this.error;
  }
}
