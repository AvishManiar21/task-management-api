import { IsString, IsArray, IsOptional, MaxLength, ArrayMinSize, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateApiKeyDto
 *
 * DTO for creating a new API key.
 *
 * Validation Rules:
 * - Name required, max 100 characters
 * - At least one permission required
 * - Expiry date optional, must be in future
 * - Description optional, max 1000 characters
 *
 * @see ApiKey
 */
export class CreateApiKeyDto {
  /**
   * Descriptive name for the API key
   */
  @ApiProperty({
    description: 'Descriptive name for the API key',
    example: 'Production Integration',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  /**
   * Permissions granted to this API key
   */
  @ApiProperty({
    description: 'Array of permissions granted to this API key',
    example: ['task:read', 'task:create', 'user:read', 'webhook:manage'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one permission is required' })
  @IsString({ each: true })
  permissions: string[];

  /**
   * Optional description
   */
  @ApiPropertyOptional({
    description: 'Optional description for this API key',
    example: 'API key for production mobile app integration',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  /**
   * Optional expiry date
   */
  @ApiPropertyOptional({
    description: 'Optional expiry date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /**
   * Environment for key prefix (live or test)
   */
  @ApiPropertyOptional({
    description: 'Environment for key prefix (live or test, defaults to live)',
    example: 'live',
    enum: ['live', 'test'],
  })
  @IsOptional()
  @IsString()
  environment?: 'live' | 'test';
}
