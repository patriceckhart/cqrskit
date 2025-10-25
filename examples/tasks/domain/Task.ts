/**
 * Task aggregate
 */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export class Task {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public assignee: string | null,
    public status: TaskStatus,
    public createdAt: string,
    public completedAt: string | null = null
  ) {}
}
