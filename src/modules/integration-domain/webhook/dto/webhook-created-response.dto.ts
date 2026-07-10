import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../../enums/event-type.enum';

/**
 * WebhookCreatedResponseDto
 *
 * Response DTO for webhook subscription creation.
 *
 * SECURITY: This is the ONLY time the webhook secret is exposed.
 * After creation, secret can never be retrieved again.
 *
 * Includes:
 * - All public subscription data
 * - Secret (one-time exposure)
 *
 * @see WebhookSubscription
 */
@Exclude()
export class WebhookCreatedResponseDto {
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
    description: 'Webhook secret for HMAC-SHA256 signature verification (shown only once at creation)',
    example: 'wh_secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  secret: string;

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
}
