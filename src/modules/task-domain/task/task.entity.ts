import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workflow } from '../workflow/workflow.entity';
import { WorkflowState } from '../workflow/workflow-state.entity';
import { TaskTemplate } from '../template/task-template.entity';
import { Priority } from '../enums/priority.enum';
import { RecurrencePattern } from '../value-objects/recurrence-pattern.interface';

/**
 * Task Entity
 *
 * Core entity representing a single task with all its attributes, metadata, and relationships.
 *
 * Features:
 * - Workflow-based state management
 * - Hierarchical subtasks (parent-child relationships)
 * - Task dependencies (blocking relationships)
 * - Recurring task support
 * - Custom fields (JSONB)
 * - Optimistic locking (version field)
 * - Soft deletes (deletedAt timestamp)
 * - Full audit trail (via TaskHistory)
 *
 * Business Rules (see business-rules.md for complete list):
 * - Title: 1-255 characters, required
 * - Priority: Must be valid enum value
 * - Assignee: Must be active user with permission
 * - Due date: Must be in future (for new tasks)
 * - Tags: Max 50 tags, each max 50 characters
 * - Custom fields: Max 16KB JSON
 * - Subtask depth: Max 5 levels
 * - Version: Auto-incremented on update (optimistic locking)
 *
 * @see Workflow
 * @see WorkflowState
 * @see TaskTemplate
 * @see TaskDependency
 * @see Comment
 * @see Attachment
 * @see TaskHistory
 */
@Entity('task')
export class Task {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Task title (1-255 characters)
   */
  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  /**
   * Detailed description (rich text)
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Associated workflow ID
   */
  @Column({ type: 'uuid', name: 'workflow_id' })
  @Index()
  workflowId: string;

  /**
   * Current state in workflow
   */
  @Column({ type: 'uuid', name: 'current_state_id' })
  @Index()
  currentStateId: string;

  /**
   * Task priority
   */
  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
  @Index()
  priority: Priority;

  /**
   * Assigned user ID (nullable)
   */
  @Column({ type: 'uuid', nullable: true, name: 'assignee_id' })
  @Index()
  assigneeId: string | null;

  /**
   * Task creator ID (immutable)
   */
  @Column({ type: 'uuid', name: 'creator_id' })
  @Index()
  creatorId: string;

  /**
   * Due date with timezone
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'due_date' })
  @Index()
  dueDate: Date | null;

  /**
   * Tags for categorization
   */
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  /**
   * User-defined custom fields (JSONB, max 16KB)
   */
  @Column({ type: 'jsonb', nullable: true, name: 'custom_fields' })
  customFields: Record<string, any> | null;

  /**
   * Parent task ID (for subtasks)
   */
  @Column({ type: 'uuid', nullable: true, name: 'parent_task_id' })
  @Index()
  parentTaskId: string | null;

  /**
   * Source template ID (if created from template)
   */
  @Column({ type: 'uuid', nullable: true, name: 'template_id' })
  @Index()
  templateId: string | null;

  /**
   * Is this a recurring task definition
   */
  @Column({ type: 'boolean', default: false, name: 'is_recurring' })
  @Index()
  isRecurring: boolean;

  /**
   * Recurrence pattern (JSONB)
   * Only populated if isRecurring = true
   */
  @Column({ type: 'jsonb', nullable: true, name: 'recurrence_pattern' })
  recurrencePattern: RecurrencePattern | null;

  /**
   * Recurrence source task ID
   * Points to the original recurring task if this is an instance
   */
  @Column({ type: 'uuid', nullable: true, name: 'recurrence_source_id' })
  @Index()
  recurrenceSourceId: string | null;

  /**
   * Estimated effort in hours
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'estimated_hours' })
  estimatedHours: number | null;

  /**
   * Actual effort logged in hours
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'actual_hours' })
  actualHours: number | null;

  /**
   * Completion timestamp
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  @Index()
  completedAt: Date | null;

  /**
   * Optimistic locking version
   * Auto-incremented on each update
   */
  @Column({ type: 'integer', default: 1 })
  version: number;

  /**
   * User who created this task
   */
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  /**
   * User who last updated this task
   */
  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy: string;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  @Index()
  updatedAt: Date;

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  @Index()
  deletedAt: Date | null;

  // ===========================
  // Relationships
  // ===========================

  /**
   * Associated workflow
   */
  @ManyToOne(() => Workflow)
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  /**
   * Current workflow state
   */
  @ManyToOne(() => WorkflowState)
  @JoinColumn({ name: 'current_state_id' })
  currentState: WorkflowState;

  /**
   * Parent task (for subtasks)
   */
  @ManyToOne(() => Task, (task) => task.subtasks)
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: Task;

  /**
   * Child tasks (subtasks)
   */
  @OneToMany(() => Task, (task) => task.parentTask)
  subtasks: Task[];

  /**
   * Source template (if created from template)
   */
  @ManyToOne(() => TaskTemplate)
  @JoinColumn({ name: 'template_id' })
  template: TaskTemplate;

  /**
   * Recurrence source task
   */
  @ManyToOne(() => Task)
  @JoinColumn({ name: 'recurrence_source_id' })
  recurrenceSource: Task;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if task is overdue
   * @returns true if due date has passed and task is not completed
   */
  isOverdue(): boolean {
    if (!this.dueDate || this.completedAt) {
      return false;
    }
    return new Date() > new Date(this.dueDate);
  }

  /**
   * Check if task is completed
   * @returns true if task has completion timestamp
   */
  isCompleted(): boolean {
    return this.completedAt !== null && this.completedAt !== undefined;
  }

  /**
   * Check if task can be assigned
   * @returns true if task is in a non-terminal state
   */
  canBeAssigned(): boolean {
    if (!this.currentState) {
      return true; // If state not loaded, assume assignable
    }
    return !this.currentState.isTerminal;
  }

  /**
   * Assign task to a user
   * @param userId - User ID to assign to
   */
  assignTo(userId: string): void {
    if (!this.canBeAssigned()) {
      throw new Error('Cannot assign task in terminal state');
    }
    this.assigneeId = userId;
  }

  /**
   * Unassign task
   */
  unassign(): void {
    this.assigneeId = null;
  }

  /**
   * Update task priority
   * @param priority - New priority
   */
  updatePriority(priority: Priority): void {
    if (!Object.values(Priority).includes(priority)) {
      throw new Error('Invalid priority value');
    }
    this.priority = priority;
  }

  /**
   * Add a tag to the task
   * @param tag - Tag to add
   */
  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }

    // Validate tag
    if (tag.length > 50) {
      throw new Error('Tag cannot exceed 50 characters');
    }

    // Check max tags limit
    if (this.tags.length >= 50) {
      throw new Error('Cannot add more than 50 tags');
    }

    // Add if not already present
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * Remove a tag from the task
   * @param tag - Tag to remove
   */
  removeTag(tag: string): void {
    if (!this.tags) {
      return;
    }
    this.tags = this.tags.filter((t) => t !== tag);
  }

  /**
   * Set a custom field value
   * @param key - Field key
   * @param value - Field value
   */
  setCustomField(key: string, value: any): void {
    if (!this.customFields) {
      this.customFields = {};
    }

    this.customFields[key] = value;

    // Validate size limit (16KB)
    const size = JSON.stringify(this.customFields).length;
    if (size > 16384) {
      delete this.customFields[key];
      throw new Error('Custom fields cannot exceed 16KB');
    }
  }

  /**
   * Mark task as completed
   * @param userId - User completing the task
   */
  complete(userId: string): void {
    if (this.isCompleted()) {
      throw new Error('Task is already completed');
    }

    this.completedAt = new Date();
    this.updatedBy = userId;

    // Transition to terminal state if current state is not terminal
    if (this.currentState && !this.currentState.isTerminal) {
      // Note: Actual state transition should be done through WorkflowService
      // This is a simplified version
      const terminalStates = this.workflow?.getTerminalStates();
      if (terminalStates && terminalStates.length > 0) {
        // Find a "DONE" state, or use first terminal state
        const doneState =
          terminalStates.find((s) => s.name.toUpperCase() === 'DONE') || terminalStates[0];
        this.currentStateId = doneState.id;
      }
    }
  }

  /**
   * Calculate subtask depth level
   * @returns Depth level (0 for root tasks)
   */
  getDepthLevel(): number {
    let depth = 0;
    let current: Task | null = this;

    while (current && current.parentTask) {
      depth++;
      current = current.parentTask;
      if (depth > 10) {
        // Safety check to prevent infinite loops
        throw new Error('Subtask depth exceeded maximum');
      }
    }

    return depth;
  }

  /**
   * Validate task data
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Title validation
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (this.title && this.title.length > 255) {
      errors.push('Title cannot exceed 255 characters');
    }

    // Priority validation
    if (!Object.values(Priority).includes(this.priority)) {
      errors.push('Invalid priority value');
    }

    // Tags validation
    if (this.tags) {
      if (this.tags.length > 50) {
        errors.push('Cannot have more than 50 tags');
      }

      this.tags.forEach((tag, index) => {
        if (tag.length > 50) {
          errors.push(`Tag at index ${index} exceeds 50 characters`);
        }
      });
    }

    // Custom fields size validation
    if (this.customFields) {
      const size = JSON.stringify(this.customFields).length;
      if (size > 16384) {
        errors.push('Custom fields exceed 16KB limit');
      }
    }

    // Estimated hours validation
    if (this.estimatedHours !== null && this.estimatedHours < 0) {
      errors.push('Estimated hours cannot be negative');
    }

    // Actual hours validation
    if (this.actualHours !== null && this.actualHours < 0) {
      errors.push('Actual hours cannot be negative');
    }

    // Recurrence validation
    if (this.isRecurring && !this.recurrencePattern) {
      errors.push('Recurring tasks must have a recurrence pattern');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
