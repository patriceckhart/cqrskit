/**
 * Subject condition for validating aggregate state before command execution
 */
export enum SubjectCondition {
  /** No condition check required */
  NONE = 'NONE',
  /** Subject must not exist (for creation commands) */
  NEW = 'NEW',
  /** Subject must already exist (for update/delete commands) */
  EXISTS = 'EXISTS'
}

/**
 * Base interface for all commands in the system.
 * Commands are immutable instructions to change aggregate state.
 */
export interface Command {
  /**
   * Identifies the aggregate root this command targets.
   * Typically a hierarchical path like '/user/123' or '/order/456'
   */
  getSubject(): string;

  /**
   * Specifies the condition that must be met for command execution.
   * @returns SubjectCondition (defaults to NONE if not specified)
   */
  getSubjectCondition?(): SubjectCondition;
}
