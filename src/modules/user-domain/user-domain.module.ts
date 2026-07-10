import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagementClient } from 'auth0';

// Entities
import { User } from './user/user.entity';
import { Team } from './team/team.entity';
import { Role } from './authorization/role.entity';
import { Permission } from './authorization/permission.entity';
import { UserRole } from './authorization/user-role.entity';
import { RolePermission } from './authorization/role-permission.entity';

// Repositories
import { UserRepository } from './user/user.repository';
import { TeamRepository } from './team/team.repository';
import { RoleRepository } from './authorization/role.repository';
import { PermissionRepository } from './authorization/permission.repository';
import { UserRoleRepository } from './authorization/user-role.repository';
import { RolePermissionRepository } from './authorization/role-permission.repository';

// Services
import { UserService } from './user/user.service';
import { AuthorizationService } from './authorization/authorization.service';
import { RoleService } from './authorization/role.service';
import { TeamService } from './team/team.service';

// Adapters
import { Auth0Adapter } from './adapters/auth0.adapter';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

// Controllers
import { UserController } from './user/user.controller';

// Infrastructure imports
import { ConfigService } from '@common/config/config.service';
import { CacheModule } from '@common/infrastructure/cache/cache.module';
import { LoggerModule } from '@common/infrastructure/logging/logger.module';
import { MetricsModule } from '@common/infrastructure/metrics/metrics.module';
import { DatabaseModule } from '@common/infrastructure/database/database.module';

/**
 * UserDomainModule
 *
 * User management domain module implementing User Stories US-041 through US-048.
 *
 * Responsibilities:
 * - User registration and authentication (Auth0 integration)
 * - User profile management (CRUD operations)
 * - Role-Based Access Control (RBAC)
 * - Team management
 * - Permission-based authorization
 * - User search and filtering
 * - User activity tracking
 *
 * Architecture:
 * - **Entities**: User, Team, Role, Permission, UserRole, RolePermission
 * - **Repositories**: Custom query methods for all entities
 * - **Services**: Business logic layer (UserService, AuthorizationService, RoleService, TeamService)
 * - **Adapters**: External service integration (Auth0Adapter)
 * - **Guards**: Authentication (AuthGuard) and authorization (PermissionsGuard)
 * - **Controllers**: REST API endpoints (UserController)
 *
 * Dependencies:
 * - Infrastructure: Cache, Logging, Metrics, Database, Tracing
 * - External: Auth0 Management API
 *
 * Exports:
 * - UserService: For use in Task Domain (task assignment, user lookup)
 * - AuthorizationService: For permission checks in other domains
 * - AuthGuard, PermissionsGuard: For protecting API endpoints
 *
 * @see US-041 (Register New User)
 * @see US-042 (Manage User Roles and Permissions)
 * @see US-043 (Edit User Profile)
 * @see US-044 (Deactivate User Account)
 * @see US-045 (Search Users)
 * @see US-046 (Assign User to Team)
 * @see US-047 (Manage User Permissions - Granular)
 * @see US-048 (User Activity Dashboard)
 */
@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      User,
      Team,
      Role,
      Permission,
      UserRole,
      RolePermission,
    ]),

    // Infrastructure modules
    CacheModule,
    LoggerModule,
    MetricsModule,
    DatabaseModule,
  ],

  controllers: [
    UserController,
  ],

  providers: [
    // Repositories
    UserRepository,
    TeamRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    RolePermissionRepository,

    // Services
    UserService,
    AuthorizationService,
    RoleService,
    TeamService,

    // Adapters
    Auth0Adapter,

    // Guards
    AuthGuard,
    PermissionsGuard,

    // Make AuthGuard global - applies to ALL endpoints by default
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },

    // Auth0 Management Client factory
    {
      provide: ManagementClient,
      useFactory: (configService: ConfigService) => {
        const auth0Config = configService.getAuth0Config();
        return new ManagementClient({
          domain: auth0Config.domain,
          clientId: auth0Config.clientId,
          clientSecret: auth0Config.clientSecret,
          // Scopes are managed in Auth0 dashboard for M2M applications
        });
      },
      inject: [ConfigService],
    },
  ],

  exports: [
    // Export services for use in other domains
    UserService, // Task Domain needs this for task assignment
    AuthorizationService, // All domains need this for permission checks
    RoleService, // For role management across domains
    TeamService, // For team-based filtering in other domains

    // Export guards for use in other controllers
    AuthGuard,
    PermissionsGuard,
  ],
})
export class UserDomainModule {}
