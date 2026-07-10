import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Task } from '../task/task.entity';
import { VirusScanStatus } from '../enums/virus-scan-status.enum';

/**
 * Attachment Entity
 *
 * File attachment metadata for tasks.
 * Actual files are stored externally in S3/MinIO.
 *
 * Lifecycle:
 * 1. Upload: File uploaded to temporary storage, metadata created (PENDING scan)
 * 2. Scan: ClamAV virus scanner processes file, updates virusScanStatus
 * 3. Active: If CLEAN, file available for download
 * 4. Quarantine: If INFECTED, file isolated and task owner notified
 * 5. Soft Delete: When task deleted, attachment marked for deletion (30-day retention)
 * 6. Hard Delete: After 30 days, cleanup job permanently deletes file from storage
 *
 * Business Rules:
 * - Max file size: 25MB (25,000,000 bytes)
 * - Allowed MIME types: Configurable whitelist
 * - Virus scanning required before download
 * - File name: Max 255 characters
 * - Retention: 30 days after task deletion
 * - Storage: S3/MinIO with presigned URLs
 *
 * @see Task
 */
@Entity('attachment')
export class Attachment {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Parent task ID
   */
  @Column({ type: 'uuid', name: 'task_id' })
  @Index()
  taskId: string;

  /**
   * Original file name
   */
  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  /**
   * File size in bytes
   */
  @Column({ type: 'bigint', name: 'file_size' })
  fileSize: number;

  /**
   * MIME type
   * @example "application/pdf", "image/png", "text/plain"
   */
  @Column({ type: 'varchar', length: 100, name: 'mime_type' })
  mimeType: string;

  /**
   * Storage key (S3/MinIO object key)
   * @example "attachments/task-123/abc-def-ghi.pdf"
   */
  @Column({ type: 'varchar', length: 500, unique: true, name: 'storage_key' })
  storageKey: string;

  /**
   * Full storage URL
   * @example "https://s3.amazonaws.com/bucket/attachments/task-123/abc-def-ghi.pdf"
   */
  @Column({ type: 'varchar', length: 1000, name: 'storage_url' })
  storageUrl: string;

  /**
   * File checksum (SHA-256)
   * Used for integrity verification and deduplication
   */
  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  /**
   * Virus scan status
   */
  @Column({
    type: 'enum',
    enum: VirusScanStatus,
    default: VirusScanStatus.PENDING,
    name: 'virus_scan_status',
  })
  @Index()
  virusScanStatus: VirusScanStatus;

  /**
   * Virus scan result details (JSONB)
   * Contains scan results, threat names, scan date, etc.
   *
   * @example
   * {
   *   "scanner": "ClamAV",
   *   "scannedAt": "2026-07-07T10:30:00Z",
   *   "threats": ["Trojan.Generic.12345"],
   *   "scanDuration": 2.5
   * }
   */
  @Column({ type: 'jsonb', nullable: true, name: 'virus_scan_details' })
  virusScanDetails: Record<string, any>;

  /**
   * Uploader user ID
   */
  @Column({ type: 'uuid', name: 'uploaded_by' })
  @Index()
  uploadedBy: string;

  /**
   * Upload timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt: Date;

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date;

  /**
   * Scheduled deletion timestamp
   * Set when task is soft-deleted (now + 30 days)
   * Cleanup job deletes files after this date
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'marked_for_deletion_at' })
  @Index()
  markedForDeletionAt: Date;

  // ===========================
  // Relationships
  // ===========================

  /**
   * Parent task
   */
  @ManyToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Check if file is clean (passed virus scan)
   * @returns true if scan status is CLEAN
   */
  isClean(): boolean {
    return this.virusScanStatus === VirusScanStatus.CLEAN;
  }

  /**
   * Check if file is quarantined (virus detected)
   * @returns true if scan status is INFECTED
   */
  isQuarantined(): boolean {
    return this.virusScanStatus === VirusScanStatus.INFECTED;
  }

  /**
   * Check if file is pending virus scan
   * @returns true if scan status is PENDING
   */
  isPendingScan(): boolean {
    return this.virusScanStatus === VirusScanStatus.PENDING;
  }

  /**
   * Check if file can be downloaded
   * Only clean files can be downloaded
   *
   * @returns true if file can be downloaded
   */
  canDownload(): boolean {
    return this.isClean() && !this.isDeleted();
  }

  /**
   * Generate presigned URL for temporary download access
   * Note: Actual URL generation should be done by storage service
   *
   * @param expiresIn - Expiration time in seconds (default 3600 = 1 hour)
   * @returns Presigned URL (placeholder - implement in service layer)
   */
  generatePresignedUrl(expiresIn: number = 3600): string {
    // Placeholder - actual implementation in StorageService
    return `${this.storageUrl}?expires=${Date.now() + expiresIn * 1000}`;
  }

  /**
   * Mark attachment for deletion
   * Sets markedForDeletionAt to 30 days from now
   */
  markForDeletion(): void {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);
    this.markedForDeletionAt = deletionDate;
  }

  /**
   * Check if attachment is deleted
   * @returns true if soft-deleted
   */
  isDeleted(): boolean {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  }

  /**
   * Check if attachment is ready for permanent deletion
   * @returns true if marked for deletion and grace period has passed
   */
  isReadyForPermanentDeletion(): boolean {
    if (!this.markedForDeletionAt) {
      return false;
    }
    return new Date() > new Date(this.markedForDeletionAt);
  }

  /**
   * Get file size in human-readable format
   * @returns Formatted file size (e.g., "2.5 MB")
   */
  getHumanReadableSize(): string {
    const bytes = Number(this.fileSize);

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Validate attachment
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // File name validation
    if (!this.fileName || this.fileName.trim().length === 0) {
      errors.push('File name is required');
    }

    if (this.fileName && this.fileName.length > 255) {
      errors.push('File name cannot exceed 255 characters');
    }

    // File size validation
    if (!this.fileSize || this.fileSize <= 0) {
      errors.push('File size must be positive');
    }

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (this.fileSize > MAX_FILE_SIZE) {
      errors.push('File size cannot exceed 25MB');
    }

    // MIME type validation
    if (!this.mimeType || this.mimeType.trim().length === 0) {
      errors.push('MIME type is required');
    }

    // Storage key validation
    if (!this.storageKey || this.storageKey.trim().length === 0) {
      errors.push('Storage key is required');
    }

    // Storage URL validation
    if (!this.storageUrl || this.storageUrl.trim().length === 0) {
      errors.push('Storage URL is required');
    }

    // Checksum validation
    if (!this.checksum || this.checksum.trim().length === 0) {
      errors.push('Checksum is required');
    }

    if (this.checksum && this.checksum.length !== 64) {
      errors.push('Checksum must be 64 characters (SHA-256)');
    }

    // Task ID validation
    if (!this.taskId) {
      errors.push('Task ID is required');
    }

    // Uploader validation
    if (!this.uploadedBy) {
      errors.push('Uploader user ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
