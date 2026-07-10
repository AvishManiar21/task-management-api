/**
 * WebhookStatus Enum
 *
 * Represents the current status of a webhook delivery attempt.
 *
 * Lifecycle:
 * - PENDING: Webhook is queued for delivery
 * - PROCESSING: Webhook is currently being sent
 * - SUCCESS: Webhook was delivered successfully (2xx response)
 * - FAILED: Webhook failed after all retry attempts exhausted
 * - RETRYING: Webhook failed but will be retried
 */
export enum WebhookStatus {
  /**
   * Webhook is queued and waiting to be sent
   */
  PENDING = 'PENDING',

  /**
   * Webhook is currently being processed/sent
   */
  PROCESSING = 'PROCESSING',

  /**
   * Webhook was successfully delivered (2xx HTTP response)
   */
  SUCCESS = 'SUCCESS',

  /**
   * Webhook failed and will be retried
   */
  RETRYING = 'RETRYING',

  /**
   * Webhook failed permanently after all retries
   */
  FAILED = 'FAILED',
}
