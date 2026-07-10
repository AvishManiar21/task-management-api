import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * AssignTeamDto
 *
 * DTO for assigning a user to a team (US-046)
 *
 * Business Rules:
 * - Requires team:assign_members permission
 * - User can belong to at most one team (BR-TEAM-001)
 * - Team must exist
 *
 * @see US-046 (Assign User to Team)
 */
export class AssignTeamDto {
  @ApiProperty({
    description: 'Team ID to assign user to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Team ID must be a valid UUID' })
  teamId: string;
}
