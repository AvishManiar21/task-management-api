import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthorizationService } from '../authorization/authorization.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';

/**
 * PermissionsGuard
 *
 * Permission-based authorization guard.
 *
 * Works with @Permissions decorator to enforce permission checks.
 *
 * Checks:
 * 1. Extract required permissions from route metadata (@Permissions decorator)
 * 2. Get authenticated user from request (attached by AuthGuard)
 * 3. Check if user has all required permissions
 * 4. Allow or deny access
 *
 * Usage:
 * ```typescript
 * @Controller('users')
 * @UseGuards(AuthGuard, PermissionsGuard)
 * export class UserController {
 *   @Delete(':id')
 *   @Permissions('user:delete')
 *   async deleteUser(@Param('id') id: string) {
 *     // Only users with 'user:delete' permission can access
 *   }
 * }
 * ```
 *
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-047 (Manage User Permissions - Granular)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new LoggerService();

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {
    this.logger.setContext('PermissionsGuard');
  }

  /**
   * Check if request is authorized
   *
   * @param context - Execution context
   * @returns true if authorized, throws ForbiddenException otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from route metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required - allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get authenticated user from request (attached by AuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('PermissionsGuard used without AuthGuard - user not found in request');
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has all required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await this.authorizationService.hasPermission(user.id, permission);

      if (!hasPermission) {
        this.logger.warn('Permission denied', {
          userId: user.id,
          email: user.email,
          permission,
          requiredPermissions,
        });

        throw new ForbiddenException(`Missing required permission: ${permission}`);
      }
    }

    this.logger.debug('Permission check passed', {
      userId: user.id,
      permissions: requiredPermissions,
    });

    return true;
  }
}
