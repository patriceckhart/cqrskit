import { Command, SubjectCondition } from '../../../src';

/**
 * Command to assign a task to someone
 */
export class AssignTaskCommand implements Command {
  constructor(
    public taskId: string,
    public assignee: string
  ) {}

  getSubject(): string {
    return `/task/${this.taskId}`;
  }

  getSubjectCondition(): SubjectCondition {
    return SubjectCondition.EXISTS; // Task must exist
  }
}
