# CQRSKit

A lightweight TypeScript CQRS (Command Query Responsibility Segregation) and Event Sourcing framework with pluggable database adapters.

## Features

- **Full CQRS Implementation** - Separate command and query models with clear boundaries
- **Event Sourcing** - Rebuild aggregate state from historical events
- **Pluggable Database Adapters** - Easy integration with any event store (Genesis DB, EventStoreDB, PostgreSQL, etc.)
- **TypeScript-First** - Full type safety and excellent IDE support
- **Decorator-Based API** - Clean, intuitive syntax for defining handlers
- **State Caching** - Optional LRU cache for reconstructed aggregates
- **Event Upcasting** - Handle event schema evolution gracefully
- **Async Event Processing** - Background event handlers with partitioning and progress tracking
- **Testing Utilities** - Fluent Given-When-Then API for testing command handlers
- **Zero Dependencies** (except database adapters)

## Installation

```bash
npm install cqrskit
```

For Genesis DB support:
```bash
npm install cqrskit genesisdb
```

## Key Concepts & Terminology

Before diving in, here are the core concepts used throughout this framework:

### CQRS (Command Query Responsibility Segregation)
A pattern that separates read and write operations into different models:
- **Commands** modify state (writes)
- **Queries** read state (reads)
- This separation allows independent scaling and optimization of reads vs writes

### Event Sourcing
Instead of storing current state, store a sequence of events that led to that state:
- **Events** are immutable facts that have occurred
- **State Rebuilding** reconstructs current state by replaying events
- Provides complete audit trail and time-travel capabilities

### Aggregate
A cluster of domain objects treated as a single unit:
- Enforces business rules and invariants
- All state changes happen through events
- Example: A `Task` aggregate with properties like id, title, status

### Command
An instruction to perform an action that may change state:
- Immutable data structure
- Examples: `CreateTaskCommand`, `AssignTaskCommand`
- Can succeed or fail based on business rules

### Event
A fact that has already happened and cannot be changed:
- Immutable data structure
- Past tense naming: `TaskCreatedEvent`, `TaskAssignedEvent`
- Contains all data needed to update state

### Command Handler
Business logic that processes a command:
- Validates the command
- Checks business rules
- Publishes one or more events if valid
- Example: `handleCreate()`, `handleAssign()`

### State Rebuilding Handler
Logic that applies an event to recreate aggregate state:
- Takes previous state and an event
- Returns new state
- Pure function (no side effects)
- Example: `onTaskCreated()`, `onTaskAssigned()`

### Event Handler
Asynchronous logic that reacts to events:
- Updates read models (projections)
- Sends notifications
- Triggers external actions
- Runs in background, separate from commands

### Subject
A unique identifier for an aggregate instance:
- Hierarchical path format: `/task/task-1`, `/user/user-123`
- Used to query and store events
- Supports recursive queries (e.g., `/task/*`)

### Decorator
TypeScript annotation that adds metadata to classes/methods:
- `@CommandHandling()` - Marks command handler methods
- `@StateRebuilding()` - Marks state rebuilding methods
- `@EventHandling()` - Marks event handler methods
- Simplifies configuration and registration

### Sourcing Mode
Strategy for loading events when executing a command:
- **NONE** - Don't load any events (for stateless commands)
- **LOCAL** - Load events for exact subject only
- **RECURSIVE** - Load events for subject and all children (for parent-child relationships)

### Upcasting
Converting old event versions to new versions:
- Handles event schema evolution
- Example: Renaming fields, adding required fields
- Allows changing event structure without breaking old data
- Applied automatically when reading events

### Precondition
Optimistic locking mechanism:
- Checks expected last event ID before publishing
- Prevents concurrent modification conflicts
- Example: Ensure task hasn't been modified since we loaded it

### Event Store
Database that stores events:
- Append-only (events never modified/deleted)
- Supports querying by subject and timestamp
- Examples: Genesis DB, PostgreSQL, MySQL
- CQRSKit supports custom adapters

### Read Model (Projection)
Denormalized view of data optimized for queries:
- Built from events
- Can be rebuilt anytime from event history
- Example: Task list, user profile view
- Updated by event handlers

### Partition
Splitting event processing across multiple workers:
- Enables parallel processing
- Each partition handles subset of events
- Ensures events for same subject stay in order

### Progress Tracker
Tracks position in event stream:
- Remembers last processed event
- Enables resuming after restart
- Per partition and event handler group

### Metadata
Additional context attached to events:
- Not part of event data itself
- Examples: correlationId, userId, timestamp
- Can be propagated from commands to events

### Cache
In-memory storage of reconstructed aggregate state:
- Improves performance
- LRU eviction policy (removes least recently used)
- Optional optimization

## Quick Start

### 1. Define Your Domain

```typescript
// domain/Task.ts
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export class Task {
  constructor(
    public id: string,
    public title: string,
    public assignee: string | null,
    public status: TaskStatus
  ) {}
}
```

### 2. Create Commands

```typescript
// commands/CreateTaskCommand.ts
import { Command, SubjectCondition } from 'cqrskit';

export class CreateTaskCommand implements Command {
  constructor(
    public taskId: string,
    public title: string
  ) {}

  getSubject(): string {
    return `/task/${this.taskId}`;
  }

  getSubjectCondition(): SubjectCondition {
    return SubjectCondition.NEW; // Must not exist
  }
}
```

### 3. Define Events

```typescript
// events/TaskCreatedEvent.ts
export class TaskCreatedEvent {
  constructor(
    public taskId: string,
    public title: string,
    public createdAt: string
  ) {}
}
```

### 4. Create Command Handlers

```typescript
// handlers/TaskHandlers.ts
import { CommandEventPublisher, SourcingMode } from 'cqrskit';
import { CommandHandling, StateRebuilding } from 'cqrskit';

export class TaskHandlers {
  @CommandHandling({ sourcingMode: SourcingMode.LOCAL })
  async handleCreate(
    command: CreateTaskCommand,
    publisher: CommandEventPublisher<Task>
  ): Promise<string> {
    publisher.publish(
      new TaskCreatedEvent(command.taskId, command.title, new Date().toISOString())
    );
    return command.taskId;
  }

  @StateRebuilding()
  onTaskCreated(task: Task | null, event: TaskCreatedEvent): Task {
    return new Task(event.taskId, event.title, null, TaskStatus.TODO);
  }
}
```

### 5. Set Up the Framework

```typescript
import {
  CommandRouter,
  GenesisDBAdapter,
  ConfiguredEventTypeResolver,
  JsonEventDataMarshaller,
  InMemoryStateCache
} from 'cqrskit';

// Configure database adapter
const eventStore = new GenesisDBAdapter({
  apiUrl: 'http://localhost:8080',
  authToken: 'your-token',
  source: 'my-app'
});

// Configure event type resolver
const eventTypeResolver = new ConfiguredEventTypeResolver()
  .register('app.TaskCreatedEvent', TaskCreatedEvent);

// Create command router
const commandRouter = new CommandRouter({
  eventStore,
  eventTypeResolver,
  eventDataMarshaller: new JsonEventDataMarshaller(),
  commandHandlers: [/* your handler definitions */],
  stateRebuildingHandlers: [/* your state rebuilding definitions */],
  eventSource: 'my-app',
  cache: new InMemoryStateCache(1000)
});

// Send commands
const taskId = await commandRouter.send(
  new CreateTaskCommand('task-1', 'Implement login feature')
);
```

## Core Concepts

### Commands

Commands are immutable instructions to change aggregate state. They implement the `Command` interface:

```typescript
interface Command {
  getSubject(): string;
  getSubjectCondition?(): SubjectCondition;
}
```

**Subject Conditions:**
- `NONE` - No validation (default)
- `NEW` - Subject must not exist (for creation)
- `EXISTS` - Subject must exist (for updates)

### Events

Events represent facts that have occurred in the system. They are plain TypeScript classes:

```typescript
class TaskCreatedEvent {
  constructor(
    public taskId: string,
    public title: string,
    public createdAt: string
  ) {}
}
```

### Command Handlers

Command handlers contain business logic. They receive commands, validate them, and publish events:

```typescript
@CommandHandling({ sourcingMode: SourcingMode.RECURSIVE })
async handleCommand(
  instance: MyAggregate,        // Reconstructed state
  command: MyCommand,            // The command
  publisher: CommandEventPublisher<MyAggregate>
): Promise<Result> {
  // Validate
  if (!instance.canDoSomething()) {
    throw new Error('Cannot do something');
  }

  // Publish events
  publisher.publish(new SomethingDoneEvent(...));

  return result;
}
```

**Sourcing Modes:**
- `NONE` - No event sourcing
- `LOCAL` - Load events for exact subject only
- `RECURSIVE` - Load events for subject and children

### State Rebuilding

State rebuilding handlers reconstruct aggregate state from events:

```typescript
@StateRebuilding()
onEventOccurred(
  instance: MyAggregate | null,
  event: EventOccurred
): MyAggregate {
  // Return new state
  return new MyAggregate(...);
}
```

### Event Handlers

Event handlers process events asynchronously (for read models, notifications, etc.):

```typescript
@EventHandling({ group: 'my-projector' })
async onEventOccurred(event: EventOccurred): Promise<void> {
  // Update read model
  await database.save(...);
}
```

## Pluggable Database Adapters

CQRSKit supports any event store through the `EventStoreAdapter` interface:

```typescript
interface EventStoreAdapter {
  streamEvents(subject: string, options?: StreamOptions, recursive?: boolean): AsyncIterable<RawEvent>;
  observeEvents(subject: string, options?: StreamOptions, recursive?: boolean): AsyncIterable<RawEvent>;
  publishEvents(events: EventToPublish[], preconditions?: Precondition[]): Promise<RawEvent[]>;
  ping?(): Promise<void>;
}
```

### Built-in Adapters

#### Genesis DB

```typescript
import { GenesisDBAdapter } from 'cqrskit';

const adapter = new GenesisDBAdapter({
  apiUrl: process.env.GENESISDB_API_URL,
  authToken: process.env.GENESISDB_AUTH_TOKEN,
  source: 'my-app'
});
```

### Creating Custom Adapters

See the `examples/custom-adapter/` directory for complete examples:
- **InMemoryAdapter.ts** - Simple in-memory implementation
- **MySQLAdapter.ts** - MySQL database adapter with polling
- **PostgreSQLAdapter.ts** - PostgreSQL adapter with LISTEN/NOTIFY

Example custom adapter:

```typescript
export class MyCustomAdapter implements EventStoreAdapter {
  async *streamEvents(subject: string, options?: StreamOptions): AsyncIterable<RawEvent> {
    // Fetch historical events from your database
    const events = await myDatabase.query(...);
    for (const event of events) {
      yield mapToRawEvent(event);
    }
  }

  async *observeEvents(subject: string, options?: StreamOptions): AsyncIterable<RawEvent> {
    // Stream historical events first
    for await (const event of this.streamEvents(subject, options)) {
      yield event;
    }
    // Then subscribe to new events
    await myDatabase.subscribe(...);
  }

  async publishEvents(events: EventToPublish[]): Promise<RawEvent[]> {
    // Store events atomically
    return await myDatabase.insertEvents(events);
  }
}
```

## Testing

CQRSKit provides a fluent Given-When-Then API for testing:

```typescript
import { CommandHandlingTestFixture } from 'cqrskit';

it('should create a task', async () => {
  await CommandHandlingTestFixture
    .create<Task, CreateTaskCommand, string>()
    .withStateRebuildingHandlers([...])
    .using(Task, handlers.handleCreate)
    .given()
    .givenNothing()
    .when(new CreateTaskCommand('task-1', 'Implement login feature'))
    .then(expect => {
      expect
        .expectSuccessfulExecution()
        .expectSingleEvent(new TaskCreatedEvent(...))
        .expectResult('task-1');
    });
});
```

**Test API:**
- `givenNothing()` - Start with no state
- `givenEvents(...)` - Start with historical events
- `givenState(instance)` - Start with explicit state
- `when(command)` - Execute command
- `expectSuccessfulExecution()` - Assert no errors
- `expectFailure(message?)` - Assert error occurred
- `expectResult(value)` - Assert return value
- `expectEventCount(n)` - Assert event count
- `expectEvent(event)` - Assert next event matches
- `expectNoEvents()` - Assert no events published

## Advanced Features

### Event Upcasting

Handle event schema evolution:

```typescript
import { EventUpcaster, UpcasterResult } from 'cqrskit';

class TaskEventUpcaster implements EventUpcaster {
  canUpcast(event: RawEvent): boolean {
    return event.type === 'app.TaskAddedEvent.v1';
  }

  upcast(event: RawEvent): UpcasterResult[] {
    return [{
      type: 'app.TaskCreatedEvent',
      data: {
        ...event.data,
        createdAt: event.data.timestamp || new Date().toISOString() // Rename field
      }
    }];
  }
}
```

### State Caching

Improve performance with in-memory caching:

```typescript
import { InMemoryStateCache } from 'cqrskit';

const cache = new InMemoryStateCache(1000); // Cache 1000 aggregates

const commandRouter = new CommandRouter({
  // ...
  cache
});
```

### Metadata Propagation

Propagate metadata (correlation IDs, user context, etc.):

```typescript
import { MetadataPropagationMode } from 'cqrskit';

const commandRouter = new CommandRouter({
  // ...
  metadataPropagation: {
    mode: MetadataPropagationMode.SHALLOW,
    keys: ['correlationId', 'userId']
  }
});

await commandRouter.send(
  new MyCommand(),
  { correlationId: '123', userId: 'john' }
);
```

**Propagation Modes:**
- `NONE` - Don't propagate
- `SHALLOW` - Propagate specific keys
- `DEEP` - Propagate all metadata

### Event Partitioning

Process events in parallel with partitioning:

```typescript
import {
  EventHandlingProcessor,
  DefaultPartitionKeyResolver,
  PerSubjectEventSequenceResolver
} from 'cqrskit';

const processor = new EventHandlingProcessor({
  group: 'my-group',
  partition: 0, // Process partition 0
  partitionKeyResolver: new DefaultPartitionKeyResolver(10), // 10 partitions
  eventSequenceResolver: new PerSubjectEventSequenceResolver(),
  // ...
});

processor.start();
```

## Examples

See the `examples/` directory for complete working examples:

- **`examples/tasks/`** - Full task management system
- **`examples/custom-adapter/`** - Custom in-memory adapter
- **`examples/testing/`** - Test examples with Given-When-Then

Run the task management example:

```bash
cd examples/tasks
npm install
npx tsx app.ts
```

## Architecture

CQRSKit follows the CQRS and Event Sourcing patterns:

```
┌─────────────┐
│   Command   │
└──────┬──────┘
       │
       v
┌─────────────────┐      ┌──────────────┐
│ CommandRouter   │─────→│ Event Store  │
└─────────────────┘      └──────┬───────┘
       │                         │
       │ Rebuild State          │ Observe
       v                         v
┌─────────────────┐      ┌──────────────────┐
│ State Handlers  │      │ Event Processors │
└─────────────────┘      └──────────────────┘
                                 │
                                 v
                         ┌──────────────┐
                         │  Read Model  │
                         └──────────────┘
```

## API Reference

### Core Types

- `Command` - Base interface for commands
- `SubjectCondition` - Validation for aggregate existence
- `SourcingMode` - Event loading strategy
- `RawEvent` - Event as stored in database
- `EventToPublish` - Event to be published
- `Precondition` - Conditional event publishing

### Command Handling

- `CommandRouter` - Routes commands to handlers
- `CommandHandler` - Processes commands
- `StateRebuildingHandler` - Rebuilds state from events
- `CommandEventPublisher` - Publishes events during command execution

### Event Handling

- `EventHandler` - Processes events asynchronously
- `EventHandlingProcessor` - Background event processing
- `ProgressTracker` - Tracks processing position
- `PartitionKeyResolver` - Maps events to partitions

### Persistence

- `EventStoreAdapter` - Abstract database interface
- `GenesisDBAdapter` - Genesis DB implementation
- `StreamOptions` - Options for streaming events

### Utilities

- `EventTypeResolver` - Maps classes to event types
- `EventDataMarshaller` - Serializes events
- `EventUpcaster` - Migrates event schemas
- `StateRebuildingCache` - Caches reconstructed state

## Contributing

Contributions welcome! Please open an issue or PR.

## Related Projects

- [Genesis DB](https://genesisdb.io): Genesis DB - The GDPR-ready event sourcing database

## License

MIT
