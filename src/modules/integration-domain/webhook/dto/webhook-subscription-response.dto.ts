import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../../enums/event-type.enum';

/**
 * WebhookSubscriptionResponseDto
 *
 * Safe webhook subscription data for API responses.
 *
 * Excludes:
 * - secret (never exposed after creation)
 *
 * Includes:
 * - All public subscription data
 * - Delivery statistics (can be added later)
 *
 * @see WebhookSubscription
 */
@Exclude()
export class WebhookSubscriptionResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Webhook subscription ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Target webhook URL',
    example: 'https://api.example.com/webhooks/task-management',
  })
  url: string;

  @Expose()
  @ApiProperty({
    description: 'Subscribed event types',
    example: [EventType.TASK_CREATED, EventType.TASK_UPDATED],
    enum: EventType,
    isArray: true,
  })
  events: EventType[];

  @Expose()
  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: 'Optional description',
    example: 'Production webhook for task notifications',
  })
  description: string | null;

  @Expose()
  @ApiProperty({
    description: 'User who created this subscription',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy: string;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-07-08T10:30:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-07-08T15:45:00Z',
  })
  updatedAt: Date;

  // Excluded fields:
  // - secret (security: never exposed after creation)
}
