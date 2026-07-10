import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ApiKeyResponseDto
 *
 * Safe API key data for API responses.
 *
 * Excludes:
 * - keyHash (never exposed)
 *
 * Includes:
 * - All public API key data
 * - Prefix (for identification)
 * - Permissions and expiry info
 *
 * @see ApiKey
 */
@Exclude()
export class ApiKeyResponseDto {
  @Expose()
  @ApiProperty({
    description: 'API key ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Descriptive name',
    example: 'Production Integration',
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'Key prefix for identification',
    example: 'tms_live_',
  })
  prefix: string;

  @Expose()
  @ApiProperty({
    description: 'Granted permissions',
    example: ['task:read', 'task:create', 'user:read'],
    isArray: true,
  })
  permissions: string[];

  @Expose()
  @ApiPropertyOptional({
    description: 'Optional description',
    example: 'API key for production mobile app integration',
  })
  description: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Expiry date',
    example: '2025-12-31T23:59:59Z',
  })
  expiresAt: Date | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Last used timestamp',
    example: '2024-07-08T10:30:00Z',
  })
  lastUsedAt: Date | null;

  @Expose()
  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    description: 'User who created this API key',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy: string;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-07-08T10:30:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-07-08T15:45:00Z',
  })
  updatedAt: Date;

  // Excluded fields:
  // - keyHash (security: never exposed)
}
