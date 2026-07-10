import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Task } from '../task/task.entity';
import { ChangeType } from '../enums/change-type.enum';

/**
 * TaskHistory Entity
 *
 * Complete audit trail of task changes with field-level granularity.
 * Captures all modifications to tasks for compliance, debugging, and analytics.
 *
 * Change Types:
 * - CREATE: Task created (captures full task state)
 * - UPDATE: Field updated (captures old/new values)
 * - DELETE: Task soft-deleted (captures deletion timestamp)
 * - TRANSITION: Workflow state changed (captures state transition)
 *
 * Business Rules:
 * - Indefinite retention (never deleted)
 * - Immutable records (no updates allowed)
 * - Field-level change tracking
 * - Complete reconstruction capability (replay changes to get state at any point in time)
 * - Partitioned by month for performance
 *
 * Use Cases:
 * - Compliance audits
 * - Change history visualization
 * - Rollback/undo functionality
 * - Analytics on task modifications
 * - Debugging data inconsistencies
 *
 * @see Task
 */
@Entity('task_history')
@Index(['taskId', 'changedAt'])
@Index(['changedBy', 'changedAt'])
export class TaskHistory {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Task being audited
   */
  @Column({ type: 'uuid', name: 'task_id' })
  @Index()
  taskId: string;

  /**
   * Type of change
   */
  @Column({ type: 'enum', enum: ChangeType })
  @Index()
  changeType: ChangeType;

  /**
   * Field name that changed
   * Null for CREATE (entire task), DELETE (deletedAt field handled separately)
   *
   * @example "title", "priority", "assigneeId", "currentStateId"
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'field_name' })
  @Index()
  fieldName: string | null;

  /**
   * Previous value (before change)
   * Stored as JSONB for flexibility
   * Null for CREATE operations
   *
   * @example { "value": "TODO" }
   * @example { "value": "Bug in login" }
   */
  @Column({ type: 'jsonb', nullable: true, name: 'old_value' })
  oldValue: any;

  /**
   * New value (after change)
   * Stored as JSONB for flexibility
   * For CREATE, contains full task snapshot
   *
   * @example { "value": "IN_PROGRESS" }
   * @example { "value": "Fix bug in login form" }
   */
  @Column({ type: 'jsonb', nullable: true, name: 'new_value' })
  newValue: any;

  /**
   * User who made the change
   */
  @Column({ type: 'uuid', name: 'changed_by' })
  @Index()
  changedBy: string;

  /**
   * Change timestamp (immutable)
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'changed_at' })
  @Index()
  changedAt: Date;

  /**
   * Additional metadata (JSONB)
   * Can store contextual information like:
   * - IP address
   * - User agent
   * - Request ID
   * - Business reason for change
   *
   * @example
   * {
   *   "ipAddress": "192.168.1.1",
   *   "userAgent": "Mozilla/5.0...",
   *   "requestId": "abc-123-def",
   *   "comment": "Urgent priority change requested by manager"
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // ===========================
  // Relationships
  // ===========================

  /**
   * Task being audited
   */
  @ManyToOne(() => Task, {
    onDelete: 'CASCADE', // History is deleted if task is permanently deleted
  })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if this is a creation record
   * @returns true if change type is CREATE
   */
  isCreation(): boolean {
    return this.changeType === ChangeType.CREATE;
  }

  /**
   * Check if this is an update record
   * @returns true if change type is UPDATE
   */
  isUpdate(): boolean {
    return this.changeType === ChangeType.UPDATE;
  }

  /**
   * Check if this is a deletion record
   * @returns true if change type is DELETE
   */
  isDeletion(): boolean {
    return this.changeType === ChangeType.DELETE;
  }

  /**
   * Check if this is a workflow transition record
   * @returns true if change type is TRANSITION
   */
  isTransition(): boolean {
    return this.changeType === ChangeType.TRANSITION;
  }

  /**
   * Get field value for display
   * Handles different value types (string, number, object, etc.)
   *
   * @param value - The value to format
   * @returns Formatted value string
   */
  getFormattedValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'object') {
      if (value.value !== undefined) {
        return String(value.value);
      }
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get human-readable change description
   * @returns Change description string
   */
  getChangeDescription(): string {
    switch (this.changeType) {
      case ChangeType.CREATE:
        return 'Task created';

      case ChangeType.DELETE:
        return 'Task deleted';

      case ChangeType.TRANSITION:
        const oldState = this.getFormattedValue(this.oldValue);
        const newState = this.getFormattedValue(this.newValue);
        return `Workflow state changed from "${oldState}" to "${newState}"`;

      case ChangeType.UPDATE:
        if (!this.fieldName) {
          return 'Task updated';
        }
        const oldVal = this.getFormattedValue(this.oldValue);
        const newVal = this.getFormattedValue(this.newValue);
        return `Field "${this.fieldName}" changed from "${oldVal}" to "${newVal}"`;

      default:
        return 'Unknown change';
    }
  }

  /**
   * Check if this change affected a specific field
   *
   * @param fieldName - Field name to check
   * @returns true if this record tracks that field
   */
  affectsField(fieldName: string): boolean {
    return this.fieldName === fieldName;
  }

  /**
   * Validate history record
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Task ID validation
    if (!this.taskId) {
      errors.push('Task ID is required');
    }

    // Change type validation
    if (!Object.values(ChangeType).includes(this.changeType)) {
      errors.push('Invalid change type');
    }

    // Changed by validation
    if (!this.changedBy) {
      errors.push('Changed by user ID is required');
    }

    // Field-specific validation
    if (this.changeType === ChangeType.UPDATE) {
      if (!this.fieldName) {
        errors.push('Field name is required for UPDATE change type');
      }
    }

    if (this.changeType === ChangeType.CREATE) {
      if (this.oldValue !== null && this.oldValue !== undefined) {
        errors.push('Old value should be null for CREATE change type');
      }
      if (!this.newValue) {
        errors.push('New value is required for CREATE change type');
      }
    }

    // Field name length validation
    if (this.fieldName && this.fieldName.length > 100) {
      errors.push('Field name cannot exceed 100 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a CREATE change record
   *
   * @param taskId - Task ID
   * @param taskSnapshot - Complete task state
   * @param userId - User creating the task
   * @returns TaskHistory instance
   */
  static createCreationRecord(taskId: string, taskSnapshot: any, userId: string): TaskHistory {
    const history = new TaskHistory();
    history.taskId = taskId;
    history.changeType = ChangeType.CREATE;
    history.fieldName = null;
    history.oldValue = null;
    history.newValue = taskSnapshot;
    history.changedBy = userId;
    return history;
  }

  /**
   * Create an UPDATE change record
   *
   * @param taskId - Task ID
   * @param fieldName - Field that changed
   * @param oldValue - Previous value
   * @param newValue - New value
   * @param userId - User making the change
   * @returns TaskHistory instance
   */
  static createUpdateRecord(
    taskId: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    userId: string,
  ): TaskHistory {
    const history = new TaskHistory();
    history.taskId = taskId;
    history.changeType = ChangeType.UPDATE;
    history.fieldName = fieldName;
    history.oldValue = { value: oldValue };
    history.newValue = { value: newValue };
    history.changedBy = userId;
    return history;
  }

  /**
   * Create a TRANSITION change record
   *
   * @param taskId - Task ID
   * @param oldStateId - Previous workflow state ID
   * @param newStateId - New workflow state ID
   * @param userId - User making the transition
   * @returns TaskHistory instance
   */
  static createTransitionRecord(
    taskId: string,
    oldStateId: string,
    newStateId: string,
    userId: string,
  ): TaskHistory {
    const history = new TaskHistory();
    history.taskId = taskId;
    history.changeType = ChangeType.TRANSITION;
    history.fieldName = 'currentStateId';
    history.oldValue = { value: oldStateId };
    history.newValue = { value: newStateId };
    history.changedBy = userId;
    return history;
  }

  /**
   * Create a DELETE change record
   *
   * @param taskId - Task ID
   * @param userId - User deleting the task
   * @returns TaskHistory instance
   */
  static createDeletionRecord(taskId: string, userId: string): TaskHistory {
    const history = new TaskHistory();
    history.taskId = taskId;
    history.changeType = ChangeType.DELETE;
    history.fieldName = 'deletedAt';
    history.oldValue = { value: null };
    history.newValue = { value: new Date() };
    history.changedBy = userId;
    return history;
  }
}
