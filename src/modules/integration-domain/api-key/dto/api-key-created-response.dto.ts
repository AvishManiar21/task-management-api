import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ApiKeyCreatedResponseDto
 *
 * Response DTO for API key creation.
 *
 * SECURITY: This is the ONLY time the API key is exposed in plain text.
 * After creation, the key can never be retrieved again.
 *
 * Includes:
 * - All public API key data
 * - Plain text key (one-time exposure)
 *
 * @see ApiKey
 */
@Exclude()
export class ApiKeyCreatedResponseDto {
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
    description: 'Plain text API key (SAVE THIS - shown only once)',
    example: 'tms_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4',
  })
  key: string;

  @Expose()
  @ApiProperty({
    description: 'Key prefix',
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
}
