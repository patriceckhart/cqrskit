import { TaskCreatedEvent } from '../events/TaskCreatedEvent';
import { TaskAssignedEvent } from '../events/TaskAssignedEvent';
import { TaskStartedEvent } from '../events/TaskStartedEvent';
import { TaskCompletedEvent } from '../events/TaskCompletedEvent';

/**
 * In-memory task list for demo purposes
 * In a real application, this would be a database
 */
interface TaskListEntry {
  id: string;
  title: string;
  description: string;
  assignee: string | null;
  status: string;
  createdAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Projector that maintains a read model (list) of all tasks
 */
export class TaskListProjector {
  private tasks: Map<string, TaskListEntry> = new Map();

  /**
   * Handle task created event
   */
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    console.log(`[TaskList] Task created: ${event.title}`);

    this.tasks.set(event.taskId, {
      id: event.taskId,
      title: event.title,
      description: event.description,
      assignee: null,
      status: 'TODO',
      createdAt: event.createdAt
    });
  }

  /**
   * Handle task assigned event
   */
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    const task = this.tasks.get(event.taskId);
    if (!task) {
      console.warn(`[TaskList] Task ${event.taskId} not found`);
      return;
    }

    console.log(`[TaskList] Task assigned: ${task.title} -> ${event.assignee}`);

    task.assignee = event.assignee;
    task.assignedAt = event.assignedAt;
  }

  /**
   * Handle task started event
   */
  async onTaskStarted(event: TaskStartedEvent): Promise<void> {
    const task = this.tasks.get(event.taskId);
    if (!task) {
      console.warn(`[TaskList] Task ${event.taskId} not found`);
      return;
    }

    console.log(`[TaskList] Task started: ${task.title}`);

    task.status = 'IN_PROGRESS';
    task.startedAt = event.startedAt;
  }

  /**
   * Handle task completed event
   */
  async onTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    const task = this.tasks.get(event.taskId);
    if (!task) {
      console.warn(`[TaskList] Task ${event.taskId} not found`);
      return;
    }

    console.log(`[TaskList] Task completed: ${task.title}`);

    task.status = 'COMPLETED';
    task.completedAt = event.completedAt;
  }

  /**
   * Query all tasks
   */
  getAllTasks(): TaskListEntry[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): TaskListEntry | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: string): TaskListEntry[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by assignee
   */
  getTasksByAssignee(assignee: string): TaskListEntry[] {
    return Array.from(this.tasks.values()).filter(task => task.assignee === assignee);
  }
}
