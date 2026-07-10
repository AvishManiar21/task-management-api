import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { Priority } from '../../enums/priority.enum';
import { RecurrencePattern } from '../../value-objects/recurrence-pattern.interface';

/**
 * Task Response DTO
 *
 * Returned from task endpoints with all task data.
 */
@Exclude()
export class TaskResponseDto {
  @ApiProperty({ description: 'Task ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Task title', example: 'Fix login bug' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Task description', example: 'Fix issue with special characters in email', nullable: true })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Workflow ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @Expose()
  workflowId: string;

  @ApiProperty({ description: 'Current workflow state ID', example: '550e8400-e29b-41d4-a716-446655440002' })
  @Expose()
  currentStateId: string;

  @ApiProperty({ description: 'Task priority', enum: Priority, example: Priority.HIGH })
  @Expose()
  priority: Priority;

  @ApiProperty({ description: 'Assignee user ID', example: '550e8400-e29b-41d4-a716-446655440010', nullable: true })
  @Expose()
  assigneeId: string;

  @ApiProperty({ description: 'Creator user ID', example: '550e8400-e29b-41d4-a716-446655440011' })
  @Expose()
  creatorId: string;

  @ApiProperty({ description: 'Due date', example: '2026-07-15T10:00:00Z', nullable: true })
  @Expose()
  dueDate: Date;

  @ApiProperty({ description: 'Tags', example: ['bug', 'frontend'], type: [String], nullable: true })
  @Expose()
  tags: string[];

  @ApiProperty({ description: 'Custom fields', example: { severity: 'critical' }, nullable: true })
  @Expose()
  customFields: Record<string, any>;

  @ApiProperty({ description: 'Parent task ID', example: '550e8400-e29b-41d4-a716-446655440020', nullable: true })
  @Expose()
  parentTaskId: string;

  @ApiProperty({ description: 'Template ID', example: '550e8400-e29b-41d4-a716-446655440030', nullable: true })
  @Expose()
  templateId: string;

  @ApiProperty({ description: 'Is recurring task', example: false })
  @Expose()
  isRecurring: boolean;

  @ApiProperty({ description: 'Recurrence pattern', nullable: true })
  @Expose()
  recurrencePattern: RecurrencePattern;

  @ApiProperty({ description: 'Recurrence source task ID', example: '550e8400-e29b-41d4-a716-446655440040', nullable: true })
  @Expose()
  recurrenceSourceId: string;

  @ApiProperty({ description: 'Estimated hours', example: 4.5, nullable: true })
  @Expose()
  estimatedHours: number;

  @ApiProperty({ description: 'Actual hours', example: 5.2, nullable: true })
  @Expose()
  actualHours: number;

  @ApiProperty({ description: 'Completion timestamp', example: '2026-07-10T15:30:00Z', nullable: true })
  @Expose()
  completedAt: Date;

  @ApiProperty({ description: 'Optimistic locking version', example: 3 })
  @Expose()
  version: number;

  @ApiProperty({ description: 'Created by user ID', example: '550e8400-e29b-41d4-a716-446655440011' })
  @Expose()
  createdBy: string;

  @ApiProperty({ description: 'Updated by user ID', example: '550e8400-e29b-41d4-a716-446655440012' })
  @Expose()
  updatedBy: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-07-07T10:00:00Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-07-07T12:00:00Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ description: 'Deletion timestamp', example: null, nullable: true })
  @Expose()
  deletedAt: Date;

  // Computed fields
  @ApiProperty({ description: 'Is task overdue', example: false })
  @Expose()
  isOverdue?: boolean;

  @ApiProperty({ description: 'Is task completed', example: false })
  @Expose()
  isCompleted?: boolean;
}

/**
 * Paginated Task List Response
 */
export class TaskListResponseDto {
  @ApiProperty({ description: 'List of tasks', type: [TaskResponseDto] })
  @Type(() => TaskResponseDto)
  tasks: TaskResponseDto[];

  @ApiProperty({ description: 'Total count', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Page size', example: 20 })
  pageSize: number;

  @ApiProperty({ description: 'Total pages', example: 8 })
  totalPages: number;
}
