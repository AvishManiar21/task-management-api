import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { createLogger, Logger as WinstonLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * LogContext
 *
 * Contextual information injected into log entries
 */
export interface LogContext {
  /** Request ID for distributed tracing */
  requestId?: string;
  /** User ID who initiated the request */
  userId?: string;
  /** Timestamp of log entry (ISO 8601) */
  timestamp?: string;
  /** Application context (service, module, class name) */
  context?: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * LoggerService
 *
 * Structured JSON logging service with PII redaction and contextual information.
 *
 * Features:
 * - Structured JSON logging (production) or pretty-print (development)
 * - Automatic context injection (request ID, user ID, timestamp)
 * - PII redaction for sensitive data
 * - Multiple transports (console, file, CloudWatch/ELK in production)
 * - Log level configuration from environment
 * - Correlation ID tracking for distributed tracing
 *
 * Environment Configuration:
 * - NODE_ENV - Environment (development, staging, production)
 * - LOG_LEVEL - Log level (debug, info, warn, error) - default: info
 * - LOG_FILE_PATH - File path for logs (production) - default: logs/app.log
 *
 * Security:
 * - Automatically redacts PII fields: password, token, authorization, ssn, creditCard
 * - Masks sensitive data in logs before writing
 * - Complies with SECURITY-03 (Application-level logging)
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly logger: LoggerService) {
 *     this.logger.setContext('UserService');
 *   }
 *
 *   async createUser(dto: CreateUserDto) {
 *     this.logger.log('Creating new user', { email: dto.email });
 *     try {
 *       const user = await this.userRepo.create(dto);
 *       this.logger.log('User created successfully', { userId: user.id });
 *       return user;
 *     } catch (error) {
 *       this.logger.error('Failed to create user', error.stack, { email: dto.email });
 *       throw error;
 *     }
 *   }
 * }
 * ```
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly winstonLogger: WinstonLogger;
  private context?: string;
  private globalContext: LogContext = {};

  constructor() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logFilePath = process.env.LOG_FILE_PATH || 'logs/app.log';

    // PII redaction format
    const piiRedaction = format((info) => {
      return this.redactPII(info);
    });

    // Base format: timestamp + JSON
    const baseFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      piiRedaction(),
    );

    // Development format: colorized pretty-print
    const devFormat = format.combine(
      baseFormat,
      format.colorize(),
      format.printf(({ timestamp, level, message, context, requestId, userId, ...meta }) => {
        let log = `${timestamp} [${level}]`;

        if (context) {
          log += ` [${context}]`;
        }

        if (requestId) {
          log += ` [ReqID: ${requestId}]`;
        }

        if (userId) {
          log += ` [User: ${userId}]`;
        }

        log += ` ${message}`;

        // Add metadata if exists
        if (Object.keys(meta).length > 0) {
          log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
      }),
    );

    // Production format: structured JSON
    const prodFormat = format.combine(
      baseFormat,
      format.json(),
    );

    // Configure transports
    const logTransports: any[] = [
      // Console transport (all environments)
      new transports.Console({
        format: nodeEnv === 'development' ? devFormat : prodFormat,
      }),
    ];

    // File transport (staging and production)
    if (nodeEnv !== 'development') {
      logTransports.push(
        new DailyRotateFile({
          filename: logFilePath.replace('.log', '-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d', // Keep logs for 14 days
          level: logLevel,
          format: prodFormat,
        }),
      );

      // Separate error log file
      logTransports.push(
        new DailyRotateFile({
          filename: logFilePath.replace('.log', '-error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d', // Keep error logs for 30 days
          level: 'error',
          format: prodFormat,
        }),
      );
    }

    // Create Winston logger
    this.winstonLogger = createLogger({
      level: logLevel,
      format: baseFormat,
      transports: logTransports,
      // Don't exit on errors
      exitOnError: false,
    });
  }

  /**
   * Set static context for all subsequent logs
   *
   * @param context - Context name (usually class or module name)
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Set global context that persists across all log calls
   *
   * Useful for request-scoped logging (request ID, user ID)
   *
   * @param context - Global context object
   */
  setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  /**
   * Clear global context
   */
  clearGlobalContext(): void {
    this.globalContext = {};
  }

  /**
   * Log informational message
   *
   * @param message - Log message
   * @param context - Optional context (overrides global context)
   */
  log(message: string, context?: string | LogContext): void {
    const logContext = this.buildContext(context);
    this.winstonLogger.info(message, logContext);
  }

  /**
   * Log error message with stack trace
   *
   * @param message - Error message
   * @param trace - Stack trace (optional)
   * @param context - Optional context (overrides global context)
   */
  error(message: string, trace?: string, context?: string | LogContext): void {
    const logContext = this.buildContext(context);
    if (trace) {
      logContext.trace = trace;
    }
    this.winstonLogger.error(message, logContext);
  }

  /**
   * Log warning message
   *
   * @param message - Warning message
   * @param context - Optional context (overrides global context)
   */
  warn(message: string, context?: string | LogContext): void {
    const logContext = this.buildContext(context);
    this.winstonLogger.warn(message, logContext);
  }

  /**
   * Log debug message
   *
   * Only logged when LOG_LEVEL=debug
   *
   * @param message - Debug message
   * @param context - Optional context (overrides global context)
   */
  debug(message: string, context?: string | LogContext): void {
    const logContext = this.buildContext(context);
    this.winstonLogger.debug(message, logContext);
  }

  /**
   * Log verbose message
   *
   * Only logged when LOG_LEVEL=verbose
   *
   * @param message - Verbose message
   * @param context - Optional context (overrides global context)
   */
  verbose(message: string, context?: string | LogContext): void {
    const logContext = this.buildContext(context);
    this.winstonLogger.verbose(message, logContext);
  }

  /**
   * Build log context from parameters
   *
   * @param context - Context string or object
   * @returns Merged context object
   */
  private buildContext(context?: string | LogContext): LogContext {
    const baseContext: LogContext = {
      ...this.globalContext,
      timestamp: new Date().toISOString(),
    };

    // Add static context if set
    if (this.context) {
      baseContext.context = this.context;
    }

    // Override with parameter context
    if (typeof context === 'string') {
      baseContext.context = context;
    } else if (context && typeof context === 'object') {
      Object.assign(baseContext, context);
    }

    return baseContext;
  }

  /**
   * Redact PII (Personally Identifiable Information) from logs
   *
   * Redacts sensitive fields to comply with security requirements:
   * - password, token, authorization, apiKey, secret
   * - ssn, creditCard, cvv
   * - Any field ending with 'Token' or 'Secret'
   *
   * @param info - Log info object
   * @returns Redacted log info
   */
  private redactPII(info: any): any {
    const sensitiveFields = [
      'password',
      'token',
      'authorization',
      'apiKey',
      'secret',
      'ssn',
      'creditCard',
      'cvv',
      'accessToken',
      'refreshToken',
      'idToken',
      'clientSecret',
      'privateKey',
    ];

    // Redact top-level fields
    for (const field of sensitiveFields) {
      if (info[field]) {
        info[field] = '[REDACTED]';
      }
    }

    // Redact nested objects (meta, context, etc.)
    const redactObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Check if key matches sensitive field
          const lowerKey = key.toLowerCase();
          const isSensitive = sensitiveFields.some(field =>
            lowerKey === field.toLowerCase() ||
            lowerKey.endsWith('token') ||
            lowerKey.endsWith('secret') ||
            lowerKey.endsWith('password')
          );

          if (isSensitive && typeof obj[key] === 'string') {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            obj[key] = redactObject(obj[key]);
          }
        }
      }

      return obj;
    };

    // Redact metadata
    if (info.meta && typeof info.meta === 'object') {
      info.meta = redactObject(info.meta);
    }

    // Redact context
    if (info.context && typeof info.context === 'object') {
      info.context = redactObject(info.context);
    }

    // Redact any other nested objects
    for (const key in info) {
      if (info.hasOwnProperty(key) && typeof info[key] === 'object' && info[key] !== null) {
        if (key !== 'timestamp' && key !== 'level' && key !== 'message') {
          info[key] = redactObject(info[key]);
        }
      }
    }

    return info;
  }
}
