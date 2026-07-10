import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * RegisterUserDto
 *
 * DTO for user registration (US-041)
 *
 * Validation Rules:
 * - Email: Valid email format, required
 * - Password: Min 8 characters, required
 * - Name: 2-100 characters, required
 * - Timezone: Valid IANA timezone, optional (default: UTC)
 * - Language: ISO 639-1 code, optional (default: en)
 *
 * @see US-041 (Register New User)
 */
export class RegisterUserDto {
  @ApiProperty({
    description: 'User email address (must be unique)',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'User password (min 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'User timezone (IANA timezone)',
    example: 'America/New_York',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'User preferred language (ISO 639-1 code)',
    example: 'en',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'Language must be valid ISO 639-1 code (e.g., en, es, fr)',
  })
  language?: string;
}
