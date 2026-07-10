import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
  poolSize?: number; // Alias for poolMax for backward compatibility
  logging: boolean;
}

/**
 * Redis Configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number; // Default TTL in seconds
}

/**
 * Auth0 Configuration
 */
export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  issuer: string;
}

/**
 * JWT Configuration
 */
export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * Server Configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  corsOrigins: string[];
}

/**
 * Logging Configuration
 */
export interface LoggingConfig {
  level: string;
  filePath: string;
}

/**
 * Tracing Configuration
 */
export interface TracingConfig {
  enabled: boolean;
  sampleRate: number;
  exporter: 'jaeger' | 'xray' | 'console';
  jaegerEndpoint: string;
}

/**
 * ConfigService
 *
 * Type-safe configuration service wrapping NestJS ConfigService.
 *
 * Features:
 * - Type-safe configuration getters
 * - Environment-based configuration
 * - Configuration validation on startup
 * - Default values for optional settings
 * - Support for .env files in development
 *
 * Environment Variables:
 * - NODE_ENV: development | staging | production
 * - PORT: Server port (default: 3000)
 * - DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, etc.
 * - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, etc.
 * - AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, etc.
 * - JWT_SECRET, JWT_EXPIRES_IN, etc.
 * - LOG_LEVEL, LOG_FILE_PATH, etc.
 * - TRACING_ENABLED, TRACING_SAMPLE_RATE, etc.
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly configService: ConfigService) {}
 *
 *   async createUser(dto: CreateUserDto) {
 *     const auth0Config = this.configService.getAuth0Config();
 *     const auth0Client = new Auth0ManagementClient({
 *       domain: auth0Config.domain,
 *       clientId: auth0Config.clientId,
 *       clientSecret: auth0Config.clientSecret,
 *     });
 *
 *     // ... implementation
 *   }
 * }
 * ```
 *
 * Complies with:
 * - 12-Factor App: Configuration in environment variables
 */
@Injectable()
export class ConfigService {
  constructor(private readonly nestConfig: NestConfigService) {}

  /**
   * Get server configuration
   *
   * @returns Server configuration
   */
  getServerConfig(): ServerConfig {
    return {
      port: this.nestConfig.get<number>('PORT', 3000),
      host: this.nestConfig.get<string>('HOST', '0.0.0.0'),
      environment: this.nestConfig.get<'development' | 'staging' | 'production'>('NODE_ENV', 'development'),
      corsOrigins: this.nestConfig.get<string>('CORS_ORIGINS', '*').split(','),
    };
  }

  /**
   * Get database configuration
   *
   * @returns Database configuration
   * @throws Error if required configuration is missing
   */
  getDatabaseConfig(): DatabaseConfig {
    const config: DatabaseConfig = {
      host: this.nestConfig.get<string>('DATABASE_HOST', 'localhost'),
      port: this.nestConfig.get<number>('DATABASE_PORT', 5432),
      username: this.nestConfig.get<string>('DATABASE_USERNAME', 'postgres'),
      password: this.nestConfig.get<string>('DATABASE_PASSWORD', 'postgres'),
      database: this.nestConfig.get<string>('DATABASE_NAME', 'task_management'),
      schema: this.nestConfig.get<string>('DATABASE_SCHEMA', 'public'),
      ssl: this.nestConfig.get<string>('DATABASE_SSL', 'false') === 'true',
      poolMin: this.nestConfig.get<number>('DATABASE_POOL_MIN', 2),
      poolMax: this.nestConfig.get<number>('DATABASE_POOL_MAX', 10),
      logging: this.nestConfig.get<string>('DATABASE_LOGGING', 'false') === 'true',
    };

    // Validate required fields in production
    if (this.getServerConfig().environment === 'production') {
      this.validateRequired(config, ['host', 'username', 'password', 'database']);
    }

    return config;
  }

  /**
   * Get Redis configuration
   *
   * @returns Redis configuration
   */
  getRedisConfig(): RedisConfig {
    return {
      host: this.nestConfig.get<string>('REDIS_HOST', 'localhost'),
      port: this.nestConfig.get<number>('REDIS_PORT', 6379),
      password: this.nestConfig.get<string>('REDIS_PASSWORD'),
      db: this.nestConfig.get<number>('REDIS_DB', 0),
      ttl: this.nestConfig.get<number>('CACHE_TTL', 300), // 5 minutes default
    };
  }

  /**
   * Get Auth0 configuration
   *
   * @returns Auth0 configuration
   * @throws Error if required configuration is missing
   */
  getAuth0Config(): Auth0Config {
    const domain = this.nestConfig.get<string>('AUTH0_DOMAIN');
    const clientId = this.nestConfig.get<string>('AUTH0_CLIENT_ID');
    const clientSecret = this.nestConfig.get<string>('AUTH0_CLIENT_SECRET');
    const audience = this.nestConfig.get<string>('AUTH0_AUDIENCE');

    // Validate required fields
    if (!domain || !clientId || !clientSecret || !audience) {
      throw new Error(
        'Missing required Auth0 configuration. ' +
        'Please set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, and AUTH0_AUDIENCE.'
      );
    }

    return {
      domain,
      clientId,
      clientSecret,
      audience,
      issuer: `https://${domain}/`,
    };
  }

  /**
   * Get JWT configuration
   *
   * @returns JWT configuration
   * @throws Error if required configuration is missing
   */
  getJwtConfig(): JwtConfig {
    const secret = this.nestConfig.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('Missing required JWT_SECRET configuration');
    }

    return {
      secret,
      expiresIn: this.nestConfig.get<string>('JWT_EXPIRES_IN', '15m'),
      refreshExpiresIn: this.nestConfig.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    };
  }

  /**
   * Get logging configuration
   *
   * @returns Logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return {
      level: this.nestConfig.get<string>('LOG_LEVEL', 'info'),
      filePath: this.nestConfig.get<string>('LOG_FILE_PATH', 'logs/app.log'),
    };
  }

  /**
   * Get tracing configuration
   *
   * @returns Tracing configuration
   */
  getTracingConfig(): TracingConfig {
    return {
      enabled: this.nestConfig.get<string>('TRACING_ENABLED', 'true') !== 'false',
      sampleRate: parseFloat(this.nestConfig.get<string>('TRACING_SAMPLE_RATE', '0.1')),
      exporter: this.nestConfig.get<'jaeger' | 'xray' | 'console'>('TRACING_EXPORTER', 'jaeger'),
      jaegerEndpoint: this.nestConfig.get<string>('JAEGER_ENDPOINT', 'http://localhost:14268/api/traces'),
    };
  }

  /**
   * Get environment name
   *
   * @returns Environment (development, staging, production)
   */
  getEnvironment(): 'development' | 'staging' | 'production' {
    return this.nestConfig.get<'development' | 'staging' | 'production'>('NODE_ENV', 'development');
  }

  /**
   * Check if running in production
   *
   * @returns true if production, false otherwise
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Check if running in development
   *
   * @returns true if development, false otherwise
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Get CORS configuration
   *
   * @returns CORS configuration
   */
  getCorsConfig() {
    return {
      origins: this.nestConfig.get<string>('CORS_ORIGINS', '*').split(','),
      credentials: this.nestConfig.get<string>('CORS_CREDENTIALS', 'true') === 'true',
    };
  }

  /**
   * Get raw configuration value
   *
   * @param key - Configuration key
   * @param defaultValue - Default value if key not found
   * @returns Configuration value
   */
  get<T = string>(key: string, defaultValue?: T): T | undefined {
    return this.nestConfig.get<T>(key) ?? defaultValue;
  }

  /**
   * Validate required configuration fields
   *
   * @param config - Configuration object
   * @param requiredFields - List of required field names
   * @throws Error if any required field is missing
   */
  private validateRequired(config: any, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration: ${missing.join(', ')}`
      );
    }
  }
}
