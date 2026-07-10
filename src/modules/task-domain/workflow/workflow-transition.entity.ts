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
import { WorkflowState } from './workflow-state.entity';

/**
 * WorkflowTransition Entity
 *
 * Defines allowed transitions between workflow states with permissions.
 * Each transition represents an action that can move a task from one state to another.
 *
 * Business Rules:
 * - Transitions must be explicitly defined (no implicit transitions)
 * - Transition must belong to the same workflow as source and target states
 * - Required permissions must be checked before allowing transition
 * - Optional comment requirement enforces documentation of certain transitions
 *
 * @see Workflow
 * @see WorkflowState
 */
@Entity('workflow_transition')
@Unique(['workflowId', 'fromStateId', 'toStateId'])
export class WorkflowTransition {
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
   * Source state ID
   */
  @Column({ type: 'uuid', name: 'from_state_id' })
  fromStateId: string;

  /**
   * Target state ID
   */
  @Column({ type: 'uuid', name: 'to_state_id' })
  toStateId: string;

  /**
   * Transition name/action label
   * @example "Start Work", "Mark as Done", "Cancel", "Reopen"
   */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Required permissions to execute this transition
   * Array of permission strings that user must have
   *
   * @example ["task:update", "task:transition"]
   */
  @Column({ type: 'simple-array', nullable: true, name: 'required_permissions' })
  requiredPermissions: string[];

  /**
   * Does this transition require a comment
   * Useful for transitions like "Reject" or "Cancel" that need explanation
   */
  @Column({ type: 'boolean', default: false, name: 'requires_comment' })
  requiresComment: boolean;

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
  @ManyToOne(() => Workflow, (workflow) => workflow.transitions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  /**
   * Source state
   */
  @ManyToOne(() => WorkflowState, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'from_state_id' })
  fromState: WorkflowState;

  /**
   * Target state
   */
  @ManyToOne(() => WorkflowState, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'to_state_id' })
  toState: WorkflowState;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if a user can execute this transition
   *
   * @param userId - User attempting the transition
   * @param userPermissions - Array of user's permission strings
   * @returns true if user has required permissions
   */
  canExecute(userId: string, userPermissions: string[]): boolean {
    // If no permissions required, anyone can execute
    if (!this.requiredPermissions || this.requiredPermissions.length === 0) {
      return true;
    }

    // Check if user has all required permissions
    return this.requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  /**
   * Validate transition configuration
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Transition name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Transition name cannot exceed 100 characters');
    }

    // State validation
    if (!this.fromStateId) {
      errors.push('Source state is required');
    }

    if (!this.toStateId) {
      errors.push('Target state is required');
    }

    if (this.fromStateId === this.toStateId) {
      errors.push('Source and target states must be different');
    }

    // Workflow consistency validation
    if (this.fromState && this.toState && this.fromState.workflowId !== this.toState.workflowId) {
      errors.push('Source and target states must belong to the same workflow');
    }

    // Permission validation
    if (this.requiredPermissions) {
      this.requiredPermissions.forEach((permission, index) => {
        if (!permission || permission.trim().length === 0) {
          errors.push(`Required permission at index ${index} is empty`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if this transition requires a comment
   *
   * @returns true if comment is mandatory
   */
  needsComment(): boolean {
    return this.requiresComment;
  }
}
