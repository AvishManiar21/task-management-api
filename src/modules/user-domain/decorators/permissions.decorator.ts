import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @Permissions Decorator
 *
 * Metadata decorator for permission-based access control.
 *
 * Works with PermissionsGuard to enforce permission checks.
 *
 * Permission Format: {resource}:{action}
 * Examples:
 * - user:create, user:read, user:update, user:delete
 * - task:create, task:read, task:update, task:delete, task:assign
 * - team:create, team:assign_members
 *
 * Usage:
 * ```typescript
 * @Controller('users')
 * @UseGuards(AuthGuard, PermissionsGuard)
 * export class UserController {
 *   @Post()
 *   @Permissions('user:create')
 *   async createUser() {
 *     // Only users with 'user:create' permission can access
 *   }
 *
 *   @Delete(':id')
 *   @Permissions('user:delete')
 *   async deleteUser() {
 *     // Only users with 'user:delete' permission can access
 *   }
 *
 *   @Post(':id/roles')
 *   @Permissions('user:manage_roles')
 *   async assignRole() {
 *     // Only users with 'user:manage_roles' permission can access
 *   }
 * }
 * ```
 *
 * Multiple Permissions:
 * User must have ALL specified permissions.
 *
 * ```typescript
 * @Permissions('user:update', 'user:manage_roles')
 * async updateUserRole() {
 *   // User must have both permissions
 * }
 * ```
 *
 * @param permissions - One or more permission strings
 * @returns Metadata decorator
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
