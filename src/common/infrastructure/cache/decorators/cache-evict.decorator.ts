import { SetMetadata } from '@nestjs/common';

export const CACHE_EVICT_KEY = 'cache_evict';

/**
 * Cache Evict Decorator Metadata
 */
export interface CacheEvictMetadata {
  /** Cache key or pattern to evict (supports wildcards: 'user:*:profile') */
  cacheKey: string;
  /** If true, evict all keys matching pattern. If false, evict single key */
  pattern?: boolean;
}

/**
 * @CacheEvict Decorator
 *
 * Method-level decorator that automatically invalidates cache after method execution.
 *
 * Features:
 * - Evicts cache keys after method completes successfully
 * - Supports single key eviction
 * - Supports pattern matching for bulk eviction
 * - Cache key interpolation with method arguments
 *
 * @param cacheKey - Cache key or pattern template (supports ${argName} interpolation)
 * @param options - Optional configuration
 * @param options.pattern - If true, treat cacheKey as pattern (supports wildcards)
 *
 * @example
 * ```typescript
 * class UserService {
 *   @CacheEvict('user:${userId}:profile')
 *   async updateUserProfile(userId: string, data: UpdateUserDto): Promise<User> {
 *     // Cache key 'user:abc123:profile' will be evicted after update
 *     return await this.userRepo.update(userId, data);
 *   }
 *
 *   @CacheEvict('user:${userId}:*', { pattern: true })
 *   async deleteUser(userId: string): Promise<void> {
 *     // All cache keys matching 'user:abc123:*' will be evicted
 *     await this.userRepo.delete(userId);
 *   }
 *
 *   @CacheEvict('users:all')
 *   async createUser(data: CreateUserDto): Promise<User> {
 *     // Evict 'users:all' list cache after creating new user
 *     return await this.userRepo.create(data);
 *   }
 * }
 * ```
 *
 * Pattern Matching:
 * - 'user:*' - Evicts all keys starting with 'user:'
 * - 'user:${userId}:*' - Evicts all keys for specific user
 * - '*:profile' - Evicts all profile keys
 *
 * Execution Order:
 * 1. Method executes
 * 2. If method succeeds, cache is evicted
 * 3. If method throws, cache is NOT evicted (preserves cache on error)
 */
export const CacheEvict = (cacheKey: string, options?: { pattern?: boolean }) => {
  return SetMetadata(CACHE_EVICT_KEY, {
    cacheKey,
    pattern: options?.pattern ?? false,
  } as CacheEvictMetadata);
};
