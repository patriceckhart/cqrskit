import {
  CommandRouter,
  CommandRouterConfig,
  MetadataPropagationMode,
  GenesisDBAdapter,
  ConfiguredEventTypeResolver,
  JsonEventDataMarshaller,
  InMemoryStateCache,
  InMemoryProgressTracker,
  DefaultPartitionKeyResolver,
  PerSubjectEventSequenceResolver,
  EventHandlingProcessor,
  CommandHandlerDefinition,
  StateRebuildingHandlerDefinition,
  EventHandlerDefinition,
  SourcingMode
} from '../../src';

import { Task } from './domain/Task';
import { CreateTaskCommand } from './commands/CreateTaskCommand';
import { AssignTaskCommand } from './commands/AssignTaskCommand';
import { StartTaskCommand } from './commands/StartTaskCommand';
import { CompleteTaskCommand } from './commands/CompleteTaskCommand';
import { TaskCreatedEvent } from './events/TaskCreatedEvent';
import { TaskAssignedEvent } from './events/TaskAssignedEvent';
import { TaskStartedEvent } from './events/TaskStartedEvent';
import { TaskCompletedEvent } from './events/TaskCompletedEvent';
import { TaskHandlers } from './handlers/TaskHandlers';
import { TaskListProjector } from './projectors/TaskListProjector';

/**
 * Task Management System Example
 *
 * This example demonstrates how to use CQRSKit to build an event-sourced task management application.
 */
async function main() {
  console.log('Starting Task Management System...\n');

  // Step 1: Configure Genesis DB adapter
  const eventStore = new GenesisDBAdapter({
    apiUrl: process.env.GENESISDB_API_URL || 'http://localhost:8080',
    authToken: process.env.GENESISDB_AUTH_TOKEN || 'dev-token',
    source: 'task-management-app'
  });

  // Step 2: Configure event type resolver
  const eventTypeResolver = new ConfiguredEventTypeResolver()
    .register('tasks.TaskCreatedEvent', TaskCreatedEvent)
    .register('tasks.TaskAssignedEvent', TaskAssignedEvent)
    .register('tasks.TaskStartedEvent', TaskStartedEvent)
    .register('tasks.TaskCompletedEvent', TaskCompletedEvent);

  // Step 3: Create handler instances
  const taskHandlers = new TaskHandlers();
  const taskListProjector = new TaskListProjector();

  // Step 4: Define command handlers
  const commandHandlers: CommandHandlerDefinition<any, any, any>[] = [
    {
      instanceClass: Task,
      commandClass: CreateTaskCommand,
      handler: taskHandlers.handleCreate.bind(taskHandlers),
      sourcingMode: SourcingMode.LOCAL
    },
    {
      instanceClass: Task,
      commandClass: AssignTaskCommand,
      handler: taskHandlers.handleAssign.bind(taskHandlers),
      sourcingMode: SourcingMode.LOCAL
    },
    {
      instanceClass: Task,
      commandClass: StartTaskCommand,
      handler: taskHandlers.handleStart.bind(taskHandlers),
      sourcingMode: SourcingMode.LOCAL
    },
    {
      instanceClass: Task,
      commandClass: CompleteTaskCommand,
      handler: taskHandlers.handleComplete.bind(taskHandlers),
      sourcingMode: SourcingMode.LOCAL
    }
  ];

  // Step 5: Define state rebuilding handlers
  const stateRebuildingHandlers: StateRebuildingHandlerDefinition<any, any>[] = [
    {
      instanceClass: Task,
      eventClass: TaskCreatedEvent,
      handler: taskHandlers.onTaskCreated.bind(taskHandlers)
    },
    {
      instanceClass: Task,
      eventClass: TaskAssignedEvent,
      handler: taskHandlers.onTaskAssigned.bind(taskHandlers)
    },
    {
      instanceClass: Task,
      eventClass: TaskStartedEvent,
      handler: taskHandlers.onTaskStarted.bind(taskHandlers)
    },
    {
      instanceClass: Task,
      eventClass: TaskCompletedEvent,
      handler: taskHandlers.onTaskCompleted.bind(taskHandlers)
    }
  ];

  // Step 6: Define event handlers
  const eventHandlers: EventHandlerDefinition<any>[] = [
    {
      group: 'task-list',
      eventClass: TaskCreatedEvent,
      handler: taskListProjector.onTaskCreated.bind(taskListProjector)
    },
    {
      group: 'task-list',
      eventClass: TaskAssignedEvent,
      handler: taskListProjector.onTaskAssigned.bind(taskListProjector)
    },
    {
      group: 'task-list',
      eventClass: TaskStartedEvent,
      handler: taskListProjector.onTaskStarted.bind(taskListProjector)
    },
    {
      group: 'task-list',
      eventClass: TaskCompletedEvent,
      handler: taskListProjector.onTaskCompleted.bind(taskListProjector)
    }
  ];

  // Step 7: Create CommandRouter
  const commandRouter = new CommandRouter({
    eventStore,
    eventTypeResolver,
    eventDataMarshaller: new JsonEventDataMarshaller(),
    commandHandlers,
    stateRebuildingHandlers,
    eventSource: 'task-management-app',
    cache: new InMemoryStateCache(100),
    metadataPropagation: {
      mode: MetadataPropagationMode.SHALLOW,
      keys: ['correlationId', 'userId']
    }
  });

  // Step 8: Create EventHandlingProcessor for async event processing
  const eventProcessor = new EventHandlingProcessor({
    group: 'task-list',
    eventStore,
    eventTypeResolver,
    eventDataMarshaller: new JsonEventDataMarshaller(),
    eventHandlers,
    progressTracker: new InMemoryProgressTracker(),
    partitionKeyResolver: new DefaultPartitionKeyResolver(1),
    eventSequenceResolver: new PerSubjectEventSequenceResolver(true),
    subject: '/',
    recursive: true,
    partition: 0
  });

  // Step 9: Start event processor in background
  console.log('Starting event processor...\n');
  setTimeout(() => eventProcessor.start(), 100);

  // Step 10: Execute commands
  console.log('Executing commands...\n');

  try {
    // Create tasks
    console.log('1. Creating task "Implement login feature"...');
    await commandRouter.send(
      new CreateTaskCommand(
        'task-1',
        'Implement login feature',
        'Add user authentication with email and password'
      ),
      { correlationId: 'cmd-001', userId: 'admin' }
    );

    console.log('2. Creating task "Write documentation"...');
    await commandRouter.send(
      new CreateTaskCommand(
        'task-2',
        'Write documentation',
        'Document the new authentication system'
      ),
      { correlationId: 'cmd-002', userId: 'admin' }
    );

    // Wait for events to be processed
    await sleep(500);

    // Assign first task
    console.log('3. Assigning "Implement login feature" to Alice...');
    await commandRouter.send(
      new AssignTaskCommand('task-1', 'Alice'),
      { correlationId: 'cmd-003', userId: 'manager' }
    );

    // Wait for events to be processed
    await sleep(500);

    // Start the task
    console.log('4. Starting work on "Implement login feature"...');
    await commandRouter.send(
      new StartTaskCommand('task-1'),
      { correlationId: 'cmd-004', userId: 'alice' }
    );

    // Wait for events to be processed
    await sleep(500);

    // Try to complete before starting (should fail)
    console.log('5. Trying to complete unstarted task (should fail)...');
    try {
      await commandRouter.send(
        new CompleteTaskCommand('task-2'),
        { correlationId: 'cmd-005', userId: 'bob' }
      );
    } catch (error: any) {
      console.log(`   Expected error: ${error.message}`);
    }

    // Complete the first task
    console.log('6. Completing "Implement login feature"...');
    await commandRouter.send(
      new CompleteTaskCommand('task-1'),
      { correlationId: 'cmd-006', userId: 'alice' }
    );

    // Wait for events to be processed
    await sleep(500);

    // Query the task list
    console.log('\nCurrent task list:');
    const allTasks = taskListProjector.getAllTasks();
    allTasks.forEach(task => {
      console.log(`   - [${task.status}] ${task.title}`);
      if (task.assignee) {
        console.log(`     Assigned to: ${task.assignee}`);
      }
      if (task.completedAt) {
        console.log(`     Completed: ${task.completedAt}`);
      }
    });

    console.log('\nTasks by status:');
    console.log(`   TODO: ${taskListProjector.getTasksByStatus('TODO').length}`);
    console.log(`   IN_PROGRESS: ${taskListProjector.getTasksByStatus('IN_PROGRESS').length}`);
    console.log(`   COMPLETED: ${taskListProjector.getTasksByStatus('COMPLETED').length}`);

    console.log('\nAlice\'s tasks:');
    const aliceTasks = taskListProjector.getTasksByAssignee('Alice');
    aliceTasks.forEach(task => {
      console.log(`   - [${task.status}] ${task.title}`);
    });

    console.log('\nExample completed successfully!');

  } catch (error) {
    console.error('\nError:', error);
  } finally {
    // Stop event processor
    console.log('\nStopping event processor...');
    eventProcessor.stop();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
