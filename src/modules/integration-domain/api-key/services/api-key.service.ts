import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { ApiKey } from '../api-key.entity';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';

/**
 * ApiKeyService
 *
 * Core business logic for API key management and authentication.
 *
 * Features:
 * - Generate cryptographically secure API keys
 * - Hash and store keys securely (bcrypt)
 * - Validate API keys during authentication
 * - Permission-based access control
 * - Key expiration and revocation
 * - Track last used timestamp
 *
 * API Key Format:
 * - Prefix: tmsk_live_ (production) or tmsk_test_ (testing)
 * - Format: tmsk_live_<32-char-random-string>
 * - Total length: ~43 characters
 * - Example: tmsk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *
 * Security:
 * - Plain text key shown ONLY ONCE at creation
 * - Stored as bcrypt hash in database (never plain text)
 * - Prefix stored separately for quick lookup/display
 * - Hash uses bcrypt with salt rounds = 10
 * - Keys expire automatically based on expiresAt
 *
 * Authentication Flow:
 * 1. Client sends API key in Authorization header: Bearer tmsk_live_...
 * 2. Extract key from header
 * 3. Look up key by prefix (fast index lookup)
 * 4. Verify hash using bcrypt.compare()
 * 5. Check if key is active and not expired
 * 6. Check if key has required permissions
 * 7. Update lastUsedAt timestamp
 *
 * Permissions Format:
 * - Array of permission strings: ['task:read', 'task:create', 'webhook:manage']
 * - Same format as RBAC permission system
 * - Supports wildcard permissions: ['*'] = full access
 *
 * @see ApiKey
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new LoggerService();
  private readonly SALT_ROUNDS = 10;
  private readonly KEY_LENGTH = 32; // 32 bytes = 64 hex chars

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {
    this.logger.setContext('ApiKeyService');
  }

  /**
   * Create a new API key
   *
   * Steps:
   * 1. Generate cryptographically secure random key
   * 2. Hash key with bcrypt
   * 3. Store hash and prefix in database
   * 4. Return plain text key (ONLY TIME IT'S SHOWN)
   *
   * Business Rules:
   * - At least one permission required
   * - Expiry date must be in future (if provided)
   * - Default: active, no expiry
   *
   * @param dto - API key creation data
   * @param userId - User creating the key
   * @returns Plain text API key (shown only once) and key record
   */
  async createApiKey(
    dto: CreateApiKeyDto,
    userId: string,
  ): Promise<{ plainKey: string; apiKey: ApiKey }> {
    this.logger.log('Creating API key', { name: dto.name, userId });

    // Validate permissions
    if (!dto.permissions || dto.permissions.length === 0) {
      throw new BadRequestException('At least one permission is required');
    }

    // Validate expiry date
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    // Generate plain text API key
    const environment = dto.environment || 'live';
    const prefix = `tmsk_${environment}_`;
    const randomPart = randomBytes(this.KEY_LENGTH).toString('hex');
    const plainKey = `${prefix}${randomPart}`;

    // Hash the API key
    const keyHash = await bcrypt.hash(plainKey, this.SALT_ROUNDS);

    // Create API key record
    const apiKey = this.apiKeyRepo.create({
      name: dto.name,
      keyHash,
      prefix,
      permissions: dto.permissions,
      description: dto.description || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
      createdBy: userId,
    });

    const saved = await this.apiKeyRepo.save(apiKey);
    this.logger.log('API key created', { id: saved.id, name: saved.name, prefix });

    return {
      plainKey, // Return plain key (only time it's shown)
      apiKey: saved,
    };
  }

  /**
   * Validate an API key
   *
   * Steps:
   * 1. Extract prefix from key
   * 2. Find all keys with matching prefix
   * 3. Verify hash for each candidate
   * 4. Check if key is active and not expired
   * 5. Update lastUsedAt timestamp
   *
   * @param plainKey - Plain text API key
   * @returns API key record if valid
   * @throws UnauthorizedException if key is invalid
   */
  async validateApiKey(plainKey: string): Promise<ApiKey> {
    // Extract prefix (e.g., "tmsk_live_")
    const prefixMatch = plainKey.match(/^(tmsk_[a-z]+_)/);
    if (!prefixMatch) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const prefix = prefixMatch[1];

    // Find all keys with matching prefix
    const candidateKeys = await this.apiKeyRepo.find({
      where: { prefix, isActive: true },
    });

    if (candidateKeys.length === 0) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Try to match hash
    for (const candidate of candidateKeys) {
      const isMatch = await bcrypt.compare(plainKey, candidate.keyHash);
      if (isMatch) {
        // Check if expired
        if (candidate.isExpired()) {
          throw new UnauthorizedException('API key has expired');
        }

        // Update last used timestamp
        candidate.updateLastUsedAt();
        await this.apiKeyRepo.save(candidate);

        this.logger.log('API key validated', { id: candidate.id, name: candidate.name });
        return candidate;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Update an existing API key
   *
   * @param id - API key ID
   * @param dto - Update data
   * @param userId - User performing update
   * @returns Updated API key
   */
  async updateApiKey(id: string, dto: UpdateApiKeyDto, userId: string): Promise<ApiKey> {
    this.logger.log('Updating API key', { id, userId });

    const apiKey = await this.apiKeyRepo.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    // Check ownership
    if (apiKey.createdBy !== userId) {
      throw new BadRequestException('You can only update your own API keys');
    }

    // Update fields
    if (dto.name !== undefined) {
      apiKey.name = dto.name;
    }

    if (dto.permissions !== undefined) {
      if (dto.permissions.length === 0) {
        throw new BadRequestException('At least one permission is required');
      }
      apiKey.permissions = dto.permissions;
    }

    if (dto.description !== undefined) {
      apiKey.description = dto.description;
    }

    if (dto.expiresAt !== undefined) {
      if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
        throw new BadRequestException('Expiry date must be in the future');
      }
      apiKey.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    if (dto.isActive !== undefined) {
      apiKey.isActive = dto.isActive;
    }

    const updated = await this.apiKeyRepo.save(apiKey);
    this.logger.log('API key updated', { id: updated.id });

    return updated;
  }

  /**
   * Get an API key by ID
   *
   * @param id - API key ID
   * @returns API key (without hash)
   */
  async getApiKey(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepo.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }
    return apiKey;
  }

  /**
   * List all API keys for a user
   *
   * @param userId - User ID
   * @returns List of API keys (without hashes)
   */
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { createdBy: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke an API key (set isActive to false)
   *
   * @param id - API key ID
   * @param userId - User performing revocation
   */
  async revokeApiKey(id: string, userId: string): Promise<void> {
    this.logger.log('Revoking API key', { id, userId });

    const apiKey = await this.apiKeyRepo.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    // Check ownership
    if (apiKey.createdBy !== userId) {
      throw new BadRequestException('You can only revoke your own API keys');
    }

    apiKey.revoke();
    await this.apiKeyRepo.save(apiKey);

    this.logger.log('API key revoked', { id });
  }

  /**
   * Delete an API key
   *
   * @param id - API key ID
   * @param userId - User performing deletion
   */
  async deleteApiKey(id: string, userId: string): Promise<void> {
    this.logger.log('Deleting API key', { id, userId });

    const apiKey = await this.apiKeyRepo.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    // Check ownership
    if (apiKey.createdBy !== userId) {
      throw new BadRequestException('You can only delete your own API keys');
    }

    await this.apiKeyRepo.remove(apiKey);
    this.logger.log('API key deleted', { id });
  }

  /**
   * Check if an API key has a specific permission
   *
   * @param apiKey - API key
   * @param permission - Permission to check
   * @returns true if key has permission
   */
  hasPermission(apiKey: ApiKey, permission: string): boolean {
    // Wildcard permission grants all access
    if (apiKey.permissions.includes('*')) {
      return true;
    }

    return apiKey.hasPermission(permission);
  }

  /**
   * Check if an API key has all of the specified permissions
   *
   * @param apiKey - API key
   * @param permissions - Permissions to check
   * @returns true if key has all permissions
   */
  hasAllPermissions(apiKey: ApiKey, permissions: string[]): boolean {
    // Wildcard permission grants all access
    if (apiKey.permissions.includes('*')) {
      return true;
    }

    return apiKey.hasAllPermissions(permissions);
  }

  /**
   * Check if an API key has any of the specified permissions
   *
   * @param apiKey - API key
   * @param permissions - Permissions to check
   * @returns true if key has at least one permission
   */
  hasAnyPermission(apiKey: ApiKey, permissions: string[]): boolean {
    // Wildcard permission grants all access
    if (apiKey.permissions.includes('*')) {
      return true;
    }

    return apiKey.hasAnyPermission(permissions);
  }

  /**
   * Find expiring API keys (expiring within specified days)
   *
   * @param days - Number of days to look ahead
   * @returns List of expiring API keys
   */
  async findExpiringKeys(days = 30): Promise<ApiKey[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.apiKeyRepo
      .createQueryBuilder('apiKey')
      .where('apiKey.is_active = :isActive', { isActive: true })
      .andWhere('apiKey.expires_at IS NOT NULL')
      .andWhere('apiKey.expires_at > :now', { now })
      .andWhere('apiKey.expires_at <= :futureDate', { futureDate })
      .getMany();
  }

  /**
   * Find unused API keys (not used for specified days)
   *
   * @param days - Number of days to look back
   * @returns List of unused API keys
   */
  async findUnusedKeys(days = 90): Promise<ApiKey[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.apiKeyRepo
      .createQueryBuilder('apiKey')
      .where('apiKey.is_active = :isActive', { isActive: true })
      .andWhere(
        '(apiKey.last_used_at IS NULL OR apiKey.last_used_at < :cutoffDate)',
        { cutoffDate },
      )
      .getMany();
  }
}
