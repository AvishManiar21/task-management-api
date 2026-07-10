import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationFilterDto } from '../dto/notification-filter.dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@modules/user-domain/decorators/current-user.decorator';
import { User } from '@modules/user-domain/user/user.entity';

/**
 * NotificationController
 *
 * REST API endpoints for notification management.
 *
 * Endpoints:
 * - POST /api/v1/notifications - Send a notification
 * - GET /api/v1/notifications - Get user's notifications
 * - GET /api/v1/notifications/:id - Get notification by ID
 * - PUT /api/v1/notifications/:id/read - Mark notification as read
 * - PUT /api/v1/notifications/read-all - Mark all as read
 * - DELETE /api/v1/notifications/:id - Delete notification
 * - GET /api/v1/notifications/unread/count - Get unread count
 *
 * Authentication: All endpoints require JWT authentication (AuthGuard is global)
 * Authorization: Users can only access their own notifications (authenticated user from JWT)
 * User Context: All endpoints use @CurrentUser() decorator to get authenticated user
 */
@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Send a notification
   *
   * @param dto - Notification data
   * @returns Created notification
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a notification',
    description: 'Create and send a notification to a user',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification sent successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async send(@Body() dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = await this.notificationService.send(dto);
    return plainToInstance(NotificationResponseDto, notification, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get user's notifications
   *
   * @param user - Authenticated user (from JWT token)
   * @param filter - Filter options
   * @returns Paginated notifications
   */
  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Get notifications for the authenticated user with optional filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: [NotificationResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserNotifications(
    @CurrentUser() user: User,
    @Query() filter: NotificationFilterDto,
  ): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.notificationService.getUserNotifications(user.id, filter);

    return {
      notifications: result.notifications.map((notification) =>
        plainToInstance(NotificationResponseDto, notification, {
          excludeExtraneousValues: true,
        }),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Get unread notification count
   *
   * @param user - Authenticated user (from JWT token)
   * @returns Unread count
   */
  @Get('unread/count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the count of unread IN_APP notifications for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  /**
   * Get notification by ID
   *
   * @param id - Notification ID
   * @param user - Authenticated user (from JWT token)
   * @returns Notification details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Get a specific notification by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification found',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<NotificationResponseDto> {
    const result = await this.notificationService.getUserNotifications(user.id, {});
    const notification = result.notifications.find((n) => n.id === id);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return plainToInstance(NotificationResponseDto, notification, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Mark notification as read
   *
   * @param id - Notification ID
   * @param user - Authenticated user (from JWT token)
   * @returns Updated notification
   */
  @Put(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read (IN_APP only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot mark non-IN_APP notification as read' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationService.markAsRead(id, user.id);
    return plainToInstance(NotificationResponseDto, notification, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Mark all notifications as read
   *
   * @param user - Authenticated user (from JWT token)
   * @returns Count of notifications marked as read
   */
  @Put('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all IN_APP notifications as read for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.markAllAsRead(user.id);
    return { count };
  }

  /**
   * Delete notification
   *
   * @param id - Notification ID
   * @param user - Authenticated user (from JWT token)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification',
  })
  @ApiResponse({ status: 204, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.notificationService.delete(id, user.id);
  }
}
