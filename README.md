# Task Management API

A comprehensive, production-ready REST API for task management with advanced features including user management, RBAC, workflows, notifications, webhooks, and API key management.

## 🚀 Features

### Core Features
- **User Management**: Complete user lifecycle with Auth0 integration
- **Role-Based Access Control (RBAC)**: Fine-grained permissions system
- **Task Management**: Full CRUD operations with state machine workflows
- **Notifications**: Multi-channel notifications (Email, In-App, Push)
- **Webhooks**: Event-driven integrations with external services
- **API Keys**: Programmatic access with scoped permissions

### Technical Features
- **Authentication**: Auth0 OAuth2/OIDC integration
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis integration with graceful degradation
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Monitoring**: Health checks, metrics, and distributed tracing
- **Security**: Rate limiting, input validation, SQL injection prevention
- **Testing**: Unit tests, integration tests, and property-based testing

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Database](#database)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## 🔧 Prerequisites

- **Node.js**: v18+ (recommended: v20+)
- **PostgreSQL**: v14+
- **Redis**: v6+ (optional, for caching)
- **Auth0 Account**: For authentication
- **npm** or **yarn**: Package manager

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/task-management-api.git
cd task-management-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL

```bash
# Create database
createdb task_management

# Or using psql
psql -U postgres
CREATE DATABASE task_management;
```

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your configuration (see [Configuration](#configuration) section).

### 5. Run Database Migrations

```bash
npm run migration:run
```

### 6. Seed Database (Optional)

```bash
npm run seed
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5434
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=task_management
DATABASE_SSL=false

# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://api.task-management.com
AUTH0_ISSUER=https://your-tenant.auth0.com/

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=300

# Security
JWT_SECRET=your-secret-key-min-256-bits
RATE_LIMIT_DEFAULT_POINTS=1000
RATE_LIMIT_DEFAULT_DURATION=3600

# Features
ENABLE_SWAGGER_DOCS=true
LOG_LEVEL=debug
TRACING_ENABLED=false
```

### Auth0 Setup

1. **Create Auth0 Account**: Sign up at [auth0.com](https://auth0.com)

2. **Create API**:
   - Go to Applications → APIs → Create API
   - Name: Task Management API
   - Identifier: `https://api.task-management.com`
   - Signing Algorithm: RS256

3. **Create Application**:
   - Go to Applications → Applications → Create Application
   - Name: Task Management Client
   - Type: Machine to Machine
   - Authorize for Task Management API

4. **Enable Password Grant** (for user authentication):
   - Go to Application Settings → Advanced Settings → Grant Types
   - Enable "Password" grant type
   - Save Changes

5. **Set Default Directory** (if using password grant):
   - Go to Settings (tenant level) → API Authorization Settings
   - Default Directory: `Username-Password-Authentication`
   - Save

6. **Enable Management API Access** (for user creation):
   - Go to Applications → Your M2M App → APIs
   - Authorize for "Auth0 Management API"
   - Grant permissions: `create:users`, `read:users`, `update:users`

## 🚀 Running the Application

### Development Mode

```bash
npm run start:dev
```

The API will be available at: http://localhost:3001

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### Using Docker (Optional)

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## 📚 API Documentation

### Swagger UI

Interactive API documentation is available at:

```
http://localhost:3001/api/docs
```

### Available Endpoints

#### Authentication
- `POST /api/v1/users/register` - Register new user
- `GET /api/v1/users/me` - Get current user profile

#### Users
- `GET /api/v1/users` - List all users
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Soft delete user

#### Tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks` - List tasks (with filters)
- `GET /api/v1/tasks/:id` - Get task details
- `PUT /api/v1/tasks/:id` - Update task
- `PATCH /api/v1/tasks/:id/transition` - Transition task state
- `DELETE /api/v1/tasks/:id` - Delete task

#### Workflows
- `GET /api/v1/workflows` - List workflows
- `GET /api/v1/workflows/default` - Get default workflow
- `GET /api/v1/workflows/:id` - Get workflow details

#### Notifications
- `POST /api/v1/notifications` - Send notification
- `GET /api/v1/notifications` - Get user notifications
- `GET /api/v1/notifications/unread/count` - Get unread count
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/read-all` - Mark all as read

#### API Keys
- `POST /api/v1/api-keys` - Create API key
- `GET /api/v1/api-keys` - List API keys
- `GET /api/v1/api-keys/:id` - Get API key details
- `POST /api/v1/api-keys/:id/revoke` - Revoke API key

#### Webhooks
- `POST /api/v1/webhooks/subscriptions` - Create webhook subscription
- `GET /api/v1/webhooks/subscriptions` - List subscriptions
- `GET /api/v1/webhooks/deliveries/:id` - Get delivery details

#### Health & Monitoring
- `GET /api/health` - Liveness check
- `GET /api/ready` - Readiness check
- `GET /api/health/deep` - Deep health check
- `GET /api/metrics` - Prometheus metrics

## 🔐 Authentication

### Getting an Access Token

#### For M2M (Machine-to-Machine):

```bash
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://api.task-management.com",
    "grant_type": "client_credentials"
  }'
```

#### For Users (Password Grant):

```bash
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "grant_type": "password",
    "username": "user@example.com",
    "password": "SecurePass123!",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://api.task-management.com",
    "realm": "Username-Password-Authentication"
  }'
```

### Using the Token

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3001/api/v1/tasks
```

## 🗄️ Database

### Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts
- `roles` - Role definitions
- `permissions` - Permission definitions
- `user_roles` - User-role assignments
- `role_permissions` - Role-permission assignments
- `teams` - Team organization
- `tasks` - Task records
- `workflows` - Workflow definitions
- `workflow_states` - Workflow state definitions
- `workflow_transitions` - Valid state transitions
- `notifications` - Notification records
- `notification_preferences` - User notification settings
- `webhook_subscriptions` - Webhook configurations
- `webhook_deliveries` - Webhook delivery history
- `api_keys` - API key management

### Migrations

```bash
# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration
npm run migration:generate -- MigrationName
```

### Seeding

```bash
# Run seed data
npm run seed
```

Seeds include:
- 2 default users (Alice, Bob)
- Default workflow (To Do → In Progress → Done)
- Sample tasks

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:cov
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Property-Based Tests

```bash
npm run test:pbt
```

## 🏗️ Architecture

### Project Structure

```
src/
├── common/                    # Shared utilities
│   ├── decorators/           # Custom decorators
│   ├── filters/              # Exception filters
│   ├── guards/               # Authorization guards
│   ├── interceptors/         # Request/response interceptors
│   ├── pipes/                # Validation pipes
│   └── infrastructure/       # Infrastructure services
│       ├── cache/            # Cache service
│       ├── database/         # Database configuration
│       ├── health/           # Health checks
│       ├── logger/           # Logging service
│       ├── metrics/          # Metrics collection
│       └── tracing/          # Distributed tracing
├── modules/                   # Feature modules
│   ├── user-domain/          # User management
│   │   ├── user/             # User CRUD
│   │   ├── role/             # Role management
│   │   ├── permission/       # Permission system
│   │   ├── team/             # Team organization
│   │   ├── guards/           # Auth guards
│   │   └── adapters/         # Auth0 adapter
│   ├── task-domain/          # Task management
│   │   ├── task/             # Task CRUD
│   │   ├── workflow/         # Workflow engine
│   │   ├── comment/          # Task comments
│   │   └── attachment/       # File attachments
│   ├── notification-domain/  # Notifications
│   │   ├── notification/     # Notification service
│   │   ├── preference/       # User preferences
│   │   ├── template/         # Templates
│   │   └── log/              # Delivery logs
│   └── integration-domain/   # External integrations
│       ├── webhook/          # Webhook system
│       └── api-key/          # API key management
├── migrations/               # Database migrations
├── seeds/                    # Database seeds
└── main.ts                   # Application entry point
```

### Design Patterns

- **Domain-Driven Design (DDD)**: Organized by business domains
- **Repository Pattern**: Data access abstraction
- **Service Layer**: Business logic separation
- **DTO Pattern**: Data validation and transformation
- **Adapter Pattern**: External service integration
- **Strategy Pattern**: Pluggable notification channels
- **State Machine**: Workflow state transitions

### Technologies

- **Framework**: NestJS (Node.js framework)
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: Auth0 (OAuth2/OIDC)
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Monitoring**: OpenTelemetry (optional)

## 🔒 Security

### Implemented Security Measures

- **Authentication**: OAuth2/OIDC with Auth0
- **Authorization**: RBAC with fine-grained permissions
- **Rate Limiting**: Configurable request throttling
- **Input Validation**: class-validator with DTOs
- **SQL Injection Prevention**: Parameterized queries (TypeORM)
- **XSS Prevention**: Output encoding
- **CORS**: Configurable cross-origin policies
- **API Keys**: Hashed storage with scoped permissions
- **Webhook Security**: HMAC signature verification
- **Secrets Management**: Environment variables

### Best Practices

- Passwords are never stored (Auth0 handles authentication)
- API keys are hashed before storage
- Soft deletes for user data
- Audit trails for sensitive operations
- Secure session management
- Regular dependency updates

## 📊 Monitoring

### Health Checks

- `/api/health` - Basic liveness check
- `/api/ready` - Readiness check (DB, cache connectivity)
- `/api/health/deep` - Comprehensive health check

### Metrics

Prometheus-compatible metrics at `/api/metrics`:

- HTTP request duration
- HTTP request count
- Active connections
- Database query performance
- Cache hit/miss rates

### Logging

Structured JSON logging with configurable levels:

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier (run `npm run lint`)
- Write tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Auth0](https://auth0.com/) - Authentication platform
- [TypeORM](https://typeorm.io/) - ORM for TypeScript
- [PostgreSQL](https://www.postgresql.org/) - Database

## 📞 Support

For questions or issues:

- Open an issue on GitHub
- Check the [API Documentation](http://localhost:3001/api/docs)
- Review the [Architecture](#architecture) section

## 🗺️ Roadmap

- [ ] GraphQL API support
- [ ] Real-time notifications with WebSockets
- [ ] File upload and storage (S3 integration)
- [ ] Advanced analytics and reporting
- [ ] Mobile SDK (iOS/Android)
- [ ] Kubernetes deployment manifests
- [ ] Performance benchmarks

---

**Built with ❤️ using NestJS and TypeScript**
