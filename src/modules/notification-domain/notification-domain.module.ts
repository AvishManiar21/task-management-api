import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './notification/notification.entity';
import { NotificationPreference } from './preference/notification-preference.entity';
import { NotificationTemplate } from './template/notification-template.entity';
import { NotificationLog } from './log/notification-log.entity';

// Services
import { NotificationService } from './notification/services/notification.service';
import { PreferenceService } from './preference/services/preference.service';

// Controllers
import { NotificationController } from './notification/controllers/notification.controller';
import { PreferenceController } from './preference/controllers/preference.controller';

/**
 * NotificationDomainModule
 *
 * Notification management domain module.
 *
 * Responsibilities:
 * - Send notifications through multiple channels (email, in-app)
 * - Track notification delivery status
 * - Manage user notification preferences
 * - Provide notification history and logs
 *
 * Architecture:
 * - **Entities**: Notification, NotificationPreference, NotificationTemplate, NotificationLog (4 entities)
 * - **Services**: NotificationService, PreferenceService (2 services)
 * - **Controllers**: NotificationController, PreferenceController (2 controllers)
 *
 * Features:
 * - Multi-channel notifications (EMAIL, IN_APP)
 * - User-configurable preferences per channel and event type
 * - Delivery tracking and status management
 * - Read/unread status for in-app notifications
 * - Template support for consistent messaging
 *
 * Integration Points:
 * - User Domain: User ID references
 * - Task Domain: Task events trigger notifications
 *
 * Exports:
 * - NotificationService: For use in other domains (Task, User, etc.)
 * - PreferenceService: For checking user notification preferences
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationTemplate,
      NotificationLog,
    ]),
  ],

  controllers: [
    NotificationController,
    PreferenceController,
  ],

  providers: [
    // Services
    NotificationService,
    PreferenceService,
  ],

  exports: [
    // Export services for use in other domains
    NotificationService,
    PreferenceService,
  ],
})
export class NotificationDomainModule {}
