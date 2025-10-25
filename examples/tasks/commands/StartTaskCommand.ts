import { Command, SubjectCondition } from '../../../src';

/**
 * Command to start working on a task
 */
export class StartTaskCommand implements Command {
  constructor(public taskId: string) {}

  getSubject(): string {
    return `/task/${this.taskId}`;
  }

  getSubjectCondition(): SubjectCondition {
    return SubjectCondition.EXISTS; // Task must exist
  }
}
