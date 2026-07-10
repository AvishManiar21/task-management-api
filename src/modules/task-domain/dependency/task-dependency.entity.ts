import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Task } from '../task/task.entity';
import { DependencyType } from '../enums/dependency-type.enum';

/**
 * TaskDependency Entity
 *
 * Represents dependency relationships between tasks.
 * Used to model blocking relationships where one task depends on another.
 *
 * Dependency Types:
 * - BLOCKS: The source task blocks the target task
 * - BLOCKED_BY: The source task is blocked by the target task
 *
 * Business Rules:
 * - No self-dependencies (taskId != dependsOnTaskId)
 * - No circular dependencies (detected via graph traversal)
 * - Maximum dependency depth: 10 levels
 * - Unique constraint on (taskId, dependsOnTaskId)
 *
 * Use Cases:
 * - Task A must be completed before Task B can start
 * - Complex project dependencies with critical path analysis
 * - Gantt chart visualization
 *
 * @see Task
 */
@Entity('task_dependency')
@Unique(['taskId', 'dependsOnTaskId'])
export class TaskDependency {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Dependent task ID
   * This is the task that has the dependency
   */
  @Column({ type: 'uuid', name: 'task_id' })
  @Index()
  taskId: string;

  /**
   * Task being depended on ID
   * This is the task that must be completed first
   */
  @Column({ type: 'uuid', name: 'depends_on_task_id' })
  @Index()
  dependsOnTaskId: string;

  /**
   * Dependency type
   */
  @Column({ type: 'enum', enum: DependencyType })
  dependencyType: DependencyType;

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

  // ===========================
  // Relationships
  // ===========================

  /**
   * Dependent task
   */
  @ManyToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  /**
   * Task being depended on
   */
  @ManyToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'depends_on_task_id' })
  dependsOnTask: Task;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if this dependency creates a circular reference
   * This is a simplified check - full circular detection requires graph traversal
   * Should be done in the service layer
   *
   * @param allDependencies - All task dependencies
   * @returns true if circular dependency detected
   */
  isCircular(allDependencies: TaskDependency[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        return true; // Cycle detected
      }

      if (visited.has(taskId)) {
        return false; // Already visited, no cycle from this node
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      // Find all dependencies of this task
      const dependencies = allDependencies.filter((dep) => dep.taskId === taskId);

      for (const dep of dependencies) {
        if (detectCycle(dep.dependsOnTaskId)) {
          return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    return detectCycle(this.taskId);
  }

  /**
   * Calculate dependency chain depth
   * Maximum depth allowed is 10 levels
   *
   * @param allDependencies - All task dependencies
   * @returns Depth of dependency chain
   */
  getDepth(allDependencies: TaskDependency[]): number {
    const visited = new Set<string>();

    const calculateDepth = (taskId: string, currentDepth: number): number => {
      if (currentDepth > 10) {
        return currentDepth; // Max depth exceeded
      }

      if (visited.has(taskId)) {
        return currentDepth; // Already visited
      }

      visited.add(taskId);

      // Find all tasks this task depends on
      const dependencies = allDependencies.filter((dep) => dep.taskId === taskId);

      if (dependencies.length === 0) {
        return currentDepth; // Leaf node
      }

      let maxDepth = currentDepth;
      for (const dep of dependencies) {
        const depth = calculateDepth(dep.dependsOnTaskId, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }

      return maxDepth;
    };

    return calculateDepth(this.taskId, 0);
  }

  /**
   * Check if this dependency can be deleted
   * Dependencies can always be deleted (no constraints)
   *
   * @returns true if can be deleted
   */
  canBeDeleted(): boolean {
    return true;
  }

  /**
   * Validate dependency
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!this.taskId) {
      errors.push('Task ID is required');
    }

    if (!this.dependsOnTaskId) {
      errors.push('Depends on task ID is required');
    }

    // Check for self-dependency
    if (this.taskId === this.dependsOnTaskId) {
      errors.push('Task cannot depend on itself');
    }

    // Check dependency type
    if (!Object.values(DependencyType).includes(this.dependencyType)) {
      errors.push('Invalid dependency type');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
