import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

/**
 * Cacheable Decorator Metadata
 */
export interface CacheableMetadata {
  /** Cache key template (supports interpolation: 'user:${userId}:profile') */
  cacheKey: string;
  /** Time to live in seconds */
  ttl: number;
}

/**
 * @Cacheable Decorator
 *
 * Method-level decorator that automatically caches method results.
 *
 * Features:
 * - Intercepts method calls and checks cache first
 * - Stores result in cache on cache miss
 * - Supports cache key templating with method arguments
 * - Configurable TTL per method
 *
 * @param cacheKey - Cache key template (supports ${argName} interpolation)
 * @param ttl - Time to live in seconds
 *
 * @example
 * ```typescript
 * class UserService {
 *   @Cacheable('user:${userId}:profile', 300) // 5 minute TTL
 *   async getUserProfile(userId: string): Promise<UserProfile> {
 *     return await this.userRepo.findById(userId);
 *   }
 *
 *   @Cacheable('users:all', 60) // 1 minute TTL
 *   async getAllUsers(): Promise<User[]> {
 *     return await this.userRepo.findAll();
 *   }
 * }
 * ```
 *
 * Cache Key Interpolation:
 * - ${argName} - Interpolates method argument by name
 * - ${arg0}, ${arg1} - Interpolates method argument by position
 *
 * Example with interpolation:
 * ```typescript
 * @Cacheable('task:${taskId}:assignee:${userId}', 300)
 * async getTaskAssignment(taskId: string, userId: string) {
 *   // Cache key becomes: 'task:abc123:assignee:xyz789'
 * }
 * ```
 */
export const Cacheable = (cacheKey: string, ttl: number) => {
  return SetMetadata(CACHEABLE_KEY, { cacheKey, ttl } as CacheableMetadata);
};
