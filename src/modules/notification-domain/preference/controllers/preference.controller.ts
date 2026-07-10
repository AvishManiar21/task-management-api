import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PreferenceService } from '../services/preference.service';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { NotificationPreference } from '../notification-preference.entity';

/**
 * PreferenceController
 *
 * REST API endpoints for managing notification preferences.
 *
 * Endpoints:
 * - GET /api/v1/preferences - Get user preferences
 * - PUT /api/v1/preferences - Update user preferences
 *
 * Authentication: All endpoints require JWT authentication
 * Authorization: Users can only access their own preferences
 *
 * Note: In a real implementation, you would use AuthGuard and CurrentUser decorator
 * from the User Domain. For now, we're accepting userId as a query parameter.
 */
@ApiTags('Notification Preferences')
@Controller('preferences')
@ApiBearerAuth()
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  /**
   * Get user notification preferences
   *
   * @param userId - User ID (from auth context)
   * @returns User preferences
   */
  @Get()
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Get notification preferences for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
    type: NotificationPreference,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPreferences(
    @Query('userId', ParseUUIDPipe) userId: string, // TODO: Replace with @CurrentUser()
  ): Promise<NotificationPreference> {
    return this.preferenceService.getPreferences(userId);
  }

  /**
   * Update user notification preferences
   *
   * @param userId - User ID (from auth context)
   * @param dto - Preference updates
   * @returns Updated preferences
   */
  @Put()
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Update notification preferences for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: NotificationPreference,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePreferences(
    @Query('userId', ParseUUIDPipe) userId: string, // TODO: Replace with @CurrentUser()
    @Body() dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    return this.preferenceService.updatePreferences(userId, dto);
  }
}
