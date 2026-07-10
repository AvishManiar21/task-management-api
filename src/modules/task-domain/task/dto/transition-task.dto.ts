import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

/**
 * DTO for transitioning a task to a new workflow state
 */
export class TransitionTaskDto {
  @ApiProperty({
    description: 'Target workflow state ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  toStateId: string;

  @ApiProperty({
    description: 'Optional comment explaining the transition',
    example: 'Moving to in-progress, starting work now',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'Optimistic locking version (required)',
    example: 2,
  })
  @IsInt()
  @Min(1)
  version: number;
}
