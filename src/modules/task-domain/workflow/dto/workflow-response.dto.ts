import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

/**
 * Workflow State Response DTO
 */
@Exclude()
export class WorkflowStateResponseDto {
  @ApiProperty({ description: 'State ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Workflow ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @Expose()
  workflowId: string;

  @ApiProperty({ description: 'State name', example: 'TODO' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'State description', example: 'Initial state for new tasks', nullable: true })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Display color', example: '#3B82F6', nullable: true })
  @Expose()
  color: string;

  @ApiProperty({ description: 'Display order', example: 1 })
  @Expose()
  order: number;

  @ApiProperty({ description: 'Is initial state', example: true })
  @Expose()
  isInitial: boolean;

  @ApiProperty({ description: 'Is terminal state', example: false })
  @Expose()
  isTerminal: boolean;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-07-07T10:30:00Z' })
  @Expose()
  createdAt: Date;
}

/**
 * Workflow Transition Response DTO
 */
@Exclude()
export class WorkflowTransitionResponseDto {
  @ApiProperty({ description: 'Transition ID', example: '550e8400-e29b-41d4-a716-446655440002' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Workflow ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @Expose()
  workflowId: string;

  @ApiProperty({ description: 'Source state ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  fromStateId: string;

  @ApiProperty({ description: 'Target state ID', example: '550e8400-e29b-41d4-a716-446655440003' })
  @Expose()
  toStateId: string;

  @ApiProperty({ description: 'Transition name', example: 'Start Work' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Required permissions', example: ['task:update'], type: [String], nullable: true })
  @Expose()
  requiredPermissions: string[];

  @ApiProperty({ description: 'Requires comment', example: false })
  @Expose()
  requiresComment: boolean;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-07-07T10:30:00Z' })
  @Expose()
  createdAt: Date;
}

/**
 * Workflow Response DTO
 */
@Exclude()
export class WorkflowResponseDto {
  @ApiProperty({ description: 'Workflow ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Workflow name', example: 'Standard' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Workflow description', example: 'Default workflow for tasks', nullable: true })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Is default workflow', example: true })
  @Expose()
  isDefault: boolean;

  @ApiProperty({ description: 'Is system workflow', example: false })
  @Expose()
  isSystem: boolean;

  @ApiProperty({ description: 'Creator user ID', example: '550e8400-e29b-41d4-a716-446655440010' })
  @Expose()
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-07-07T10:30:00Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-07-07T10:30:00Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ description: 'Workflow states', type: [WorkflowStateResponseDto], required: false })
  @Expose()
  @Type(() => WorkflowStateResponseDto)
  states?: WorkflowStateResponseDto[];

  @ApiProperty({ description: 'Workflow transitions', type: [WorkflowTransitionResponseDto], required: false })
  @Expose()
  @Type(() => WorkflowTransitionResponseDto)
  transitions?: WorkflowTransitionResponseDto[];
}
