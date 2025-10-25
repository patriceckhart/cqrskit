import { CommandEventPublisher } from '../../../src';
import { Task, TaskStatus } from '../domain/Task';
import { CreateTaskCommand } from '../commands/CreateTaskCommand';
import { AssignTaskCommand } from '../commands/AssignTaskCommand';
import { StartTaskCommand } from '../commands/StartTaskCommand';
import { CompleteTaskCommand } from '../commands/CompleteTaskCommand';
import { TaskCreatedEvent } from '../events/TaskCreatedEvent';
import { TaskAssignedEvent } from '../events/TaskAssignedEvent';
import { TaskStartedEvent } from '../events/TaskStartedEvent';
import { TaskCompletedEvent } from '../events/TaskCompletedEvent';

/**
 * Handlers for task-related commands and state rebuilding
 */
export class TaskHandlers {
  /**
   * Handle create task command
   */
  async handleCreate(
    command: CreateTaskCommand,
    publisher: CommandEventPublisher<Task>
  ): Promise<string> {
    // Publish event
    publisher.publish(
      new TaskCreatedEvent(
        command.taskId,
        command.title,
        command.description,
        new Date().toISOString()
      )
    );

    return command.taskId;
  }

  /**
   * Handle assign task command
   */
  async handleAssign(
    task: Task,
    command: AssignTaskCommand,
    publisher: CommandEventPublisher<Task>
  ): Promise<void> {
    // Business logic validation
    if (task.status === TaskStatus.COMPLETED) {
      throw new Error(`Task ${command.taskId} is already completed and cannot be reassigned`);
    }

    // Publish event
    publisher.publish(
      new TaskAssignedEvent(
        command.taskId,
        command.assignee,
        new Date().toISOString()
      )
    );
  }

  /**
   * Handle start task command
   */
  async handleStart(
    task: Task,
    command: StartTaskCommand,
    publisher: CommandEventPublisher<Task>
  ): Promise<void> {
    // Business logic validation
    if (task.status === TaskStatus.COMPLETED) {
      throw new Error(`Task ${command.taskId} is already completed`);
    }

    if (task.status === TaskStatus.IN_PROGRESS) {
      throw new Error(`Task ${command.taskId} is already in progress`);
    }

    if (!task.assignee) {
      throw new Error(`Task ${command.taskId} must be assigned before it can be started`);
    }

    // Publish event
    publisher.publish(
      new TaskStartedEvent(command.taskId, new Date().toISOString())
    );
  }

  /**
   * Handle complete task command
   */
  async handleComplete(
    task: Task,
    command: CompleteTaskCommand,
    publisher: CommandEventPublisher<Task>
  ): Promise<void> {
    // Business logic validation
    if (task.status === TaskStatus.COMPLETED) {
      throw new Error(`Task ${command.taskId} is already completed`);
    }

    if (task.status === TaskStatus.TODO) {
      throw new Error(`Task ${command.taskId} must be started before it can be completed`);
    }

    // Publish event
    publisher.publish(
      new TaskCompletedEvent(command.taskId, new Date().toISOString())
    );
  }

  /**
   * State rebuilding: Apply TaskCreatedEvent
   */
  onTaskCreated(task: Task | null, event: TaskCreatedEvent): Task {
    return new Task(
      event.taskId,
      event.title,
      event.description,
      null, // No assignee yet
      TaskStatus.TODO,
      event.createdAt
    );
  }

  /**
   * State rebuilding: Apply TaskAssignedEvent
   */
  onTaskAssigned(task: Task, event: TaskAssignedEvent): Task {
    return new Task(
      task.id,
      task.title,
      task.description,
      event.assignee,
      task.status,
      task.createdAt,
      task.completedAt
    );
  }

  /**
   * State rebuilding: Apply TaskStartedEvent
   */
  onTaskStarted(task: Task, event: TaskStartedEvent): Task {
    return new Task(
      task.id,
      task.title,
      task.description,
      task.assignee,
      TaskStatus.IN_PROGRESS,
      task.createdAt,
      task.completedAt
    );
  }

  /**
   * State rebuilding: Apply TaskCompletedEvent
   */
  onTaskCompleted(task: Task, event: TaskCompletedEvent): Task {
    return new Task(
      task.id,
      task.title,
      task.description,
      task.assignee,
      TaskStatus.COMPLETED,
      task.createdAt,
      event.completedAt
    );
  }
}
