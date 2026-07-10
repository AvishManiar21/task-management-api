import { IsString, IsArray, IsOptional, IsBoolean, MaxLength, ArrayMinSize, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdateApiKeyDto
 *
 * DTO for updating an existing API key.
 *
 * All fields are optional - only provided fields will be updated.
 *
 * Validation Rules:
 * - Name max 100 characters if provided
 * - At least one permission if permissions array provided
 * - Expiry date must be in future if provided
 * - Description max 1000 characters if provided
 *
 * @see ApiKey
 */
export class UpdateApiKeyDto {
  /**
   * Descriptive name for the API key
   */
  @ApiPropertyOptional({
    description: 'Descriptive name for the API key',
    example: 'Production Integration - Updated',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  /**
   * Permissions granted to this API key
   */
  @ApiPropertyOptional({
    description: 'Array of permissions granted to this API key',
    example: ['task:read', 'task:create', 'task:update', 'user:read'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one permission is required' })
  @IsString({ each: true })
  permissions?: string[];

  /**
   * Active status
   */
  @ApiPropertyOptional({
    description: 'Active status - set to false to revoke API key',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Optional description
   */
  @ApiPropertyOptional({
    description: 'Optional description for this API key',
    example: 'Updated API key configuration',
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
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
