import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Workflow } from './workflow.entity';

/**
 * WorkflowState Entity
 *
 * Represents a state within a workflow.
 * Each state represents a stage in the task lifecycle.
 *
 * Business Rules:
 * - Each workflow must have exactly one initial state
 * - Each workflow should have at least one terminal state
 * - State names must be unique within a workflow
 * - State order must be unique within a workflow
 * - Initial states cannot be terminal states (and vice versa)
 *
 * @see Workflow
 */
@Entity('workflow_state')
@Unique(['workflowId', 'name'])
@Unique(['workflowId', 'order'])
export class WorkflowState {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Parent workflow ID
   */
  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId: string;

  /**
   * State name (unique within workflow)
   * @example "TODO", "IN_PROGRESS", "DONE"
   */
  @Column({ type: 'varchar', length: 50 })
  name: string;

  /**
   * State description
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Display color (hex format)
   * @example "#3B82F6", "#10B981", "#EF4444"
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string;

  /**
   * Display order (unique within workflow)
   * Lower values appear first
   */
  @Column({ type: 'integer' })
  order: number;

  /**
   * Is this the initial state for the workflow
   * Only one state per workflow can be initial
   */
  @Column({ type: 'boolean', default: false, name: 'is_initial' })
  isInitial: boolean;

  /**
   * Is this a terminal state (end state)
   * Terminal states typically represent completion or cancellation
   */
  @Column({ type: 'boolean', default: false, name: 'is_terminal' })
  isTerminal: boolean;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ===========================
  // Relationships
  // ===========================

  /**
   * Parent workflow
   */
  @ManyToOne(() => Workflow, (workflow) => workflow.states, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if tasks can be created directly in this state
   * Typically only initial states allow direct creation
   *
   * @returns true if tasks can be created in this state
   */
  canCreateTasksInThisState(): boolean {
    return this.isInitial;
  }

  /**
   * Check if this state is final (no outgoing transitions)
   *
   * @returns true if this is a terminal state
   */
  isFinalState(): boolean {
    return this.isTerminal;
  }

  /**
   * Validate state configuration
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!this.name || this.name.trim().length === 0) {
      errors.push('State name is required');
    }

    if (this.name && this.name.length > 50) {
      errors.push('State name cannot exceed 50 characters');
    }

    // Order validation
    if (this.order === undefined || this.order === null) {
      errors.push('State order is required');
    }

    if (this.order < 0) {
      errors.push('State order must be non-negative');
    }

    // Color validation (if provided)
    if (this.color && !/^#[0-9A-Fa-f]{6}$/.test(this.color)) {
      errors.push('Color must be a valid hex color (e.g., #3B82F6)');
    }

    // Logic validation
    if (this.isInitial && this.isTerminal) {
      errors.push('A state cannot be both initial and terminal');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
