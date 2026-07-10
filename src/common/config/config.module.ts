import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

/**
 * ConfigModule
 *
 * Global module providing type-safe configuration management.
 *
 * Features:
 * - Type-safe configuration getters
 * - Environment variable loading from .env file
 * - Configuration validation on startup
 * - Environment-based configuration (development, staging, production)
 * - Default values for optional settings
 *
 * Environment Files:
 * - .env - Development environment (gitignored)
 * - .env.staging - Staging environment (optional)
 * - .env.production - Production environment (optional)
 *
 * 12-Factor App Compliance:
 * - All configuration in environment variables
 * - No secrets in code
 * - Environment-specific configuration
 *
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [ConfigModule],
 * })
 * export class AppModule {}
 *
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly configService: ConfigService) {}
 *
 *   async createUser() {
 *     const auth0Config = this.configService.getAuth0Config();
 *     // ... implementation
 *   }
 * }
 * ```
 *
 * Required Environment Variables (Production):
 * - AUTH0_DOMAIN
 * - AUTH0_CLIENT_ID
 * - AUTH0_CLIENT_SECRET
 * - AUTH0_AUDIENCE
 * - JWT_SECRET
 * - DATABASE_HOST
 * - DATABASE_USERNAME
 * - DATABASE_PASSWORD
 * - DATABASE_NAME
 *
 * Optional Environment Variables:
 * - PORT (default: 3000)
 * - NODE_ENV (default: development)
 * - REDIS_HOST (default: localhost)
 * - LOG_LEVEL (default: info)
 * - TRACING_ENABLED (default: true)
 * - See ConfigService for full list
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      // Load .env file in development
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      // Make environment variables available globally
      isGlobal: true,
      // Expand variables (e.g., ${DATABASE_URL})
      expandVariables: true,
      // Cache configuration
      cache: true,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService, NestConfigModule],
})
export class ConfigModule {}
