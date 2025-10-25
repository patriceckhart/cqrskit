import { describe, it } from 'node:test';
import { CommandHandlingTestFixture } from '../../src';
import { Task, TaskStatus } from '../tasks/domain/Task';
import { CreateTaskCommand } from '../tasks/commands/CreateTaskCommand';
import { AssignTaskCommand } from '../tasks/commands/AssignTaskCommand';
import { StartTaskCommand } from '../tasks/commands/StartTaskCommand';
import { CompleteTaskCommand } from '../tasks/commands/CompleteTaskCommand';
import { TaskCreatedEvent } from '../tasks/events/TaskCreatedEvent';
import { TaskAssignedEvent } from '../tasks/events/TaskAssignedEvent';
import { TaskStartedEvent } from '../tasks/events/TaskStartedEvent';
import { TaskCompletedEvent } from '../tasks/events/TaskCompletedEvent';
import { TaskHandlers } from '../tasks/handlers/TaskHandlers';

/**
 * Example tests for TaskHandlers using CommandHandlingTestFixture
 *
 * Run with: npm test
 */
describe('TaskHandlers', () => {
  const handlers = new TaskHandlers();

  it('should create a new task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, CreateTaskCommand, string>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      }
    ];

    await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleCreate.bind(handlers))
      .given()
      .givenNothing()
      .when(new CreateTaskCommand('task-1', 'Implement login feature', 'Add user authentication'))
      .then(expect => {
        expect
          .expectSuccessfulExecution()
          .expectEventCount(1)
          .expectResult('task-1');

        const events = expect.getCapturedEvents();
        const createdEvent = events[0] as TaskCreatedEvent;

        if (createdEvent.taskId !== 'task-1') {
          throw new Error('Task ID mismatch');
        }
        if (createdEvent.title !== 'Implement login feature') {
          throw new Error('Title mismatch');
        }
      });
  });

  it('should assign a task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, AssignTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskAssignedEvent,
        handler: handlers.onTaskAssigned.bind(handlers)
      }
    ];

    const expect = await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleAssign.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z')
      )
      .when(new AssignTaskCommand('task-1', 'Alice'));

    expect
      .expectSuccessfulExecution()
      .expectEventCount(1);

    const events = expect.getCapturedEvents();
    const assignedEvent = events[0] as TaskAssignedEvent;

    if (assignedEvent.taskId !== 'task-1') {
      throw new Error('Task ID mismatch');
    }
    if (assignedEvent.assignee !== 'Alice') {
      throw new Error('Assignee mismatch');
    }
  });

  it('should start an assigned task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, StartTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskAssignedEvent,
        handler: handlers.onTaskAssigned.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskStartedEvent,
        handler: handlers.onTaskStarted.bind(handlers)
      }
    ];

    const expect = await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleStart.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z'),
        new TaskAssignedEvent('task-1', 'Alice', '2024-01-01T01:00:00Z')
      )
      .when(new StartTaskCommand('task-1'));

    expect
      .expectSuccessfulExecution()
      .expectEventCount(1);

    const events = expect.getCapturedEvents();
    const startedEvent = events[0] as TaskStartedEvent;

    if (startedEvent.taskId !== 'task-1') {
      throw new Error('Task ID mismatch');
    }
  });

  it('should fail to start an unassigned task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, StartTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskStartedEvent,
        handler: handlers.onTaskStarted.bind(handlers)
      }
    ];

    await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleStart.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z')
      )
      .when(new StartTaskCommand('task-1'))
      .then(expect => {
        expect
          .expectFailure('must be assigned')
          .expectNoEvents();
      });
  });

  it('should complete a started task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, CompleteTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskAssignedEvent,
        handler: handlers.onTaskAssigned.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskStartedEvent,
        handler: handlers.onTaskStarted.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskCompletedEvent,
        handler: handlers.onTaskCompleted.bind(handlers)
      }
    ];

    const expect = await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleComplete.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z'),
        new TaskAssignedEvent('task-1', 'Alice', '2024-01-01T01:00:00Z'),
        new TaskStartedEvent('task-1', '2024-01-01T02:00:00Z')
      )
      .when(new CompleteTaskCommand('task-1'));

    expect
      .expectSuccessfulExecution()
      .expectEventCount(1);

    const events = expect.getCapturedEvents();
    const completedEvent = events[0] as TaskCompletedEvent;

    if (completedEvent.taskId !== 'task-1') {
      throw new Error('Task ID mismatch');
    }
  });

  it('should fail to complete a task that has not been started', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, CompleteTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskAssignedEvent,
        handler: handlers.onTaskAssigned.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskCompletedEvent,
        handler: handlers.onTaskCompleted.bind(handlers)
      }
    ];

    await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleComplete.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z'),
        new TaskAssignedEvent('task-1', 'Alice', '2024-01-01T01:00:00Z')
      )
      .when(new CompleteTaskCommand('task-1'))
      .then(expect => {
        expect
          .expectFailure('must be started')
          .expectNoEvents();
      });
  });

  it('should fail to reassign a completed task', async () => {
    const fixture = CommandHandlingTestFixture.create<Task, AssignTaskCommand, void>();

    const stateRebuildingHandlers = [
      {
        instanceClass: Task,
        eventClass: TaskCreatedEvent,
        handler: handlers.onTaskCreated.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskAssignedEvent,
        handler: handlers.onTaskAssigned.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskStartedEvent,
        handler: handlers.onTaskStarted.bind(handlers)
      },
      {
        instanceClass: Task,
        eventClass: TaskCompletedEvent,
        handler: handlers.onTaskCompleted.bind(handlers)
      }
    ];

    await fixture
      .withStateRebuildingHandlers(stateRebuildingHandlers)
      .using(Task, handlers.handleAssign.bind(handlers))
      .given()
      .givenEvents(
        new TaskCreatedEvent('task-1', 'Implement login feature', 'Add user authentication', '2024-01-01T00:00:00Z'),
        new TaskAssignedEvent('task-1', 'Alice', '2024-01-01T01:00:00Z'),
        new TaskStartedEvent('task-1', '2024-01-01T02:00:00Z'),
        new TaskCompletedEvent('task-1', '2024-01-01T03:00:00Z')
      )
      .when(new AssignTaskCommand('task-1', 'Bob'))
      .then(expect => {
        expect
          .expectFailure('already completed')
          .expectNoEvents();
      });
  });
});
