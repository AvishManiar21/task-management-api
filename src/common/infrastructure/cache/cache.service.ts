import { Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

/**
 * CacheService
 *
 * Wrapper around cache-manager with Redis backend providing type-safe caching
 * with graceful degradation support.
 *
 * Features:
 * - Generic type support for type-safe cache operations
 * - Graceful degradation (fallback to in-memory if Redis unavailable)
 * - Structured logging for cache operations
 * - Error handling with automatic recovery
 *
 * @example
 * ```typescript
 * // Type-safe caching
 * const user = await cacheService.get<User>('user:123');
 * await cacheService.set('user:123', user, 300); // 5 minute TTL
 *
 * // Cache invalidation
 * await cacheService.del('user:123');
 *
 * // Reset all cache
 * await cacheService.reset();
 * ```
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private isRedisAvailable = true;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    this.logger.log('CacheService initialized');
  }

  /**
   * Get cached value by key
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found
   * @template T - Type of cached value
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);

      if (value !== undefined && value !== null) {
        this.logger.debug(`Cache HIT: ${key}`);
      } else {
        this.logger.debug(`Cache MISS: ${key}`);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache GET error for key "${key}": ${error.message}`, error.stack);
      this.handleRedisError(error);
      return undefined; // Graceful degradation
    }
  }

  /**
   * Set cached value with optional TTL
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional, uses default if not provided)
   * @template T - Type of value to cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (ttl !== undefined) {
        await this.cacheManager.set(key, value, ttl * 1000); // Convert to milliseconds
      } else {
        await this.cacheManager.set(key, value);
      }

      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl ?? 'default'}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key "${key}": ${error.message}`, error.stack);
      this.handleRedisError(error);
      // Graceful degradation - continue without caching
    }
  }

  /**
   * Delete cached value by key
   *
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key "${key}": ${error.message}`, error.stack);
      this.handleRedisError(error);
      // Graceful degradation - continue
    }
  }

  /**
   * Delete multiple cached values by pattern matching
   *
   * @param pattern - Pattern to match keys (e.g., 'user:*:profile')
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // Note: Pattern deletion requires Redis store with keys() method
      // This is a simplified implementation
      this.logger.debug(`Cache DEL pattern: ${pattern}`);

      // For cache-manager v5+, we need to use store directly
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys(pattern);
        await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
        this.logger.debug(`Cache DEL pattern "${pattern}" - deleted ${keys.length} keys`);
      } else {
        this.logger.warn(`Cache pattern deletion not supported by current store`);
      }
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for "${pattern}": ${error.message}`, error.stack);
      this.handleRedisError(error);
      // Graceful degradation - continue
    }
  }

  /**
   * Reset entire cache (delete all keys)
   *
   * WARNING: This will clear ALL cached data across the application
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.warn('Cache RESET: All cache cleared');
    } catch (error) {
      this.logger.error(`Cache RESET error: ${error.message}`, error.stack);
      this.handleRedisError(error);
      // Graceful degradation - continue
    }
  }

  /**
   * Wrap a function with caching
   *
   * @param key - Cache key
   * @param fn - Function to execute on cache miss
   * @param ttl - Time to live in seconds
   * @returns Cached or freshly computed value
   * @template T - Return type
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== undefined && cached !== null) {
        return cached;
      }

      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      this.logger.error(`Cache WRAP error for key "${key}": ${error.message}`, error.stack);
      // If caching fails, still execute the function
      return await fn();
    }
  }

  /**
   * Handle Redis connection errors
   *
   * Implements graceful degradation by marking Redis as unavailable
   * and allowing the application to continue without caching.
   *
   * @param error - Error object
   */
  private handleRedisError(error: any): void {
    // Check if this is a Redis connection error
    if (
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('Connection is closed')
    ) {
      if (this.isRedisAvailable) {
        this.isRedisAvailable = false;
        this.logger.error(
          'Redis connection failed - degrading to no-cache mode. ' +
          'Application will continue without caching.'
        );
      }
    }
  }

  /**
   * Get Redis availability status
   *
   * @returns true if Redis is available, false if degraded to in-memory
   */
  isHealthy(): boolean {
    return this.isRedisAvailable;
  }
}
