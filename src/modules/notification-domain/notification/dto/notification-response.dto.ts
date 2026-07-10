import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../enums/notification-type.enum';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { NotificationStatus } from '../../enums/notification-status.enum';

/**
 * NotificationResponseDto
 *
 * Safe notification data for API responses.
 */
@Exclude()
export class NotificationResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Notification ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Recipient user ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @Expose()
  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.TASK_ASSIGNED,
  })
  type: NotificationType;

  @Expose()
  @ApiProperty({
    description: 'Notification title',
    example: 'You have been assigned to a task',
  })
  title: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Notification message',
    example: 'John Doe has assigned you to the task "Fix login bug"',
  })
  message: string | null;

  @Expose()
  @ApiProperty({
    description: 'Delivery channel',
    enum: NotificationChannel,
    example: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Expose()
  @ApiProperty({
    description: 'Notification status',
    enum: NotificationStatus,
    example: NotificationStatus.SENT,
  })
  status: NotificationStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { taskId: '550e8400-e29b-41d4-a716-446655440010' },
  })
  metadata: Record<string, any> | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Timestamp when notification was read',
    example: '2026-07-08T10:30:00Z',
  })
  readAt: Date | null;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-07-08T09:00:00Z',
  })
  createdAt: Date;
}
