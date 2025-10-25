/**
 * Event emitted when a task is completed
 */
export class TaskCompletedEvent {
  constructor(
    public taskId: string,
    public completedAt: string
  ) {}
}
