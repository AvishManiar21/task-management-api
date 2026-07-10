import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRepository } from './user.repository';
import { TeamRepository } from '../team/team.repository';
import { RoleRepository } from '../authorization/role.repository';
import { UserRoleRepository } from '../authorization/user-role.repository';
import { Auth0Adapter } from '../adapters/auth0.adapter';
import { TransactionManager } from '@common/infrastructure/database/transaction-manager.service';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { MetricsService } from '@common/infrastructure/metrics/metrics.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { User } from './user.entity';

/**
 * UserService
 *
 * Core business logic for user management.
 *
 * Implements:
 * - Flow 1: User Registration (dual-create: Auth0 → local DB → assign MEMBER role)
 * - Flow 2: User Profile Sync (Auth0 webhooks)
 * - Flow 3: User Profile Update (validate editable fields only)
 * - Flow 6: Team Assignment
 * - Flow 7: User Deactivation (reversible, sync to Auth0)
 * - Flow 8: User Deletion (GDPR compliance with anonymization)
 * - Flow 9: User Search (contextual: functional vs administrative)
 *
 * Business Rules Enforced:
 * - BR-USER-001: Unique email
 * - BR-EMAIL-001: Email verification required for task assignment
 * - BR-PROFILE-001: Field mutability (Auth0 vs local vs admin-only)
 * - BR-DEACT-003: Reversible deactivation
 * - BR-DELETE-003: PII anonymization on deletion
 *
 * @see US-041 (Register New User)
 * @see US-043 (Edit User Profile)
 * @see US-044 (Deactivate User Account)
 * @see US-045 (Search Users)
 * @see US-046 (Assign User to Team)
 */
@Injectable()
export class UserService {
  private readonly logger = new LoggerService();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teamRepo: TeamRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly auth0Adapter: Auth0Adapter,
    private readonly txManager: TransactionManager,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext('UserService');
  }

  /**
   * Register new user (Flow 1: User Registration)
   *
   * Steps:
   * 1. Validate input
   * 2. Create user in Auth0 (source of truth)
   * 3. Create local user record
   * 4. Assign default MEMBER role
   * 5. Emit user.created event
   *
   * Business Rules:
   * - BR-USER-001: Email must be unique
   * - Default role: MEMBER
   * - Email verification required before task assignment
   *
   * @param dto - Registration data
   * @returns Created user
   * @throws ConflictException if email already exists
   * @throws Error if Auth0 creation fails
   * @see US-041 (Register New User)
   */
  async registerUser(dto: RegisterUserDto): Promise<User> {
    this.logger.log('Registering new user', { email: dto.email });

    // Check if email already exists (BR-USER-001)
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(`Email ${dto.email} is already registered`);
    }

    // Step 1: Create user in Auth0 (source of truth for authentication)
    let auth0User;
    try {
      auth0User = await this.auth0Adapter.createUser(dto.email, dto.password, dto.name);
    } catch (error) {
      this.logger.error('Auth0 user creation failed', error.stack, { email: dto.email });
      throw error;
    }

    // Step 2-4: Create local user + assign role (in transaction)
    const user = await this.txManager.run(async (em) => {
      // Create local user record
      const newUser = em.create(User, {
        auth0Id: auth0User.user_id!,
        email: auth0User.email!,
        emailVerified: auth0User.email_verified || false,
        name: auth0User.name || dto.name,
        picture: auth0User.picture || null,
        displayName: dto.name,
        timezone: dto.timezone || 'UTC',
        language: dto.language || 'en',
        notificationPreferences: this.getDefaultNotificationPreferences(),
        isActive: true,
      });

      const savedUser = await em.save(User, newUser);

      // Assign default MEMBER role
      const memberRole = await this.roleRepo.findByName('MEMBER');
      if (!memberRole) {
        throw new Error('MEMBER role not found - database may not be seeded');
      }

      await em.save('UserRole', {
        userId: savedUser.id,
        roleId: memberRole.id,
        assignedBy: savedUser.id, // Self-assignment on registration
      });

      return savedUser;
    });

    // Metrics
    this.metricsService.incrementCounter('user_registrations_total', {
      method: 'email',
      source: 'web',
    });

    // Emit event
    this.eventEmitter.emit('user.created', { user });

    this.logger.log('User registered successfully', {
      userId: user.id,
      email: user.email,
      auth0Id: user.auth0Id,
    });

    return user;
  }

  /**
   * Update user profile (Flow 3: User Profile Update)
   *
   * Editable Fields (user can update):
   * - displayName, timezone, language, notificationPreferences
   *
   * Non-Editable Fields:
   * - email, emailVerified, name, picture (Auth0-managed)
   * - teamId, isActive, deletedAt (admin-only)
   *
   * Business Rule: BR-PROFILE-001 (Field Mutability)
   *
   * @param userId - User ID
   * @param dto - Profile updates
   * @returns Updated user
   * @throws NotFoundException if user not found
   * @see US-043 (Edit User Profile)
   */
  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<User> {
    this.logger.log('Updating user profile', { userId });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Apply updates (only editable fields)
    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }
    if (dto.timezone !== undefined) {
      // TODO: Validate timezone against IANA list
      user.timezone = dto.timezone;
    }
    if (dto.language !== undefined) {
      user.language = dto.language;
    }
    if (dto.notificationPreferences !== undefined) {
      user.notificationPreferences = dto.notificationPreferences;
    }

    const updatedUser = await this.userRepo.save(user);

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);

    // Emit event
    this.eventEmitter.emit('user.profile_updated', { user: updatedUser });

    this.logger.log('User profile updated successfully', { userId });

    return updatedUser;
  }

  /**
   * Assign user to team (Flow 6: Team Assignment)
   *
   * Business Rules:
   * - BR-TEAM-001: User can belong to at most one team
   * - Admin-only operation
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @param actorId - ID of user performing assignment (for audit)
   * @returns Updated user
   * @throws NotFoundException if user or team not found
   * @see US-046 (Assign User to Team)
   */
  async assignTeam(userId: string, teamId: string, actorId: string): Promise<User> {
    this.logger.log('Assigning user to team', { userId, teamId, actorId });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    // Update team assignment
    user.teamId = teamId;
    const updatedUser = await this.userRepo.save(user);

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);

    // Emit event
    this.eventEmitter.emit('user.team_assigned', { user: updatedUser, teamId, actorId });

    this.logger.log('User assigned to team successfully', { userId, teamId });

    return updatedUser;
  }

  /**
   * Deactivate user (Flow 7: User Deactivation)
   *
   * Reversible operation - user can be reactivated later.
   *
   * Steps:
   * 1. Set isActive = false
   * 2. Block user in Auth0
   * 3. Emit event
   *
   * Business Rule: BR-DEACT-003 (Reversible deactivation)
   *
   * @param userId - User ID
   * @param actorId - ID of user performing deactivation (for audit)
   * @returns Deactivated user
   * @throws NotFoundException if user not found
   * @see US-044 (Deactivate User Account)
   */
  async deactivateUser(userId: string, actorId: string): Promise<User> {
    this.logger.log('Deactivating user', { userId, actorId });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Set inactive
    user.isActive = false;
    const updatedUser = await this.userRepo.save(user);

    // Deactivate in Auth0 (block user from logging in)
    try {
      await this.auth0Adapter.deactivateUser(user.auth0Id);
    } catch (error) {
      this.logger.error('Failed to deactivate user in Auth0', error.stack, { userId });
      // Continue - local deactivation succeeded even if Auth0 sync fails
    }

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);

    // Emit event
    this.eventEmitter.emit('user.deactivated', { user: updatedUser, actorId });

    this.logger.log('User deactivated successfully', { userId });

    return updatedUser;
  }

  /**
   * Reactivate user
   *
   * Reverses deactivation.
   *
   * @param userId - User ID
   * @param actorId - ID of user performing reactivation
   * @returns Reactivated user
   */
  async reactivateUser(userId: string, actorId: string): Promise<User> {
    this.logger.log('Reactivating user', { userId, actorId });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Set active
    user.isActive = true;
    const updatedUser = await this.userRepo.save(user);

    // Reactivate in Auth0
    try {
      await this.auth0Adapter.reactivateUser(user.auth0Id);
    } catch (error) {
      this.logger.error('Failed to reactivate user in Auth0', error.stack, { userId });
    }

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);

    // Emit event
    this.eventEmitter.emit('user.reactivated', { user: updatedUser, actorId });

    this.logger.log('User reactivated successfully', { userId });

    return updatedUser;
  }

  /**
   * Delete user (Flow 8: User Deletion - GDPR compliance)
   *
   * Permanent deletion with PII anonymization.
   *
   * Steps:
   * 1. Soft delete (set deletedAt)
   * 2. Anonymize PII (email, name, displayName, picture)
   * 3. Delete from Auth0
   * 4. Revoke all roles
   * 5. Emit event
   *
   * Business Rules:
   * - BR-DELETE-001: Soft delete preserves audit trails
   * - BR-DELETE-003: PII anonymization for GDPR compliance
   *
   * @param userId - User ID
   * @param actorId - ID of user performing deletion (for audit)
   * @param gdprRequest - true if GDPR right-to-erasure request
   * @throws NotFoundException if user not found
   */
  async deleteUser(userId: string, actorId: string, gdprRequest: boolean = false): Promise<void> {
    this.logger.warn('Deleting user (PERMANENT with PII anonymization)', { userId, actorId, gdprRequest });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.txManager.run(async (em) => {
      // Soft delete + anonymize PII (BR-DELETE-003)
      user.deletedAt = new Date();
      user.email = `deleted_user_${userId}@deleted.local`;
      user.name = 'Deleted User';
      user.displayName = 'Deleted User';
      user.picture = null;
      user.notificationPreferences = {};
      user.isActive = false;

      await em.save(User, user);

      // Revoke all roles
      await this.userRoleRepo.deleteByUserId(userId);
    });

    // Delete from Auth0
    try {
      await this.auth0Adapter.deleteUser(user.auth0Id);
    } catch (error) {
      this.logger.error('Failed to delete user from Auth0', error.stack, { userId });
      // Continue - local deletion succeeded
    }

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);
    await this.cacheService.delByPattern(`user:${userId}:*`);

    // Emit event
    this.eventEmitter.emit('user.deleted', { userId, actorId, gdprRequest });

    this.logger.warn('User deleted successfully with PII anonymization', { userId });
  }

  /**
   * Search users (Flow 9: User Search - Contextual)
   *
   * Two modes:
   * - Functional search (contextual=true): Permissionless, active users only, for task assignment
   * - Administrative search (contextual=false): Permission-required, all users
   *
   * Business Rule: BR-SEARCH-001 (Contextual search)
   *
   * @param query - Search query
   * @param contextual - true = functional, false = administrative
   * @param actorId - User performing search (for permission check)
   * @returns Array of matching users
   * @see US-045 (Search Users)
   */
  async searchUsers(query: string, contextual: boolean, actorId: string): Promise<User[]> {
    this.logger.log('Searching users', { query, contextual, actorId });

    // Contextual search: Active users only (for task assignment)
    // Administrative search: All users (requires permission, checked in controller)
    const users = await this.userRepo.searchUsers(query, contextual);

    this.logger.log('User search completed', { resultCount: users.length });

    return users;
  }

  /**
   * Sync user from Auth0 (Flow 2: User Profile Sync)
   *
   * Called from Auth0 webhook when user profile changes in Auth0.
   *
   * Field Ownership:
   * - Auth0 wins: email, emailVerified, name, picture
   * - Local wins: displayName, timezone, language, notificationPreferences
   *
   * @param auth0Event - Auth0 webhook event
   */
  async syncUserFromAuth0(auth0Event: any): Promise<void> {
    const auth0Id = auth0Event.user_id;

    this.logger.log('Syncing user from Auth0 webhook', { auth0Id });

    const user = await this.userRepo.findByAuth0Id(auth0Id);
    if (!user) {
      this.logger.warn('User not found for Auth0 sync', { auth0Id });
      return;
    }

    // Sync Auth0-owned fields only
    let updated = false;

    if (auth0Event.email && auth0Event.email !== user.email) {
      user.email = auth0Event.email;
      updated = true;
    }

    if (auth0Event.email_verified !== undefined && auth0Event.email_verified !== user.emailVerified) {
      user.emailVerified = auth0Event.email_verified;
      updated = true;
    }

    if (auth0Event.name && auth0Event.name !== user.name) {
      user.name = auth0Event.name;
      updated = true;
    }

    if (auth0Event.picture && auth0Event.picture !== user.picture) {
      user.picture = auth0Event.picture;
      updated = true;
    }

    if (updated) {
      await this.userRepo.save(user);

      // Invalidate cache
      await this.cacheService.del(`user:${user.id}:profile`);

      this.logger.log('User synced from Auth0', { userId: user.id });
    } else {
      this.logger.log('No changes to sync from Auth0', { userId: user.id });
    }
  }

  /**
   * Get user by ID
   *
   * @param userId - User ID
   * @returns User
   * @throws NotFoundException if not found
   */
  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user;
  }

  /**
   * Get user by email
   *
   * @param email - Email address
   * @returns User or null
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findByEmail(email);
  }

  /**
   * Get user by Auth0 ID
   *
   * Used during JWT validation.
   *
   * @param auth0Id - Auth0 user ID
   * @returns User or null
   */
  async getUserByAuth0Id(auth0Id: string): Promise<User | null> {
    return await this.userRepo.findByAuth0Id(auth0Id);
  }

  /**
   * Get default notification preferences
   *
   * @returns Default preferences object
   */
  private getDefaultNotificationPreferences(): Record<string, any> {
    return {
      email: true,
      push: false,
      inApp: true,
      taskAssigned: true,
      taskCompleted: false,
      taskDueSoon: true,
      mentionedInComment: true,
    };
  }
}
