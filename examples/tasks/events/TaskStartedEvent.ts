/**
 * Event emitted when work starts on a task
 */
export class TaskStartedEvent {
  constructor(
    public taskId: string,
    public startedAt: string
  ) {}
}
