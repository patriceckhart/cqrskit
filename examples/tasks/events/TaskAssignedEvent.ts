/**
 * Event emitted when a task is assigned to someone
 */
export class TaskAssignedEvent {
  constructor(
    public taskId: string,
    public assignee: string,
    public assignedAt: string
  ) {}
}
