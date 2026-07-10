import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UserResponseDto
 *
 * Safe user data for API responses.
 *
 * Excludes:
 * - Sensitive fields (auth0Id, deletedAt)
 * - Internal fields (createdAt, updatedAt can be included if needed)
 *
 * Includes:
 * - Public user data
 * - Display preferences
 * - Team and role information (if populated)
 */
@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @Expose()
  @ApiProperty({
    description: 'Email verification status',
    example: true,
  })
  emailVerified: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://cdn.example.com/avatars/user123.jpg',
  })
  picture: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Display name (preferred name)',
    example: 'Johnny',
  })
  displayName: string | null;

  @Expose()
  @ApiProperty({
    description: 'User timezone',
    example: 'America/New_York',
  })
  timezone: string;

  @Expose()
  @ApiProperty({
    description: 'User preferred language',
    example: 'en',
  })
  language: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Notification preferences',
    example: {
      email: true,
      push: false,
      inApp: true,
    },
  })
  notificationPreferences: Record<string, any>;

  @Expose()
  @ApiPropertyOptional({
    description: 'Team ID (if assigned to a team)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  teamId: string | null;

  @Expose()
  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiPropertyOptional({
    description: 'Last login timestamp',
    example: '2024-07-05T14:22:00Z',
  })
  lastLoginAt: Date | null;

  // Excluded sensitive fields:
  // - auth0Id (internal)
  // - deletedAt (soft delete)
}
