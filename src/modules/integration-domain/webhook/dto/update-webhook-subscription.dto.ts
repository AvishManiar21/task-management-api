import { IsUrl, IsArray, IsEnum, IsOptional, IsString, IsBoolean, MaxLength, ArrayMinSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../../enums/event-type.enum';

/**
 * UpdateWebhookSubscriptionDto
 *
 * DTO for updating an existing webhook subscription.
 *
 * All fields are optional - only provided fields will be updated.
 *
 * Validation Rules:
 * - URL must be valid HTTPS if provided
 * - At least one event type if events array provided
 * - Description max 500 characters if provided
 *
 * @see WebhookSubscription
 */
export class UpdateWebhookSubscriptionDto {
  /**
   * Target webhook URL (HTTPS only)
   */
  @ApiPropertyOptional({
    description: 'Target webhook URL (must be HTTPS)',
    example: 'https://api.example.com/webhooks/task-management-v2',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  /**
   * Subscribed event types
   */
  @ApiPropertyOptional({
    description: 'Array of event types to subscribe to',
    example: [EventType.TASK_CREATED, EventType.TASK_UPDATED],
    enum: EventType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one event type is required' })
  @IsEnum(EventType, { each: true, message: 'Each event must be a valid EventType' })
  events?: EventType[];

  /**
   * Active status
   */
  @ApiPropertyOptional({
    description: 'Active status - set to false to temporarily disable webhook',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Optional description
   */
  @ApiPropertyOptional({
    description: 'Optional description for this webhook subscription',
    example: 'Updated webhook configuration',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;
}
