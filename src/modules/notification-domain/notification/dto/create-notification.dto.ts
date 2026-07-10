import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NotificationType } from '../../enums/notification-type.enum';
import { NotificationChannel } from '../../enums/notification-channel.enum';

/**
 * DTO for creating a new notification
 */
export class CreateNotificationDto {
  @ApiProperty({
    description: 'Recipient user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.TASK_ASSIGNED,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'You have been assigned to a task',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Notification message (detailed content)',
    example: 'John Doe has assigned you to the task "Fix login bug"',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Delivery channel',
    enum: NotificationChannel,
    example: NotificationChannel.IN_APP,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { taskId: '550e8400-e29b-41d4-a716-446655440010', assignerId: '...' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
