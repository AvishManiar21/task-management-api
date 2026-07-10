import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowState } from './workflow-state.entity';
import { WorkflowTransition } from './workflow-transition.entity';

/**
 * Workflow Entity
 *
 * Defines configurable workflows with states and transitions.
 * Each workflow represents a complete state machine for task progression.
 *
 * Business Rules:
 * - Must have at least one state
 * - Must have exactly one initial state
 * - Should have at least one terminal state
 * - System workflows cannot be deleted
 * - Only one workflow can be marked as default
 *
 * @see WorkflowState
 * @see WorkflowTransition
 */
@Entity('workflow')
export class Workflow {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Workflow name (unique across system)
   * @example "Standard", "Bug Tracking", "Feature Development"
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /**
   * Workflow description
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Is this the default workflow for new tasks
   * Only one workflow can be default at a time
   */
  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean;

  /**
   * Is this a system workflow (cannot be deleted)
   */
  @Column({ type: 'boolean', default: false, name: 'is_system' })
  isSystem: boolean;

  /**
   * Creator user ID
   */
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ===========================
  // Relationships
  // ===========================

  /**
   * States in this workflow
   */
  @OneToMany(() => WorkflowState, (state) => state.workflow, {
    cascade: true,
  })
  states: WorkflowState[];

  /**
   * Transitions in this workflow
   */
  @OneToMany(() => WorkflowTransition, (transition) => transition.workflow, {
    cascade: true,
  })
  transitions: WorkflowTransition[];

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Get the initial state for this workflow
   * @returns Initial workflow state
   * @throws Error if no initial state found
   */
  getInitialState(): WorkflowState {
    const initialState = this.states?.find((state) => state.isInitial);
    if (!initialState) {
      throw new Error(`Workflow "${this.name}" has no initial state`);
    }
    return initialState;
  }

  /**
   * Get all allowed transitions from a given state
   * @param fromStateId - Source state ID
   * @returns Array of allowed transitions
   */
  getAllowedTransitions(fromStateId: string): WorkflowTransition[] {
    if (!this.transitions) {
      return [];
    }
    return this.transitions.filter((t) => t.fromStateId === fromStateId);
  }

  /**
   * Check if a transition is allowed from one state to another
   * @param fromStateId - Source state ID
   * @param toStateId - Target state ID
   * @returns true if transition is allowed
   */
  canTransition(fromStateId: string, toStateId: string): boolean {
    if (!this.transitions) {
      return false;
    }
    return this.transitions.some(
      (t) => t.fromStateId === fromStateId && t.toStateId === toStateId,
    );
  }

  /**
   * Get a state by its ID
   * @param stateId - State ID
   * @returns Workflow state
   * @throws Error if state not found
   */
  getStateById(stateId: string): WorkflowState {
    const state = this.states?.find((s) => s.id === stateId);
    if (!state) {
      throw new Error(`State "${stateId}" not found in workflow "${this.name}"`);
    }
    return state;
  }

  /**
   * Validate workflow completeness
   * Checks:
   * - Has at least one state
   * - Has exactly one initial state
   * - Has at least one terminal state
   * - All states are reachable from initial state
   *
   * @returns Validation result
   */
  validateCompleteness(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check has states
    if (!this.states || this.states.length === 0) {
      errors.push('Workflow must have at least one state');
      return { valid: false, errors };
    }

    // Check initial state count
    const initialStates = this.states.filter((s) => s.isInitial);
    if (initialStates.length === 0) {
      errors.push('Workflow must have exactly one initial state');
    } else if (initialStates.length > 1) {
      errors.push('Workflow cannot have more than one initial state');
    }

    // Check terminal state count
    const terminalStates = this.states.filter((s) => s.isTerminal);
    if (terminalStates.length === 0) {
      errors.push('Workflow should have at least one terminal state');
    }

    // Check all states are reachable (basic check)
    if (this.transitions && this.transitions.length > 0) {
      const reachableStateIds = new Set<string>();
      if (initialStates.length > 0) {
        reachableStateIds.add(initialStates[0].id);
      }

      let previousSize = 0;
      while (reachableStateIds.size > previousSize) {
        previousSize = reachableStateIds.size;
        this.transitions.forEach((transition) => {
          if (reachableStateIds.has(transition.fromStateId)) {
            reachableStateIds.add(transition.toStateId);
          }
        });
      }

      const unreachableStates = this.states.filter(
        (state) => !reachableStateIds.has(state.id) && !state.isInitial,
      );

      if (unreachableStates.length > 0) {
        errors.push(
          `Unreachable states: ${unreachableStates.map((s) => s.name).join(', ')}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all terminal states
   * @returns Array of terminal workflow states
   */
  getTerminalStates(): WorkflowState[] {
    if (!this.states) {
      return [];
    }
    return this.states.filter((s) => s.isTerminal);
  }
}
