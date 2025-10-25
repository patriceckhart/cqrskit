import { Command, SubjectCondition } from '../../../src';

/**
 * Command to complete a task
 */
export class CompleteTaskCommand implements Command {
  constructor(public taskId: string) {}

  getSubject(): string {
    return `/task/${this.taskId}`;
  }

  getSubjectCondition(): SubjectCondition {
    return SubjectCondition.EXISTS; // Task must exist
  }
}
