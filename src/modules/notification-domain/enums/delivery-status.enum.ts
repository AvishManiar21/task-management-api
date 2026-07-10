/**
 * DeliveryStatus Enum
 *
 * Defines the delivery status of a notification through a specific channel.
 *
 * Statuses:
 * - PENDING: Notification queued for delivery
 * - SENT: Notification sent to delivery service
 * - DELIVERED: Notification successfully delivered
 * - FAILED: Notification delivery failed (with error details)
 */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}
