/**
 * NotificationType Enum
 *
 * Defines types of notifications that can be sent to users.
 *
 * Types:
 * - TASK_ASSIGNED: User is assigned to a task
 * - TASK_DUE_SOON: Task due date is approaching (within 24 hours)
 * - TASK_OVERDUE: Task has passed due date
 * - TASK_COMPLETED: Task has been marked as complete
 * - TASK_STATE_CHANGED: Task workflow state has changed
 * - COMMENT_ADDED: New comment added to a task
 * - MENTION_IN_COMMENT: User is mentioned in a comment
 */
export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_STATE_CHANGED = 'TASK_STATE_CHANGED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  MENTION_IN_COMMENT = 'MENTION_IN_COMMENT',
}
