import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  Min,
  ValidateNested,
} from 'class-validator';
import { Priority } from '../../enums/priority.enum';
import { RecurrencePattern } from '../../value-objects/recurrence-pattern.interface';

/**
 * DTO for creating a new task
 */
export class CreateTaskDto {
  @ApiProperty({
    description: 'Task title',
    example: 'Fix login bug',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Detailed description',
    example: 'Users are unable to login with email addresses containing special characters',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Workflow ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @ApiProperty({
    description: 'Initial workflow state ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  currentStateId?: string;

  @ApiProperty({
    description: 'Task priority',
    enum: Priority,
    example: Priority.HIGH,
    default: Priority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Assignee user ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({
    description: 'Due date',
    example: '2026-07-15T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiProperty({
    description: 'Tags for categorization',
    example: ['bug', 'frontend', 'urgent'],
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
    example: { severity: 'critical', browser: 'Chrome', version: '115.0' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiProperty({
    description: 'Parent task ID (for subtasks)',
    example: '550e8400-e29b-41d4-a716-446655440020',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiProperty({
    description: 'Template ID (if creating from template)',
    example: '550e8400-e29b-41d4-a716-446655440030',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({
    description: 'Template variables (if creating from template)',
    example: { project_name: 'MyApp', due_days: 7 },
    required: false,
  })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;

  @ApiProperty({
    description: 'Is this a recurring task definition',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Recurrence pattern',
    example: {
      frequency: 'WEEKLY',
      interval: 1,
      daysOfWeek: [1, 3, 5],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  recurrencePattern?: RecurrencePattern;

  @ApiProperty({
    description: 'Estimated effort in hours',
    example: 4.5,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;
}
