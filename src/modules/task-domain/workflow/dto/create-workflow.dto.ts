import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';

/**
 * DTO for creating a workflow state
 */
export class CreateWorkflowStateDto {
  @ApiProperty({
    description: 'State name',
    example: 'TODO',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'State description',
    example: 'Initial state for new tasks',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Display color (hex format)',
    example: '#3B82F6',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiProperty({
    description: 'Display order',
    example: 1,
  })
  @IsOptional()
  order?: number;

  @ApiProperty({
    description: 'Is this the initial state',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isInitial?: boolean;

  @ApiProperty({
    description: 'Is this a terminal state',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTerminal?: boolean;
}

/**
 * DTO for creating a workflow transition
 */
export class CreateWorkflowTransitionDto {
  @ApiProperty({
    description: 'Source state name',
    example: 'TODO',
  })
  @IsString()
  fromStateName: string;

  @ApiProperty({
    description: 'Target state name',
    example: 'IN_PROGRESS',
  })
  @IsString()
  toStateName: string;

  @ApiProperty({
    description: 'Transition name/action',
    example: 'Start Work',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Required permissions',
    example: ['task:update', 'task:transition'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPermissions?: string[];

  @ApiProperty({
    description: 'Does this transition require a comment',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresComment?: boolean;
}

/**
 * DTO for creating a new workflow
 */
export class CreateWorkflowDto {
  @ApiProperty({
    description: 'Workflow name (unique)',
    example: 'Bug Tracking',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Workflow description',
    example: 'Workflow for tracking and resolving bugs',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Is this the default workflow',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    description: 'Workflow states',
    type: [CreateWorkflowStateDto],
    example: [
      { name: 'TODO', isInitial: true, order: 1 },
      { name: 'IN_PROGRESS', order: 2 },
      { name: 'DONE', isTerminal: true, order: 3 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStateDto)
  states: CreateWorkflowStateDto[];

  @ApiProperty({
    description: 'Workflow transitions',
    type: [CreateWorkflowTransitionDto],
    required: false,
    example: [
      { fromStateName: 'TODO', toStateName: 'IN_PROGRESS', name: 'Start Work' },
      { fromStateName: 'IN_PROGRESS', toStateName: 'DONE', name: 'Complete' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowTransitionDto)
  transitions?: CreateWorkflowTransitionDto[];
}
