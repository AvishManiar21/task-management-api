import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

/**
 * NotificationTemplate Entity
 *
 * Stores reusable notification templates with variable substitution.
 *
 * Features:
 * - Named templates for consistency
 * - Variable placeholders (e.g., {{taskTitle}}, {{userName}})
 * - Channel-specific templates (email, in-app)
 * - Subject line for email notifications
 * - Variable metadata stored as JSONB
 *
 * Business Rules:
 * - Template name must be unique
 * - Variables JSONB contains metadata about placeholders
 * - Body supports {{variable}} syntax
 *
 * Indexes:
 * - name (unique) - Fast lookup by template name
 *
 * Related Entities:
 * - None (templates are standalone configurations)
 */
@Entity('notification_template')
@Index(['name'], { unique: true })
export class NotificationTemplate {
  /**
   * Primary key (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Template name (unique identifier)
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  @Index({ unique: true })
  name: string;

  /**
   * Notification type
   */
  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  /**
   * Delivery channel
   */
  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  /**
   * Email subject line
   * Used when sending email notifications
   */
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  /**
   * Template body with variable placeholders
   * Example: "Hello {{userName}}, task {{taskTitle}} is due soon."
   */
  @Column({ type: 'text' })
  body: string;

  /**
   * Variable metadata (JSONB)
   * Example: { "userName": "string", "taskTitle": "string", "dueDate": "date" }
   */
  @Column({ type: 'jsonb', nullable: true })
  variables: Record<string, any> | null;

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

  /**
   * Render template with variable substitution
   * @param variables - Key-value pairs for substitution
   * @returns Rendered template
   */
  render(variables: Record<string, any>): { subject: string; body: string } {
    let renderedSubject = this.subject;
    let renderedBody = this.body;

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), String(value));
      renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }

  /**
   * Validate that all required variables are provided
   * @param variables - Variables to validate
   * @returns true if all required variables present
   */
  validateVariables(variables: Record<string, any>): boolean {
    if (!this.variables) {
      return true;
    }
    return Object.keys(this.variables).every((varName) => varName in variables);
  }
}
