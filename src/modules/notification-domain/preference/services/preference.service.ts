import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../notification-preference.entity';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { NotificationChannel } from '../../enums/notification-channel.enum';

/**
 * PreferenceService
 *
 * Manages user notification preferences.
 *
 * Features:
 * - Get user preferences (create default if not exists)
 * - Update user preferences
 * - Check if notifications are enabled for specific event types and channels
 *
 * Business Rules:
 * - Each user has one preference record
 * - Default: email and in-app enabled for all event types
 * - enabledEventTypes is an array of NotificationType strings
 *
 * @see NotificationPreference
 */
@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
  ) {}

  /**
   * Get user notification preferences
   * Creates default preferences if they don't exist
   *
   * @param userId - User ID
   * @returns User preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreference> {
    let preference = await this.preferenceRepo.findOne({ where: { userId } });

    if (!preference) {
      // Create default preferences
      preference = this.preferenceRepo.create({
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        enabledEventTypes: [
          'TASK_ASSIGNED',
          'TASK_DUE_SOON',
          'TASK_OVERDUE',
          'TASK_COMPLETED',
          'TASK_STATE_CHANGED',
          'COMMENT_ADDED',
          'MENTION_IN_COMMENT',
        ],
      });
      await this.preferenceRepo.save(preference);
    }

    return preference;
  }

  /**
   * Update user notification preferences
   *
   * @param userId - User ID
   * @param dto - Preference updates
   * @returns Updated preferences
   */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    let preference = await this.preferenceRepo.findOne({ where: { userId } });

    if (!preference) {
      // Create new preferences if not exists
      preference = this.preferenceRepo.create({
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        enabledEventTypes: [],
      });
    }

    // Update fields
    if (dto.emailEnabled !== undefined) {
      preference.emailEnabled = dto.emailEnabled;
    }

    if (dto.inAppEnabled !== undefined) {
      preference.inAppEnabled = dto.inAppEnabled;
    }

    if (dto.enabledEventTypes !== undefined) {
      preference.enabledEventTypes = dto.enabledEventTypes;
    }

    await this.preferenceRepo.save(preference);

    return preference;
  }

  /**
   * Check if user wants notifications for a specific event type and channel
   *
   * @param userId - User ID
   * @param eventType - Event type (e.g., 'TASK_ASSIGNED')
   * @param channel - Notification channel
   * @returns true if enabled, false otherwise
   */
  async checkIfEnabled(
    userId: string,
    eventType: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.getPreferences(userId);

    // Check if channel is enabled
    if (channel === NotificationChannel.EMAIL && !preference.emailEnabled) {
      return false;
    }

    if (channel === NotificationChannel.IN_APP && !preference.inAppEnabled) {
      return false;
    }

    // Check if event type is enabled
    if (!preference.isEventTypeEnabled(eventType)) {
      return false;
    }

    return true;
  }
}
