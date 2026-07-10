import { IsString, IsOptional, MinLength, MaxLength, Matches, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdateUserProfileDto
 *
 * DTO for updating user profile (US-043)
 *
 * Editable Fields (user-editable):
 * - displayName: User's preferred display name
 * - timezone: User's timezone
 * - language: User's preferred language
 * - notificationPreferences: User's notification settings
 *
 * Non-Editable Fields (managed by Auth0 or Admin):
 * - email, emailVerified, name, picture (Auth0-synced)
 * - teamId, isActive, deletedAt (admin-only)
 *
 * Business Rule: BR-PROFILE-001 (Field Mutability)
 *
 * @see US-043 (Edit User Profile)
 */
export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'User display name (preferred name)',
    example: 'Johnny',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(100, { message: 'Display name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s]{2,100}$/, {
    message: 'Display name must contain only letters, numbers, and spaces',
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'User timezone (IANA timezone)',
    example: 'America/Los_Angeles',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'User preferred language (ISO 639-1 code)',
    example: 'es',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'Language must be valid ISO 639-1 code',
  })
  language?: string;

  @ApiPropertyOptional({
    description: 'User notification preferences',
    example: {
      email: true,
      push: false,
      inApp: true,
      taskAssigned: true,
      taskCompleted: false,
    },
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, any>;
}
