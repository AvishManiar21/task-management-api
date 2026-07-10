import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';

/**
 * DTO for updating notification preferences
 */
export class UpdatePreferenceDto {
  @ApiPropertyOptional({
    description: 'Enable/disable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable in-app notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enabled event types (array of NotificationType strings)',
    example: ['TASK_ASSIGNED', 'TASK_DUE_SOON', 'COMMENT_ADDED'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledEventTypes?: string[];
}
