import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * AssignRoleDto
 *
 * DTO for assigning a role to a user (US-042)
 *
 * Business Rules:
 * - Admin-only operation (BR-ROLE-001)
 * - Cannot self-assign (enforced in service layer)
 * - Role must exist
 *
 * @see US-042 (Manage User Roles and Permissions)
 */
export class AssignRoleDto {
  @ApiProperty({
    description: 'Role ID to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  roleId: string;
}
