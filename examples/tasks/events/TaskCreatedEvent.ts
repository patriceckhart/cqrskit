/**
 * Event emitted when a task is created
 */
export class TaskCreatedEvent {
  constructor(
    public taskId: string,
    public title: string,
    public description: string,
    public createdAt: string
  ) {}
}
