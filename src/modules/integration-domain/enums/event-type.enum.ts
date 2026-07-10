/**
 * EventType Enum
 *
 * Defines all event types that can be published by the Task Management system.
 *
 * Event Format: <entity>.<action>
 *
 * Categories:
 * - Task Events: task.created, task.updated, task.deleted, task.assigned, task.completed, task.state_changed
 * - Comment Events: comment.created, comment.updated, comment.deleted
 * - User Events: user.created, user.updated, user.deleted
 * - Team Events: team.created, team.updated
 * - Workflow Events: workflow.created, workflow.updated
 *
 * Usage:
 * - External systems can subscribe to specific event types
 * - Webhooks are triggered when subscribed events occur
 * - Events are logged in IntegrationEvent entity for audit trail
 */
export enum EventType {
  // Task Events
  /**
   * Fired when a new task is created
   * Payload: { id, title, description, priority, creatorId, workflowId, createdAt }
   */
  TASK_CREATED = 'task.created',

  /**
   * Fired when a task is updated (title, description, priority, etc.)
   * Payload: { id, changes: {...}, updatedBy, updatedAt }
   */
  TASK_UPDATED = 'task.updated',

  /**
   * Fired when a task is soft-deleted
   * Payload: { id, deletedBy, deletedAt }
   */
  TASK_DELETED = 'task.deleted',

  /**
   * Fired when a task is assigned to a user
   * Payload: { id, assigneeId, assignedBy, assignedAt }
   */
  TASK_ASSIGNED = 'task.assigned',

  /**
   * Fired when a task is marked as completed
   * Payload: { id, completedBy, completedAt }
   */
  TASK_COMPLETED = 'task.completed',

  /**
   * Fired when a task transitions to a different workflow state
   * Payload: { id, fromStateId, toStateId, transitionedBy, transitionedAt }
   */
  TASK_STATE_CHANGED = 'task.state_changed',

  // Comment Events
  /**
   * Fired when a comment is added to a task
   * Payload: { id, taskId, content, authorId, createdAt }
   */
  COMMENT_CREATED = 'comment.created',

  /**
   * Fired when a comment is edited
   * Payload: { id, taskId, content, updatedBy, updatedAt }
   */
  COMMENT_UPDATED = 'comment.updated',

  /**
   * Fired when a comment is deleted
   * Payload: { id, taskId, deletedBy, deletedAt }
   */
  COMMENT_DELETED = 'comment.deleted',

  // User Events
  /**
   * Fired when a new user is registered
   * Payload: { id, email, name, createdAt }
   */
  USER_CREATED = 'user.created',

  /**
   * Fired when a user profile is updated
   * Payload: { id, changes: {...}, updatedAt }
   */
  USER_UPDATED = 'user.updated',

  /**
   * Fired when a user is deactivated or deleted
   * Payload: { id, deletedBy, deletedAt }
   */
  USER_DELETED = 'user.deleted',

  // Team Events
  /**
   * Fired when a new team is created
   * Payload: { id, name, createdBy, createdAt }
   */
  TEAM_CREATED = 'team.created',

  /**
   * Fired when a team is updated
   * Payload: { id, changes: {...}, updatedBy, updatedAt }
   */
  TEAM_UPDATED = 'team.updated',

  // Workflow Events
  /**
   * Fired when a new workflow is created
   * Payload: { id, name, states: [...], createdBy, createdAt }
   */
  WORKFLOW_CREATED = 'workflow.created',

  /**
   * Fired when a workflow is updated
   * Payload: { id, changes: {...}, updatedBy, updatedAt }
   */
  WORKFLOW_UPDATED = 'workflow.updated',
}
