import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@common/config/config.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { TracingMiddleware } from '@common/infrastructure/tracing/tracing.middleware';
import helmet from 'helmet';
import compression from 'compression';

/**
 * Bootstrap Application
 *
 * Initializes the NestJS application with:
 * - Global validation pipes
 * - API versioning (v1)
 * - OpenAPI documentation (Swagger)
 * - Global middleware (helmet, compression, tracing)
 * - CORS configuration
 * - Graceful shutdown handlers
 *
 * Health Endpoints:
 * - GET /health - Liveness probe (always 200)
 * - GET /ready - Readiness probe (checks DB+Redis)
 * - GET /health/deep - Deep health check (all dependencies)
 * - GET /metrics - Prometheus metrics
 *
 * API Documentation:
 * - Swagger UI available at /api/docs
 * - OpenAPI JSON spec at /api/docs-json
 *
 * Startup Sequence:
 * 1. Initialize tracing (OpenTelemetry)
 * 2. Create NestJS application
 * 3. Configure global middleware and pipes
 * 4. Set up Swagger documentation
 * 5. Start HTTP server
 * 6. Register graceful shutdown handlers
 */
async function bootstrap() {
  // Create logger instance
  const logger = new LoggerService();
  logger.setContext('Bootstrap');

  logger.log('Starting Task Management Microservice...');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Get configuration service
  const configService = app.get(ConfigService);
  const serverConfig = configService.getServerConfig();
  const corsConfig = configService.getCorsConfig();

  // ===========================
  // Global Middleware
  // ===========================

  // Security middleware (helmet)
  app.use(helmet());

  // Compression middleware
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: corsConfig.origins,
    credentials: corsConfig.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'traceparent'],
  });

  // ===========================
  // Global Pipes
  // ===========================

  // Validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ===========================
  // API Versioning
  // ===========================

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ===========================
  // OpenAPI Documentation (Swagger)
  // ===========================

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Task Management API')
    .setDescription(
      'Task Management Microservice - Comprehensive API for user management, task tracking, and team collaboration',
    )
    .setVersion('1.0.0')
    .setContact('Task Management Team', 'https://example.com', 'support@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from Auth0',
        in: 'header',
      },
      // Name removed - controllers use @ApiBearerAuth() without name
    )
    .addTag('Users', 'User management endpoints (US-041 through US-048)')
    .addTag('Tasks', 'Task management endpoints (US-011 through US-040, US-049 through US-080)')
    .addTag('Health', 'Health check and metrics endpoints')
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://api-staging.example.com', 'Staging Environment')
    .addServer('https://api.example.com', 'Production Environment')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Persist JWT token in browser
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  logger.log('Swagger documentation available at /api/docs');

  // ===========================
  // Graceful Shutdown
  // ===========================

  app.enableShutdownHooks();

  // Handle SIGTERM (Kubernetes pod termination)
  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received - starting graceful shutdown');
    await app.close();
    logger.log('Application closed gracefully');
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.warn('SIGINT received - starting graceful shutdown');
    await app.close();
    logger.log('Application closed gracefully');
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error.stack);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', JSON.stringify({ reason, promise }));
    process.exit(1);
  });

  // ===========================
  // Start Server
  // ===========================

  await app.listen(serverConfig.port, serverConfig.host);

  logger.log(`Application is running on: http://${serverConfig.host}:${serverConfig.port}`);
  logger.log(`API documentation: http://${serverConfig.host}:${serverConfig.port}/api/docs`);
  logger.log(`Health check: http://${serverConfig.host}:${serverConfig.port}/health`);
  logger.log(`Metrics: http://${serverConfig.host}:${serverConfig.port}/metrics`);
  logger.log(`Environment: ${serverConfig.environment}`);
}

// Start application
bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
