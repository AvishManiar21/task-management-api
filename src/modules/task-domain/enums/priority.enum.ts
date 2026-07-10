/**
 * Task Priority Levels
 *
 * Defines the priority classification for tasks.
 * Used in task creation, filtering, and sorting.
 */
export enum Priority {
  /**
   * Low priority - can be done when time permits
   */
  LOW = 'LOW',

  /**
   * Medium priority - standard priority level (default)
   */
  MEDIUM = 'MEDIUM',

  /**
   * High priority - should be prioritized
   */
  HIGH = 'HIGH',

  /**
   * Urgent priority - requires immediate attention
   */
  URGENT = 'URGENT',
}
