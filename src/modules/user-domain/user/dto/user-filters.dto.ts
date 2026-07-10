import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UserFiltersDto
 *
 * DTO for filtering users in search (US-045)
 *
 * Supports:
 * - Text search (name, email, displayName)
 * - Team filter
 * - Active status filter
 *
 * @see US-045 (Search Users)
 */
export class UserFiltersDto {
  @ApiPropertyOptional({
    description: 'Search query (searches name, email, displayName)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'Filter by team ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Team ID must be a valid UUID' })
  teamId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
