/**
 * NotificationStatus Enum
 *
 * Defines the status of a notification in its lifecycle.
 *
 * Statuses:
 * - PENDING: Notification queued for delivery
 * - SENT: Notification sent to delivery service
 * - DELIVERED: Notification successfully delivered
 * - FAILED: Notification delivery failed
 * - READ: Notification has been read by user (IN_APP only)
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}
