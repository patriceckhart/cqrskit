import { Command, SubjectCondition } from './Command';
import { CommandHandler } from './CommandHandler';
import { CommandHandlerDefinition } from './CommandHandlerDefinition';
import { StateRebuildingHandlerDefinition } from './StateRebuildingHandlerDefinition';
import { CommandEventPublisher } from './CommandEventPublisher';
import { EventStoreAdapter } from '../persistence/EventStoreAdapter';
import { EventTypeResolver } from '../types/EventTypeResolver';
import { EventDataMarshaller } from '../serialization/EventDataMarshaller';
import { EventUpcasters } from '../upcaster/EventUpcaster';
import { StateRebuildingCache, CacheValue, NoStateRebuildingCache } from './cache/StateRebuildingCache';
import { SourcingMode } from './SourcingMode';
import { RawEvent, Precondition } from '../types/Event';

/**
 * Metadata propagation mode
 */
export enum MetadataPropagationMode {
  NONE = 'NONE',
  SHALLOW = 'SHALLOW',
  DEEP = 'DEEP'
}

/**
 * Configuration for CommandRouter
 */
export interface CommandRouterConfig {
  eventStore: EventStoreAdapter;
  eventTypeResolver: EventTypeResolver;
  eventDataMarshaller: EventDataMarshaller;
  commandHandlers: CommandHandlerDefinition<any, any, any>[];
  stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[];
  eventSource: string;
  cache?: StateRebuildingCache;
  upcasters?: EventUpcasters;
  metadataPropagation?: {
    mode: MetadataPropagationMode;
    keys?: string[];
  };
}

/**
 * Routes commands to appropriate handlers and manages event sourcing
 */
export class CommandRouter {
  private eventStore: EventStoreAdapter;
  private eventTypeResolver: EventTypeResolver;
  private eventDataMarshaller: EventDataMarshaller;
  private commandHandlers: Map<string, CommandHandlerDefinition<any, any, any>>;
  private stateRebuildingHandlers: Map<string, StateRebuildingHandlerDefinition<any, any>[]>;
  private eventSource: string;
  private cache: StateRebuildingCache;
  private upcasters?: EventUpcasters;
  private metadataPropagation: {
    mode: MetadataPropagationMode;
    keys?: string[];
  };

  constructor(config: CommandRouterConfig) {
    this.eventStore = config.eventStore;
    this.eventTypeResolver = config.eventTypeResolver;
    this.eventDataMarshaller = config.eventDataMarshaller;
    this.eventSource = config.eventSource;
    this.cache = config.cache || new NoStateRebuildingCache();
    this.upcasters = config.upcasters;
    this.metadataPropagation = config.metadataPropagation || { mode: MetadataPropagationMode.NONE };

    // Index command handlers by command class name
    this.commandHandlers = new Map();
    for (const def of config.commandHandlers) {
      this.commandHandlers.set(def.commandClass.name, def);
    }

    // Index state rebuilding handlers by instance class name
    this.stateRebuildingHandlers = new Map();
    for (const def of config.stateRebuildingHandlers) {
      const handlers = this.stateRebuildingHandlers.get(def.instanceClass.name) || [];
      handlers.push(def);
      this.stateRebuildingHandlers.set(def.instanceClass.name, handlers);
    }
  }

  /**
   * Send a command and return the result
   */
  async send<TResult>(command: Command, metadata: Record<string, any> = {}): Promise<TResult> {
    const commandName = command.constructor.name;
    const definition = this.commandHandlers.get(commandName);

    if (!definition) {
      throw new Error(`No command handler registered for ${commandName}`);
    }

    const subject = command.getSubject();
    const subjectCondition = command.getSubjectCondition?.() || SubjectCondition.NONE;

    // Step 1: Rebuild state from historical events
    const { instance, lastEventId } = await this.rebuildState(
      subject,
      definition.instanceClass,
      definition.sourcingMode
    );

    // Step 2: Validate subject condition
    await this.validateSubjectCondition(subject, subjectCondition, instance, lastEventId);

    // Step 3: Capture events during command execution
    const capturedEvents: Array<{
      event: any;
      metadata: Record<string, any>;
      preconditions: Precondition[];
    }> = [];

    const publisher: CommandEventPublisher<any> = {
      publish: (event, eventMetadata = {}, preconditions = []) => {
        capturedEvents.push({ event, metadata: eventMetadata, preconditions });
      }
    };

    // Step 4: Execute command handler
    let result: TResult;
    const handlerLength = definition.handler.length;

    if (handlerLength === 2) {
      // ForCommand variant
      result = await (definition.handler as any)(command, publisher);
    } else if (handlerLength === 3) {
      // ForInstanceAndCommand variant
      result = await (definition.handler as any)(instance, command, publisher);
    } else {
      // ForInstanceAndCommandAndMetadata variant
      result = await (definition.handler as any)(instance, command, metadata, publisher);
    }

    // Step 5: Apply state rebuilding to new events
    let updatedInstance = instance;
    for (const captured of capturedEvents) {
      updatedInstance = await this.applyStateRebuilding(
        updatedInstance,
        captured.event,
        captured.metadata,
        subject,
        definition.instanceClass,
        null
      );
    }

    // Step 6: Publish events atomically
    if (capturedEvents.length > 0) {
      const eventsToPublish = capturedEvents.map(captured => {
        const eventType = this.eventTypeResolver.getEventType(captured.event.constructor);
        const eventData = this.eventDataMarshaller.serialize({
          metadata: this.propagateMetadata(metadata, captured.metadata),
          payload: captured.event
        });

        return {
          source: this.eventSource,
          subject,
          type: eventType,
          data: eventData,
          metadata: captured.metadata,
          preconditions: captured.preconditions
        };
      });

      // Combine all preconditions
      const allPreconditions = capturedEvents.flatMap(c => c.preconditions);

      await this.eventStore.publishEvents(eventsToPublish, allPreconditions);
    }

    return result;
  }

  /**
   * Rebuild state from historical events
   */
  private async rebuildState<TInstance>(
    subject: string,
    instanceClass: new (...args: any[]) => TInstance,
    sourcingMode: SourcingMode
  ): Promise<{ instance: TInstance | null; lastEventId: string | null }> {
    if (sourcingMode === SourcingMode.NONE) {
      return { instance: null, lastEventId: null };
    }

    const recursive = sourcingMode === SourcingMode.RECURSIVE;
    let instance: TInstance | null = null;
    let lastEventId: string | null = null;
    const sourcedSubjectIds = new Map<string, string>();

    // Try to use cache
    const cacheValue = await this.cache.fetchAndMerge(
      { subject, instanceClass, sourcingMode },
      async (cached) => {
        let currentInstance: TInstance | null = cached?.instance || null;
        let currentEventId = cached?.eventId || null;
        const currentSourced = cached?.sourcedSubjectIds || new Map<string, string>();

        // Stream events from cache position
        const options = currentEventId ? { lowerBound: currentEventId, includeLowerBound: false } : undefined;

        for await (const rawEvent of this.eventStore.streamEvents(subject, options, recursive)) {
          // Apply upcasting
          const upcastedEvents = this.upcasters ? this.upcasters.upcast(rawEvent) : [rawEvent];

          for (const upcastedEvent of upcastedEvents) {
            // Deserialize and apply
            try {
              const eventClass = this.eventTypeResolver.getClass(upcastedEvent.type);
              const eventData = this.eventDataMarshaller.deserialize(upcastedEvent.data, eventClass);

              currentInstance = await this.applyStateRebuilding(
                currentInstance,
                eventData.payload,
                eventData.metadata,
                upcastedEvent.subject,
                instanceClass,
                upcastedEvent
              ) as TInstance | null;

              currentEventId = upcastedEvent.id;
              currentSourced.set(upcastedEvent.subject, upcastedEvent.id);
            } catch (error) {
              // Skip events we can't deserialize (might be for different aggregates)
              continue;
            }
          }
        }

        return {
          eventId: currentEventId!,
          instance: currentInstance!,
          sourcedSubjectIds: currentSourced
        };
      }
    );

    return {
      instance: cacheValue.instance,
      lastEventId: cacheValue.eventId
    };
  }

  /**
   * Apply state rebuilding handlers to an event
   */
  private async applyStateRebuilding<TInstance>(
    instance: TInstance | null,
    event: any,
    metadata: Record<string, any>,
    subject: string,
    instanceClass: new (...args: any[]) => TInstance,
    rawEvent: RawEvent | null
  ): Promise<TInstance> {
    const handlers = this.stateRebuildingHandlers.get(instanceClass.name) || [];
    const eventName = event.constructor.name;

    for (const handlerDef of handlers) {
      if (handlerDef.eventClass.name === eventName) {
        const handler = handlerDef.handler;
        const handlerLength = handler.length;

        if (handlerLength === 2) {
          // FromObject
          instance = await (handler as any)(instance, event);
        } else if (handlerLength === 3) {
          // FromObjectAndRawEvent or FromObjectAndMetadata
          // Check if third param looks like RawEvent (has 'id' and 'type' properties)
          if (rawEvent) {
            instance = await (handler as any)(instance, event, rawEvent);
          } else {
            instance = await (handler as any)(instance, event, metadata);
          }
        } else if (handlerLength === 4) {
          // FromObjectAndMetadataAndSubject
          instance = await (handler as any)(instance, event, metadata, subject);
        } else {
          // FromObjectAndMetadataAndSubjectAndRawEvent
          instance = await (handler as any)(instance, event, metadata, subject, rawEvent);
        }
      }
    }

    return instance!;
  }

  /**
   * Validate subject condition before command execution
   */
  private async validateSubjectCondition(
    subject: string,
    condition: SubjectCondition,
    instance: any,
    lastEventId: string | null
  ): Promise<void> {
    if (condition === SubjectCondition.NEW) {
      if (lastEventId !== null) {
        throw new Error(`Subject '${subject}' must be new (not exist) but it already exists`);
      }
    } else if (condition === SubjectCondition.EXISTS) {
      if (lastEventId === null) {
        throw new Error(`Subject '${subject}' must exist but it does not`);
      }
    }
  }

  /**
   * Propagate metadata based on configuration
   */
  private propagateMetadata(
    commandMetadata: Record<string, any>,
    eventMetadata: Record<string, any>
  ): Record<string, any> {
    if (this.metadataPropagation.mode === MetadataPropagationMode.NONE) {
      return eventMetadata;
    }

    if (this.metadataPropagation.mode === MetadataPropagationMode.DEEP) {
      return { ...commandMetadata, ...eventMetadata };
    }

    // SHALLOW mode
    if (this.metadataPropagation.keys) {
      const propagated: Record<string, any> = { ...eventMetadata };
      for (const key of this.metadataPropagation.keys) {
        if (commandMetadata[key] !== undefined) {
          propagated[key] = commandMetadata[key];
        }
      }
      return propagated;
    }

    return eventMetadata;
  }
}
