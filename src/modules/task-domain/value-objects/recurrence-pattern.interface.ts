/**
 * Recurrence Pattern Value Object
 *
 * Defines the recurrence pattern for recurring tasks.
 * Stored as JSONB in the database.
 *
 * Examples:
 * - Daily: { frequency: 'DAILY', interval: 1 }
 * - Weekly on Mon/Wed/Fri: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 3, 5] }
 * - Monthly on 15th: { frequency: 'MONTHLY', interval: 1, dayOfMonth: 15 }
 * - Every 2 weeks: { frequency: 'WEEKLY', interval: 2 }
 */
export interface RecurrencePattern {
  /**
   * Frequency of recurrence
   */
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

  /**
   * Interval between occurrences
   * - DAILY: Every N days
   * - WEEKLY: Every N weeks
   * - MONTHLY: Every N months
   *
   * @minimum 1
   */
  interval: number;

  /**
   * Days of week for WEEKLY frequency
   * Array of day numbers: [0=Sunday, 1=Monday, ..., 6=Saturday]
   *
   * @optional
   * @example [1, 3, 5] // Monday, Wednesday, Friday
   */
  daysOfWeek?: number[];

  /**
   * Day of month for MONTHLY frequency
   * Value from 1 to 31
   *
   * @optional
   * @minimum 1
   * @maximum 31
   */
  dayOfMonth?: number;

  /**
   * Optional end date for the recurrence
   * No more instances will be generated after this date
   *
   * @optional
   */
  endDate?: Date;

  /**
   * Optional maximum number of occurrences
   * Stops generating instances after this many occurrences
   *
   * @optional
   * @minimum 1
   */
  occurrences?: number;
}
