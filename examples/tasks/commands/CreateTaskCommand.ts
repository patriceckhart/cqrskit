import { Command, SubjectCondition } from '../../../src';

/**
 * Command to create a new task
 */
export class CreateTaskCommand implements Command {
  constructor(
    public taskId: string,
    public title: string,
    public description: string
  ) {}

  getSubject(): string {
    return `/task/${this.taskId}`;
  }

  getSubjectCondition(): SubjectCondition {
    return SubjectCondition.NEW; // Task must not exist yet
  }
}
