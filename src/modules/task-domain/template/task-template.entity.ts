import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workflow } from '../workflow/workflow.entity';
import { Priority } from '../enums/priority.enum';
import * as Mustache from 'mustache';

/**
 * Template Variable Definition
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  default?: any;
  description?: string;
}

/**
 * TaskTemplate Entity
 *
 * Reusable task templates with variable placeholders.
 * Templates use Mustache syntax for variable substitution: {{variable_name}}
 *
 * Use Cases:
 * - Standard operating procedures (SOPs)
 * - Recurring project setup tasks
 * - Onboarding checklists
 * - Bug report templates
 *
 * Business Rules:
 * - Template names must be unique
 * - Variables must be defined in the variables field
 * - Title template is required
 * - All required variables must be provided during instantiation
 * - Variable syntax: {{variable_name}}
 *
 * @see Workflow
 * @example
 * Template:
 *   titleTemplate: "Setup {{project_name}} environment"
 *   variables: [{ name: "project_name", type: "string", required: true }]
 * Instantiation:
 *   variables: { project_name: "MyApp" }
 * Result:
 *   title: "Setup MyApp environment"
 */
@Entity('task_template')
export class TaskTemplate {
  /**
   * Unique identifier (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Template name (unique across system)
   * @example "Bug Report", "Feature Request", "Deployment Checklist"
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /**
   * Template description
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Title template with Mustache variables
   * @example "Setup {{project_name}} environment"
   */
  @Column({ type: 'varchar', length: 255, name: 'title_template' })
  titleTemplate: string;

  /**
   * Description template with Mustache variables
   * @example "Configure development environment for {{project_name}}. Complete within {{due_days}} days."
   */
  @Column({ type: 'text', nullable: true, name: 'description_template' })
  descriptionTemplate: string;

  /**
   * Default priority for tasks created from this template
   */
  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM, name: 'default_priority' })
  defaultPriority: Priority;

  /**
   * Default tags for tasks created from this template
   */
  @Column({ type: 'simple-array', nullable: true, name: 'default_tags' })
  defaultTags: string[];

  /**
   * Default workflow ID
   */
  @Column({ type: 'uuid', name: 'default_workflow_id' })
  defaultWorkflowId: string;

  /**
   * Default estimated hours
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'estimated_hours' })
  estimatedHours: number;

  /**
   * Variable definitions
   * Defines all variables used in title and description templates
   *
   * @example
   * [
   *   { name: "project_name", type: "string", required: true, description: "Name of the project" },
   *   { name: "due_days", type: "number", required: false, default: 7, description: "Days until due" }
   * ]
   */
  @Column({ type: 'jsonb' })
  variables: TemplateVariable[];

  /**
   * Custom fields template (JSONB)
   * Template for custom fields with variable substitution
   */
  @Column({ type: 'jsonb', nullable: true, name: 'custom_fields_template' })
  customFieldsTemplate: Record<string, any>;

  /**
   * Creator user ID
   */
  @Column({ type: 'uuid', name: 'created_by' })
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
  // Relationships
  // ===========================

  /**
   * Default workflow
   */
  @ManyToOne(() => Workflow)
  @JoinColumn({ name: 'default_workflow_id' })
  defaultWorkflow: Workflow;

  // ===========================
  // Business Methods
  // ===========================

  /**
   * Validate provided variables against template definition
   *
   * @param variables - Variable values for instantiation
   * @returns Validation result
   */
  validateVariables(variables: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.variables) {
      return { valid: true, errors: [] };
    }

    // Check all required variables are provided
    this.variables
      .filter((v) => v.required)
      .forEach((variable) => {
        if (variables[variable.name] === undefined || variables[variable.name] === null) {
          errors.push(`Required variable "${variable.name}" is missing`);
        }
      });

    // Check variable types
    Object.keys(variables).forEach((key) => {
      const variableDefinition = this.variables.find((v) => v.name === key);
      if (!variableDefinition) {
        errors.push(`Unknown variable "${key}" (not defined in template)`);
        return;
      }

      const value = variables[key];
      const actualType = typeof value;

      // Type checking
      switch (variableDefinition.type) {
        case 'string':
          if (actualType !== 'string') {
            errors.push(`Variable "${key}" must be a string`);
          }
          break;
        case 'number':
          if (actualType !== 'number') {
            errors.push(`Variable "${key}" must be a number`);
          }
          break;
        case 'boolean':
          if (actualType !== 'boolean') {
            errors.push(`Variable "${key}" must be a boolean`);
          }
          break;
        case 'date':
          if (!(value instanceof Date) && typeof value !== 'string') {
            errors.push(`Variable "${key}" must be a date`);
          }
          break;
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract all variable names from templates
   *
   * @returns Array of variable names found in templates
   */
  extractVariables(): string[] {
    const titleVars = this.extractFromString(this.titleTemplate);
    const descVars = this.descriptionTemplate
      ? this.extractFromString(this.descriptionTemplate)
      : [];

    const allVars = [...titleVars, ...descVars];
    return [...new Set(allVars)]; // Remove duplicates
  }

  /**
   * Extract variable names from a Mustache template string
   *
   * @param template - Template string
   * @returns Array of variable names
   */
  private extractFromString(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  /**
   * Render title with provided variables
   *
   * @param variables - Variable values
   * @returns Rendered title
   */
  renderTitle(variables: Record<string, any>): string {
    const mergedVariables = this.getMergedVariables(variables);
    return Mustache.render(this.titleTemplate, mergedVariables);
  }

  /**
   * Render description with provided variables
   *
   * @param variables - Variable values
   * @returns Rendered description (or null if no template)
   */
  renderDescription(variables: Record<string, any>): string | null {
    if (!this.descriptionTemplate) {
      return null;
    }
    const mergedVariables = this.getMergedVariables(variables);
    return Mustache.render(this.descriptionTemplate, mergedVariables);
  }

  /**
   * Merge provided variables with defaults
   *
   * @param variables - User-provided variables
   * @returns Merged variables with defaults applied
   */
  private getMergedVariables(variables: Record<string, any>): Record<string, any> {
    const merged: Record<string, any> = {};

    // Apply defaults first
    if (this.variables) {
      this.variables.forEach((varDef) => {
        if (varDef.default !== undefined) {
          merged[varDef.name] = varDef.default;
        }
      });
    }

    // Override with provided values
    Object.keys(variables).forEach((key) => {
      merged[key] = variables[key];
    });

    return merged;
  }

  /**
   * Create a task data object from this template
   * Note: Does not create the actual Task entity (service layer responsibility)
   *
   * @param variables - Variable values for instantiation
   * @returns Partial task data object
   */
  instantiate(variables: Record<string, any>): {
    title: string;
    description: string | null;
    priority: Priority;
    tags: string[];
    workflowId: string;
    estimatedHours: number | null;
    templateId: string;
  } {
    return {
      title: this.renderTitle(variables),
      description: this.renderDescription(variables),
      priority: this.defaultPriority,
      tags: this.defaultTags || [],
      workflowId: this.defaultWorkflowId,
      estimatedHours: this.estimatedHours || null,
      templateId: this.id,
    };
  }
}
