import { Injectable } from '@nestjs/common';
import { ManagementClient } from 'auth0';
import { ConfigService } from '@common/config/config.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { MetricsService } from '@common/infrastructure/metrics/metrics.service';
import { CircuitBreaker, CircuitBreakerRegistry } from '@common/infrastructure/resiliency/decorators/circuit-breaker.decorator';

/**
 * Auth0 User type definition
 * Based on Auth0 Management API user object structure
 * Flexible type to match actual Auth0 SDK v4 return types
 */
export interface Auth0User {
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  blocked?: boolean;
  created_at?: string | { [key: string]: any };
  updated_at?: string | { [key: string]: any };
  [key: string]: any; // Additional fields from Auth0
}

/**
 * Auth0Adapter
 *
 * Adapter for Auth0 Management API integration.
 *
 * Features:
 * - User creation, update, deletion in Auth0
 * - Circuit breaker protection (5 consecutive failures → open 30s)
 * - Exponential backoff retry (3 attempts: 1s, 2s, 4s)
 * - Comprehensive error handling and logging
 * - Metrics collection for Auth0 API calls
 *
 * Business Flows:
 * - Flow 1: User Registration (create in Auth0)
 * - Flow 3: User Profile Update (sync to Auth0)
 * - Flow 7: User Deactivation (block in Auth0)
 * - Flow 8: User Deletion (delete from Auth0)
 *
 * @see US-041 (Register New User)
 * @see US-043 (Edit User Profile)
 * @see US-044 (Deactivate User Account)
 */
@Injectable()
export class Auth0Adapter {
  private readonly logger = new LoggerService();
  private readonly managementClient: ManagementClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('Auth0Adapter');

    const auth0Config = this.configService.getAuth0Config();

    // Management API requires its own audience (https://{domain}/api/v2/)
    // The Management Client SDK handles this automatically when audience is not specified
    this.managementClient = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret,
      // Do NOT specify audience - let SDK use Management API audience
    });

    this.logger.log('Auth0Adapter initialized', { domain: auth0Config.domain });
  }

  /**
   * Create user in Auth0
   *
   * Creates a new user account in Auth0 with email/password authentication.
   *
   * Circuit Breaker:
   * - Strategy: Consecutive (5 failures → open)
   * - Half-open after: 30 seconds
   * - Fallback: Throw error (no fallback, fail fast)
   *
   * Retry:
   * - 3 attempts with exponential backoff (1s, 2s, 4s)
   *
   * @param email - User email
   * @param password - User password
   * @param name - User full name
   * @returns Auth0 user object
   * @throws Error if creation fails after retries
   * @see US-041 (Register New User)
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-create-user',
  })
  async createUser(email: string, password: string, name: string): Promise<Auth0User> {
    const startTime = Date.now();

    this.logger.log('Creating user in Auth0', { email });

    try {
      const user = await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.create({
            connection: 'Username-Password-Authentication',
            email,
            password,
            name,
            email_verified: false,
          });
        },
        3, // max attempts
        1000, // initial delay (1 second)
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('createUser', duration, true);

      this.logger.log('User created successfully in Auth0', {
        auth0Id: user.data.user_id,
        email,
      });

      return user.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('createUser', duration, false);

      this.logger.error('Failed to create user in Auth0', error.stack, { email });

      // Check for known error codes
      if (error.statusCode === 409 || error.message?.includes('already exists')) {
        throw new Error(`Email ${email} is already registered`);
      }

      throw new Error(`Auth0 user creation failed: ${error.message}`);
    }
  }

  /**
   * Get user by Auth0 ID
   *
   * @param auth0Id - Auth0 user ID
   * @returns Auth0 user object
   * @throws Error if user not found
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-get-user',
  })
  async getUserByAuth0Id(auth0Id: string): Promise<Auth0User> {
    const startTime = Date.now();

    try {
      const user = await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.get({ id: auth0Id });
        },
        3,
        1000,
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('getUserByAuth0Id', duration, true);

      return user.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('getUserByAuth0Id', duration, false);

      this.logger.error('Failed to get user from Auth0', error.stack, { auth0Id });

      if (error.statusCode === 404) {
        throw new Error(`User ${auth0Id} not found in Auth0`);
      }

      throw new Error(`Auth0 API error: ${error.message}`);
    }
  }

  /**
   * Update user in Auth0
   *
   * Updates Auth0-managed fields (email, name, picture).
   * Note: Local app manages its own fields (displayName, timezone, language).
   *
   * @param auth0Id - Auth0 user ID
   * @param updates - Fields to update
   * @returns Updated Auth0 user object
   * @throws Error if update fails
   * @see US-043 (Edit User Profile)
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-update-user',
  })
  async updateUser(
    auth0Id: string,
    updates: { email?: string; name?: string; picture?: string },
  ): Promise<Auth0User> {
    const startTime = Date.now();

    this.logger.log('Updating user in Auth0', { auth0Id, updates });

    try {
      const user = await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.update({ id: auth0Id }, updates);
        },
        3,
        1000,
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('updateUser', duration, true);

      this.logger.log('User updated successfully in Auth0', { auth0Id });

      return user.data;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('updateUser', duration, false);

      this.logger.error('Failed to update user in Auth0', error.stack, { auth0Id });

      throw new Error(`Auth0 user update failed: ${error.message}`);
    }
  }

  /**
   * Deactivate user in Auth0
   *
   * Blocks user from logging in by setting blocked=true.
   * This is reversible (can be unblocked later).
   *
   * @param auth0Id - Auth0 user ID
   * @throws Error if deactivation fails
   * @see US-044 (Deactivate User Account)
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-deactivate-user',
  })
  async deactivateUser(auth0Id: string): Promise<void> {
    const startTime = Date.now();

    this.logger.log('Deactivating user in Auth0', { auth0Id });

    try {
      await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.update({ id: auth0Id }, { blocked: true });
        },
        3,
        1000,
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('deactivateUser', duration, true);

      this.logger.log('User deactivated successfully in Auth0', { auth0Id });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('deactivateUser', duration, false);

      this.logger.error('Failed to deactivate user in Auth0', error.stack, { auth0Id });

      throw new Error(`Auth0 user deactivation failed: ${error.message}`);
    }
  }

  /**
   * Reactivate user in Auth0
   *
   * Unblocks user, allowing them to log in again.
   *
   * @param auth0Id - Auth0 user ID
   * @throws Error if reactivation fails
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-reactivate-user',
  })
  async reactivateUser(auth0Id: string): Promise<void> {
    const startTime = Date.now();

    this.logger.log('Reactivating user in Auth0', { auth0Id });

    try {
      await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.update({ id: auth0Id }, { blocked: false });
        },
        3,
        1000,
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('reactivateUser', duration, true);

      this.logger.log('User reactivated successfully in Auth0', { auth0Id });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('reactivateUser', duration, false);

      this.logger.error('Failed to reactivate user in Auth0', error.stack, { auth0Id });

      throw new Error(`Auth0 user reactivation failed: ${error.message}`);
    }
  }

  /**
   * Delete user from Auth0
   *
   * Permanently deletes user account from Auth0.
   * This cannot be undone.
   *
   * @param auth0Id - Auth0 user ID
   * @throws Error if deletion fails
   * @see Flow 8: User Deletion (GDPR compliance)
   */
  @CircuitBreaker({
    strategy: 'consecutive',
    threshold: 5,
    halfOpenAfter: 30000,
    name: 'auth0-delete-user',
  })
  async deleteUser(auth0Id: string): Promise<void> {
    const startTime = Date.now();

    this.logger.warn('Deleting user from Auth0 (PERMANENT)', { auth0Id });

    try {
      await this.retryWithBackoff(
        async () => {
          return await this.managementClient.users.delete({ id: auth0Id });
        },
        3,
        1000,
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('deleteUser', duration, true);

      this.logger.warn('User deleted permanently from Auth0', { auth0Id });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAuth0ApiCall('deleteUser', duration, false);

      this.logger.error('Failed to delete user from Auth0', error.stack, { auth0Id });

      // Don't fail if user already deleted (idempotent)
      if (error.statusCode === 404) {
        this.logger.warn('User not found in Auth0 (already deleted)', { auth0Id });
        return;
      }

      throw new Error(`Auth0 user deletion failed: ${error.message}`);
    }
  }

  /**
   * Retry operation with exponential backoff
   *
   * @param operation - Async operation to retry
   * @param maxAttempts - Maximum retry attempts
   * @param initialDelay - Initial delay in milliseconds
   * @returns Result of operation
   * @throws Error if all attempts fail
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    initialDelay: number,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(`Auth0 API call failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {
            error: error.message,
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
