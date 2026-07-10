import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notification.entity';
import { NotificationLog } from '../../log/notification-log.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationFilterDto } from '../dto/notification-filter.dto';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { NotificationChannel } from '../../enums/notification-channel.enum';

/**
 * NotificationService
 *
 * Core business logic for notification management.
 *
 * Features:
 * - Send notifications through multiple channels
 * - Track notification delivery status
 * - Mark notifications as read (IN_APP only)
 * - Query user notifications with filtering
 * - Get unread notification counts
 *
 * Business Rules:
 * - Only IN_APP notifications can be marked as read
 * - Users can only access their own notifications
 * - Create delivery logs for tracking
 *
 * @see Notification
 * @see NotificationLog
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  /**
   * Send a notification
   *
   * Steps:
   * 1. Create notification record
   * 2. Create delivery log
   * 3. Return created notification
   *
   * @param dto - Notification data
   * @param userId - User ID creating the notification (can be system)
   * @returns Created notification
   */
  async send(dto: CreateNotificationDto, userId?: string): Promise<Notification> {
    // Create notification
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message || '',
      channel: dto.channel,
      status: NotificationStatus.PENDING,
      metadata: dto.metadata || null,
      readAt: null,
    });

    await this.notificationRepo.save(notification);

    // Create delivery log
    const log = this.logRepo.create({
      notificationId: notification.id,
      status: NotificationStatus.PENDING,
      attempts: 0,
      lastAttemptAt: null,
      errorMessage: null,
    });

    await this.logRepo.save(log);

    return notification;
  }

  /**
   * Mark notification as read (IN_APP only)
   *
   * @param id - Notification ID
   * @param userId - User ID (for authorization)
   * @returns Updated notification
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ where: { id } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    // Check ownership
    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }

    // Check channel
    if (notification.channel !== NotificationChannel.IN_APP) {
      throw new BadRequestException('Only IN_APP notifications can be marked as read');
    }

    // Mark as read
    notification.markAsRead();
    await this.notificationRepo.save(notification);

    return notification;
  }

  /**
   * Get user's notifications with filtering
   *
   * @param userId - User ID
   * @param filter - Filter options
   * @returns Paginated notifications
   */
  async getUserNotifications(
    userId: string,
    filter: NotificationFilterDto,
  ): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId });

    // Apply filters
    if (filter.type) {
      queryBuilder.andWhere('notification.type = :type', { type: filter.type });
    }

    if (filter.channel) {
      queryBuilder.andWhere('notification.channel = :channel', { channel: filter.channel });
    }

    if (filter.status) {
      queryBuilder.andWhere('notification.status = :status', { status: filter.status });
    }

    if (filter.unreadOnly) {
      queryBuilder.andWhere('notification.read_at IS NULL');
      queryBuilder.andWhere('notification.channel = :inAppChannel', {
        inAppChannel: NotificationChannel.IN_APP,
      });
    }

    // Pagination
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('notification.created_at', 'DESC').skip(skip).take(limit);

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      notifications,
      total,
      page,
      limit,
    };
  }

  /**
   * Get unread notification count for a user
   *
   * @param userId - User ID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.channel = :channel', { channel: NotificationChannel.IN_APP })
      .andWhere('notification.read_at IS NULL')
      .getCount();
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - User ID
   * @returns Number of notifications marked as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({
        readAt: new Date(),
        status: NotificationStatus.READ,
      })
      .where('user_id = :userId', { userId })
      .andWhere('channel = :channel', { channel: NotificationChannel.IN_APP })
      .andWhere('read_at IS NULL')
      .execute();

    return result.affected || 0;
  }

  /**
   * Delete a notification
   *
   * @param id - Notification ID
   * @param userId - User ID (for authorization)
   */
  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({ where: { id } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    // Check ownership
    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only delete your own notifications');
    }

    await this.notificationRepo.remove(notification);
  }

  /**
   * Update notification delivery status
   * Called by delivery handlers (email service, push service, etc.)
   *
   * @param notificationId - Notification ID
   * @param status - New status
   * @param error - Error message (if failed)
   */
  async updateDeliveryStatus(
    notificationId: string,
    status: NotificationStatus,
    error?: string,
  ): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    notification.status = status;
    await this.notificationRepo.save(notification);

    // Update log
    const log = await this.logRepo.findOne({
      where: { notificationId },
      order: { createdAt: 'DESC' },
    });

    if (log) {
      if (status === NotificationStatus.FAILED && error) {
        log.recordAttempt(false, error);
      } else if (
        status === NotificationStatus.DELIVERED ||
        status === NotificationStatus.SENT
      ) {
        if (status === NotificationStatus.SENT) {
          log.markAsSent();
        } else {
          log.recordAttempt(true);
        }
      }

      await this.logRepo.save(log);
    }
  }
}
