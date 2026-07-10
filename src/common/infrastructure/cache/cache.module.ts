import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

/**
 * CacheModule
 *
 * Global module providing caching infrastructure with Redis backend.
 *
 * Features:
 * - Redis-backed cache storage for production
 * - In-memory fallback for development
 * - Configurable TTL defaults
 * - Type-safe CacheService wrapper
 * - Graceful degradation on Redis failure
 *
 * Environment Configuration:
 * - REDIS_HOST - Redis host (default: 'localhost')
 * - REDIS_PORT - Redis port (default: 6379)
 * - REDIS_PASSWORD - Redis password (optional)
 * - REDIS_DB - Redis database index (default: 0)
 * - CACHE_TTL - Default TTL in seconds (default: 300)
 *
 * Usage in Domain Modules:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly cacheService: CacheService) {}
 *
 *   async getUserProfile(userId: string): Promise<UserProfile> {
 *     return this.cacheService.wrap(
 *       `user:${userId}:profile`,
 *       () => this.userRepo.findById(userId),
 *       300 // 5 minute TTL
 *     );
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisDb = configService.get<number>('REDIS_DB', 0);
        const ttl = configService.get<number>('CACHE_TTL', 300); // 5 minutes default

        // Use in-memory cache for development without Redis
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        if (nodeEnv === 'development' && !redisHost) {
          return {
            ttl: ttl * 1000, // milliseconds
            max: 100, // Maximum number of items in memory cache
          };
        }

        // Production: Use Redis store
        return {
          store: redisStore as any,
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
          ttl: ttl * 1000, // milliseconds
          // Connection retry strategy
          retryStrategy: (times: number) => {
            if (times > 3) {
              // After 3 attempts, stop retrying and degrade to in-memory
              console.error('Redis connection failed after 3 attempts - degrading to in-memory cache');
              return undefined; // Stop retrying
            }
            // Exponential backoff: 100ms, 200ms, 400ms
            return Math.min(times * 100, 1000);
          },
          // Socket connection options
          socket: {
            connectTimeout: 5000, // 5 second connection timeout
            keepAlive: 30000, // 30 second keep-alive
          },
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
