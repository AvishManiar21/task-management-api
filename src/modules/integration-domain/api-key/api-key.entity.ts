import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * ApiKey Entity
 *
 * Represents an API key for external system authentication.
 *
 * Features:
 * - Secure key generation (cryptographically random)
 * - Hashed storage (bcrypt/argon2) - never store plain text
 * - Permission-based access control (array of permissions)
 * - Expiration support with optional expiry date
 * - Last used tracking for security audit
 * - Revocable via isActive flag
 *
 * Security:
 * - Key is only shown ONCE at creation time
 * - Stored as hash (argon2) in database
 * - Prefix format: tms_live_* or tms_test_* for easy identification
 * - Minimum 32 characters (cryptographically secure)
 *
 * Business Rules:
 * - Each API key has a descriptive name for identification
 * - Permissions control which API endpoints can be accessed
 * - Expired keys are automatically rejected
 * - Inactive keys cannot be used
 * - Last used timestamp updated on each successful auth
 *
 * Permissions Format:
 * - Array of permission strings: ['task:read', 'task:create', 'webhook:manage']
 * - Follows same permission model as RBAC system
 *
 * @see US-INT-003 (API Key Management)
 */
@Entity('api_keys')
@Index(['keyHash'], { unique: true })
@Index(['createdBy'])
@Index(['isActive'])
@Index(['expiresAt'])
export class ApiKey {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Descriptive name for the API key
   * Helps users identify purpose of each key
   * Example: "Production Integration", "CI/CD Pipeline", "Mobile App"
   */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Hashed API key (argon2)
   * Plain text key is never stored
   * Format: argon2id$v=19$m=65536,t=3,p=4$...
   *
   * SECURITY: Original key shown only once at creation
   */
  @Column({ type: 'varchar', length: 255, unique: true, name: 'key_hash' })
  @Index({ unique: true })
  keyHash: string;

  /**
   * Key prefix for identification
   * Format: tms_live_* for production, tms_test_* for testing
   * Stored separately to allow prefix-based lookups
   */
  @Column({ type: 'varchar', length: 20 })
  prefix: string;

  /**
   * Permissions granted to this API key
   * Array of permission strings
   * Example: ['task:read', 'task:create', 'user:read', 'webhook:manage']
   */
  @Column({ type: 'simple-array' })
  permissions: string[];

  /**
   * Optional description
   * Additional context about key usage
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Key expiration timestamp
   * null = never expires
   * Expired keys are automatically rejected during authentication
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  @Index()
  expiresAt: Date | null;

  /**
   * Last used timestamp
   * Updated on each successful API request using this key
   * Helps identify unused/stale keys for cleanup
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null;

  /**
   * Active status
   * false = key revoked/disabled, cannot be used
   * true = key active, can be used if not expired
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  @Index()
  isActive: boolean;

  /**
   * User who created this API key
   */
  @Column({ type: 'uuid', name: 'created_by' })
  @Index()
  createdBy: string;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if API key is currently valid
   * @returns true if key is active and not expired
   */
  isValid(): boolean {
    if (!this.isActive) {
      return false;
    }

    if (this.expiresAt && new Date() > new Date(this.expiresAt)) {
      return false;
    }

    return true;
  }

  /**
   * Check if API key is expired
   * @returns true if key has expiry date and it has passed
   */
  isExpired(): boolean {
    return this.expiresAt !== null && new Date() > new Date(this.expiresAt);
  }

  /**
   * Check if API key has a specific permission
   * @param permission - Permission string to check
   * @returns true if key has permission
   */
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  /**
   * Check if API key has all of the specified permissions
   * @param permissions - Array of permission strings
   * @returns true if key has all permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  /**
   * Check if API key has any of the specified permissions
   * @param permissions - Array of permission strings
   * @returns true if key has at least one permission
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  /**
   * Add a permission to the API key
   * @param permission - Permission string to add
   */
  addPermission(permission: string): void {
    if (!this.permissions.includes(permission)) {
      this.permissions.push(permission);
    }
  }

  /**
   * Remove a permission from the API key
   * @param permission - Permission string to remove
   */
  removePermission(permission: string): void {
    this.permissions = this.permissions.filter((p) => p !== permission);
  }

  /**
   * Revoke API key (set isActive to false)
   * Revoked keys cannot be used
   */
  revoke(): void {
    this.isActive = false;
  }

  /**
   * Activate API key (set isActive to true)
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Update last used timestamp
   */
  updateLastUsedAt(): void {
    this.lastUsedAt = new Date();
  }

  /**
   * Get days until expiration
   * @returns Number of days until expiration, or null if no expiry
   */
  getDaysUntilExpiration(): number | null {
    if (!this.expiresAt) {
      return null;
    }

    const now = new Date();
    const expiryDate = new Date(this.expiresAt);
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if API key is expiring soon (within 30 days)
   * @returns true if key expires within 30 days
   */
  isExpiringSoon(): boolean {
    const daysUntilExpiration = this.getDaysUntilExpiration();
    return daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  }

  /**
   * Validate API key data
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    // Key hash validation
    if (!this.keyHash || this.keyHash.length === 0) {
      errors.push('Key hash is required');
    }

    // Prefix validation
    if (!this.prefix || this.prefix.length === 0) {
      errors.push('Prefix is required');
    }

    // Permissions validation
    if (!this.permissions || this.permissions.length === 0) {
      errors.push('At least one permission is required');
    }

    // Description validation
    if (this.description && this.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }

    // Expiry date validation
    if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
      errors.push('Expiry date must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
