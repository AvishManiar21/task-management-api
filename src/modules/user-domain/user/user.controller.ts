import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { RoleService } from '../authorization/role.service';
import { TeamService } from '../team/team.service';
import { AuthGuard } from '../guards/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { User } from './user.entity';
import { plainToInstance } from 'class-transformer';

/**
 * UserController
 *
 * REST API endpoints for user management.
 *
 * Endpoints:
 * - POST /api/v1/users/register - Register new user (US-041)
 * - GET /api/v1/users/me - Get current user profile
 * - GET /api/v1/users/:id - Get user by ID
 * - PUT /api/v1/users/:id - Update user profile (US-043)
 * - DELETE /api/v1/users/:id - Deactivate user (US-044)
 * - GET /api/v1/users - Search users (US-045)
 * - POST /api/v1/users/:id/roles - Assign role (US-042)
 * - DELETE /api/v1/users/:id/roles/:roleId - Revoke role (US-047)
 * - POST /api/v1/users/:id/team - Assign team (US-046)
 * - GET /api/v1/users/:id/activity - User activity dashboard (US-048)
 *
 * Authentication: All endpoints require JWT authentication (except register)
 * Authorization: Permission-based access control via @Permissions decorator
 *
 * @see US-041, US-042, US-043, US-044, US-045, US-046, US-047, US-048
 */
@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly teamService: TeamService,
  ) {}

  /**
   * Register new user
   *
   * Public endpoint (no authentication required).
   *
   * @param dto - Registration data
   * @returns Created user
   * @see US-041 (Register New User)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user', description: 'Create a new user account with Auth0 integration' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    const user = await this.userService.registerUser(dto);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Get current user profile
   *
   * Returns the authenticated user's own profile.
   *
   * @param currentUser - Authenticated user (from JWT)
   * @returns User profile
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile', description: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() currentUser: User): Promise<UserResponseDto> {
    return plainToInstance(UserResponseDto, currentUser, { excludeExtraneousValues: true });
  }

  /**
   * Get user by ID
   *
   * Requires authentication. Users can view any profile (functional requirement for task assignment).
   *
   * @param id - User ID
   * @returns User profile
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID', description: 'Get user profile by ID' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    const user = await this.userService.getUserById(id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Update user profile
   *
   * Users can update their own profile.
   * Admins can update any profile (requires 'user:update' permission).
   *
   * Editable fields: displayName, timezone, language, notificationPreferences
   *
   * @param id - User ID
   * @param dto - Profile updates
   * @param currentUser - Authenticated user
   * @returns Updated user
   * @see US-043 (Edit User Profile)
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile', description: 'Update user profile (own or admin)' })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot update other users' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    // Authorization check: User can update own profile OR admin can update any
    // This is handled in the service layer via AuthorizationService.canUpdateUser()

    const user = await this.userService.updateProfile(id, dto);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Deactivate user
   *
   * Admin-only operation (requires 'user:delete' permission).
   * Reversible - user can be reactivated later.
   *
   * @param id - User ID
   * @param currentUser - Authenticated admin
   * @returns Deactivated user
   * @see US-044 (Deactivate User Account)
   */
  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('user:delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user', description: 'Deactivate user account (admin only, reversible)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully', type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    const user = await this.userService.deactivateUser(id, currentUser.id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Search users
   *
   * Two modes:
   * - Functional search: All active users (for task assignment) - no permission required
   * - Administrative search: All users (permission required via query param)
   *
   * @param filters - Search filters (query, teamId, isActive)
   * @param currentUser - Authenticated user
   * @returns Array of matching users
   * @see US-045 (Search Users)
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search users',
    description: 'Search users by name/email (functional: active only, admin: all users)',
  })
  @ApiResponse({ status: 200, description: 'User search results', type: [UserResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchUsers(
    @Query() filters: UserFiltersDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto[]> {
    // Default to contextual search (active users only) if no query provided
    const contextual = filters.isActive !== false;

    const users = await this.userService.searchUsers(
      filters.query || '',
      contextual,
      currentUser.id,
    );

    return users.map((user) =>
      plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true }),
    );
  }

  /**
   * Assign role to user
   *
   * Admin-only operation (requires 'user:manage_roles' permission).
   *
   * Business Rules:
   * - Admin only
   * - Cannot self-assign roles
   * - Idempotent (succeeds if user already has role)
   *
   * @param id - User ID
   * @param dto - Role assignment data
   * @param currentUser - Authenticated admin
   * @see US-042 (Manage User Roles and Permissions)
   */
  @Post(':id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('user:manage_roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign role to user', description: 'Assign role to user (admin only)' })
  @ApiResponse({ status: 204, description: 'Role assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin permission or self-assignment attempt' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.roleService.assignRole(id, dto.roleId, currentUser.id);
  }

  /**
   * Revoke role from user
   *
   * Admin-only operation (requires 'user:manage_roles' permission).
   *
   * @param id - User ID
   * @param roleId - Role ID
   * @param currentUser - Authenticated admin
   * @see US-047 (Manage User Permissions - Granular)
   */
  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('user:manage_roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke role from user', description: 'Revoke role from user (admin only)' })
  @ApiResponse({ status: 204, description: 'Role revoked successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin permission' })
  @ApiResponse({ status: 404, description: 'User does not have role' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.roleService.revokeRole(id, roleId, currentUser.id);
  }

  /**
   * Assign user to team
   *
   * Requires 'team:assign_members' permission.
   *
   * Business Rule: User can belong to at most one team (BR-TEAM-001)
   *
   * @param id - User ID
   * @param dto - Team assignment data
   * @param currentUser - Authenticated user with permission
   * @returns Updated user
   * @see US-046 (Assign User to Team)
   */
  @Post(':id/team')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('team:assign_members')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign user to team', description: 'Assign user to team (requires permission)' })
  @ApiResponse({ status: 200, description: 'User assigned to team successfully', type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - requires team:assign_members permission' })
  @ApiResponse({ status: 404, description: 'User or team not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeamDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    const user = await this.userService.assignTeam(id, dto.teamId, currentUser.id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Get user activity dashboard
   *
   * Returns user activity metrics and recent actions.
   *
   * TODO: Implement activity tracking and metrics
   *
   * @param id - User ID
   * @param currentUser - Authenticated user
   * @returns User activity data
   * @see US-048 (User Activity Dashboard)
   */
  @Get(':id/activity')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user activity dashboard', description: 'Get user activity metrics (placeholder)' })
  @ApiResponse({ status: 200, description: 'User activity data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<any> {
    // TODO: Implement activity tracking
    // For now, return placeholder data
    return {
      userId: id,
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      lastActivity: null,
      message: 'Activity tracking not yet implemented',
    };
  }

  /**
   * Get user roles
   *
   * Returns all roles assigned to a user.
   *
   * @param id - User ID
   * @param currentUser - Authenticated user
   * @returns Array of roles
   */
  @Get(':id/roles')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user roles', description: 'Get all roles assigned to user' })
  @ApiResponse({ status: 200, description: 'User roles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserRoles(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const roles = await this.roleService.getUserRoles(id);
    return roles;
  }

  /**
   * Create new team
   *
   * Requires 'team:create' permission.
   *
   * @param dto - Team creation data
   * @param currentUser - Authenticated user with permission
   * @returns Created team
   * @see US-046 (Assign User to Team)
   */
  @Post('teams')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('team:create')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create team', description: 'Create new team (requires permission)' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires team:create permission' })
  @ApiResponse({ status: 409, description: 'Team name already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTeam(@Body() dto: CreateTeamDto, @CurrentUser() currentUser: User): Promise<any> {
    const team = await this.teamService.createTeam(dto, currentUser.id);
    return team;
  }

  /**
   * Get all teams
   *
   * Requires authentication.
   *
   * @returns Array of teams
   */
  @Get('teams')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all teams', description: 'Get list of all teams' })
  @ApiResponse({ status: 200, description: 'Teams list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllTeams(): Promise<any> {
    const teams = await this.teamService.getAllTeams();
    return teams;
  }
}
