import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * LoggerModule
 *
 * Global module providing structured logging infrastructure.
 *
 * Features:
 * - Winston-based structured JSON logging
 * - Automatic PII redaction
 * - Environment-based configuration
 * - Multiple transports (console, file, CloudWatch/ELK)
 * - Request context propagation
 * - Overrides NestJS default logger
 *
 * Environment Configuration:
 * - NODE_ENV - Environment (development, staging, production)
 * - LOG_LEVEL - Log level (debug, info, warn, error) - default: info
 * - LOG_FILE_PATH - File path for logs (production) - default: logs/app.log
 *
 * Usage in Application:
 * ```typescript
 * // app.module.ts
 * @Module({
 *   imports: [LoggerModule],
 * })
 * export class AppModule {}
 *
 * // main.ts
 * const app = await NestFactory.create(AppModule, {
 *   bufferLogs: true,
 * });
 * app.useLogger(app.get(LoggerService));
 * ```
 *
 * Usage in Services:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   private readonly logger = new LoggerService();
 *
 *   constructor() {
 *     this.logger.setContext('UserService');
 *   }
 *
 *   async createUser(dto: CreateUserDto) {
 *     this.logger.log('Creating user', { email: dto.email });
 *     // ... implementation
 *   }
 * }
 * ```
 *
 * Complies with:
 * - SECURITY-03: Application-level logging with PII redaction
 * - US-060: Security logging for encryption events
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
