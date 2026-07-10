import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  IsArray,
  IsNumber,
  IsObject,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  Min,
  IsInt,
} from 'class-validator';
import { Priority } from '../../enums/priority.enum';
import { RecurrencePattern } from '../../value-objects/recurrence-pattern.interface';

/**
 * DTO for updating an existing task
 */
export class UpdateTaskDto {
  @ApiProperty({
    description: 'Task title',
    example: 'Fix login bug - Updated',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Detailed description',
    example: 'Updated description with more details',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Task priority',
    enum: Priority,
    example: Priority.URGENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Assignee user ID (null to unassign)',
    example: '550e8400-e29b-41d4-a716-446655440010',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiProperty({
    description: 'Due date',
    example: '2026-07-20T10:00:00Z',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @ApiProperty({
    description: 'Tags for categorization',
    example: ['bug', 'frontend', 'critical'],
    type: [String],
    required: false,
    maxItems: 50,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @ApiProperty({
    description: 'Custom fields (JSONB)',
    example: { severity: 'critical', browser: 'Firefox' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiProperty({
    description: 'Estimated effort in hours',
    example: 6.0,
    required: false,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number | null;

  @ApiProperty({
    description: 'Actual effort logged in hours',
    example: 5.5,
    required: false,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualHours?: number | null;

  @ApiProperty({
    description: 'Recurrence pattern',
    example: {
      frequency: 'DAILY',
      interval: 2,
    },
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  recurrencePattern?: RecurrencePattern | null;

  @ApiProperty({
    description: 'Optimistic locking version (required for updates)',
    example: 5,
    required: true,
  })
  @IsInt()
  @Min(1)
  version: number;
}
