import { IsUrl, IsArray, IsEnum, IsOptional, IsString, IsBoolean, MaxLength, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../../enums/event-type.enum';

/**
 * CreateWebhookSubscriptionDto
 *
 * DTO for creating a new webhook subscription.
 *
 * Validation Rules:
 * - URL must be valid HTTPS endpoint
 * - At least one event type required
 * - Description optional, max 500 characters
 *
 * @see WebhookSubscription
 */
export class CreateWebhookSubscriptionDto {
  /**
   * Target webhook URL (HTTPS only)
   */
  @ApiProperty({
    description: 'Target webhook URL (must be HTTPS)',
    example: 'https://api.example.com/webhooks/task-management',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  /**
   * Subscribed event types
   */
  @ApiProperty({
    description: 'Array of event types to subscribe to',
    example: [EventType.TASK_CREATED, EventType.TASK_UPDATED, EventType.TASK_COMPLETED],
    enum: EventType,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one event type is required' })
  @IsEnum(EventType, { each: true, message: 'Each event must be a valid EventType' })
  events: EventType[];

  /**
   * Optional description
   */
  @ApiPropertyOptional({
    description: 'Optional description for this webhook subscription',
    example: 'Production webhook for task notifications',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  /**
   * Active status (defaults to true)
   */
  @ApiPropertyOptional({
    description: 'Active status (defaults to true)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
