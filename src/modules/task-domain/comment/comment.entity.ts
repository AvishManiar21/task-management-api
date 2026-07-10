import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Task } from '../task/task.entity';

/**
 * Comment Entity
 *
 * Task comments with threading support and @mentions.
 *
 * Features:
 * - Nested threading (configurable max depth, default 5 levels)
 * - @mention support for user notifications
 * - Edit tracking (editedBy field)
 * - Soft deletes
 *
 * Business Rules:
 * - Content: 1-10,000 characters, required
 * - Threading depth: Max 5 levels (configurable)
 * - Mentions: Max 10 users per comment
 * - Parent comment must belong to same task
 * - Deleted comments show "[deleted]" placeholder
 *
 * @see Task
 */
@Entity('comment')
export class Comment {
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
   * Comment author ID
   */
  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  /**
   * Comment content (1-10,000 characters)
   */
  @Column({ type: 'text' })
  content: string;

  /**
   * Parent comment ID (for threading)
   */
  @Column({ type: 'uuid', nullable: true, name: 'parent_comment_id' })
  @Index()
  parentCommentId: string;

  /**
   * Mentioned user IDs
   * Users mentioned with @username syntax
   */
  @Column({ type: 'simple-array', nullable: true })
  mentions: string[];

  /**
   * Threading depth level
   * 0 = root comment, 1 = reply to root, etc.
   */
  @Column({ type: 'integer', default: 0 })
  depth: number;

  /**
   * Last editor user ID (if edited)
   */
  @Column({ type: 'uuid', nullable: true, name: 'edited_by' })
  editedBy: string;

  /**
   * Creation timestamp
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  @Index()
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date;

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

  /**
   * Parent comment (for threading)
   */
  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment: Comment;

  /**
   * Child comments (replies)
   */
  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Get all replies to this comment
   * @returns Array of child comments
   */
  getReplies(): Comment[] {
    return this.replies || [];
  }

  /**
   * Get threading depth of this comment
   * @returns Depth level (0 for root comments)
   */
  getThreadDepth(): number {
    return this.depth;
  }

  /**
   * Check if this comment can receive replies
   * Based on maximum threading depth configuration (default 5)
   *
   * @param maxDepth - Maximum allowed depth (default 5)
   * @returns true if depth allows replies
   */
  canReply(maxDepth: number = 5): boolean {
    return this.depth < maxDepth;
  }

  /**
   * Extract @mentions from comment content
   * Finds all @username patterns in the content
   *
   * @returns Array of mentioned usernames
   */
  extractMentions(): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches: string[] = [];
    let match;

    while ((match = mentionRegex.exec(this.content)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Check if comment has been edited
   * @returns true if comment was edited after creation
   */
  isEdited(): boolean {
    return this.editedBy !== null && this.editedBy !== undefined;
  }

  /**
   * Check if comment is deleted
   * @returns true if comment has been soft-deleted
   */
  isDeleted(): boolean {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  }

  /**
   * Get display content
   * Returns "[deleted]" for deleted comments
   *
   * @returns Display content
   */
  getDisplayContent(): string {
    if (this.isDeleted()) {
      return '[deleted]';
    }
    return this.content;
  }

  /**
   * Validate comment
   *
   * @returns Validation result
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Content validation
    if (!this.content || this.content.trim().length === 0) {
      errors.push('Content is required');
    }

    if (this.content && this.content.length > 10000) {
      errors.push('Content cannot exceed 10,000 characters');
    }

    // Task ID validation
    if (!this.taskId) {
      errors.push('Task ID is required');
    }

    // User ID validation
    if (!this.userId) {
      errors.push('User ID is required');
    }

    // Depth validation
    if (this.depth < 0) {
      errors.push('Depth cannot be negative');
    }

    if (this.depth > 10) {
      errors.push('Depth cannot exceed 10');
    }

    // Mentions validation
    if (this.mentions && this.mentions.length > 10) {
      errors.push('Cannot mention more than 10 users');
    }

    // Parent comment validation
    if (this.parentCommentId && this.depth === 0) {
      errors.push('Root comments (depth 0) cannot have a parent comment');
    }

    if (!this.parentCommentId && this.depth > 0) {
      errors.push('Non-root comments must have a parent comment');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
