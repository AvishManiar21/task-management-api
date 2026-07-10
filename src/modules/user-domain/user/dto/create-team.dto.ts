import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateTeamDto
 *
 * DTO for creating a new team (US-046)
 *
 * Validation Rules:
 * - Name: 2-100 characters, required, unique
 * - Description: Optional
 *
 * Business Rules:
 * - Team names must be unique (BR-TEAM-002)
 *
 * @see US-046 (Assign User to Team)
 */
export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name (must be unique)',
    example: 'Engineering Team',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Team name must be at least 2 characters' })
  @MaxLength(100, { message: 'Team name must not exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Team description',
    example: 'Core engineering team responsible for backend services',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
