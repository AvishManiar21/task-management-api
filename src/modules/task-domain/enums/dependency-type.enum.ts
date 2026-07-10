/**
 * Task Dependency Type
 *
 * Defines the relationship type between dependent tasks.
 */
export enum DependencyType {
  /**
   * This task blocks another task
   * The dependent task cannot start/complete until this task is done
   */
  BLOCKS = 'BLOCKS',

  /**
   * This task is blocked by another task
   * This task cannot start/complete until the blocking task is done
   */
  BLOCKED_BY = 'BLOCKED_BY',
}
