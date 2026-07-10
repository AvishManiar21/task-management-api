import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookStatus } from '../../enums/webhook-status.enum';
import { EventType } from '../../enums/event-type.enum';

/**
 * WebhookDeliveryResponseDto
 *
 * Safe webhook delivery data for API responses.
 *
 * Includes:
 * - All delivery attempt data
 * - Status and retry information
 * - HTTP response details
 *
 * @see WebhookDelivery
 */
@Exclude()
export class WebhookDeliveryResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Webhook delivery ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Associated webhook subscription ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  subscriptionId: string;

  @Expose()
  @ApiProperty({
    description: 'Event type that triggered this webhook',
    example: EventType.TASK_CREATED,
    enum: EventType,
  })
  eventType: EventType;

  @Expose()
  @ApiProperty({
    description: 'Webhook payload',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      event: 'task.created',
      data: { title: 'New Task', priority: 'HIGH' },
      timestamp: '2024-07-08T10:30:00Z',
    },
  })
  payload: Record<string, any>;

  @Expose()
  @ApiProperty({
    description: 'Current delivery status',
    example: WebhookStatus.SUCCESS,
    enum: WebhookStatus,
  })
  status: WebhookStatus;

  @Expose()
  @ApiProperty({
    description: 'Number of delivery attempts',
    example: 1,
  })
  attempts: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'HTTP status code from last attempt',
    example: 200,
  })
  httpStatusCode: number | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'HTTP response body from last attempt (truncated to 1KB)',
    example: '{"success": true}',
  })
  responseBody: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Error message from last attempt',
    example: null,
  })
  errorMessage: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Timestamp of next retry attempt',
    example: '2024-07-08T10:35:00Z',
  })
  nextRetryAt: Date | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Timestamp of last delivery attempt',
    example: '2024-07-08T10:30:00Z',
  })
  lastAttemptedAt: Date | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Timestamp when delivery succeeded',
    example: '2024-07-08T10:30:00Z',
  })
  deliveredAt: Date | null;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp (when webhook was queued)',
    example: '2024-07-08T10:30:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-07-08T10:30:00Z',
  })
  updatedAt: Date;
}
