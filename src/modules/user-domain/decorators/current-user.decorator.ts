import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../user/user.entity';

/**
 * @CurrentUser Decorator
 *
 * Extracts authenticated user from request context.
 *
 * The user is attached to the request by AuthGuard during authentication.
 *
 * Usage:
 * ```typescript
 * @Controller('users')
 * export class UserController {
 *   @Get('me')
 *   @UseGuards(AuthGuard)
 *   async getCurrentUser(@CurrentUser() user: User) {
 *     return user; // Authenticated user entity
 *   }
 * }
 * ```
 *
 * @returns User entity from request context
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
