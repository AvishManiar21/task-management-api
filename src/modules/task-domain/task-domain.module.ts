import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Task } from './task/task.entity';
import { Workflow } from './workflow/workflow.entity';
import { WorkflowState } from './workflow/workflow-state.entity';
import { WorkflowTransition } from './workflow/workflow-transition.entity';
import { TaskTemplate } from './template/task-template.entity';
import { TaskDependency } from './dependency/task-dependency.entity';
import { Comment } from './comment/comment.entity';
import { Attachment } from './attachment/attachment.entity';
import { TaskHistory } from './history/task-history.entity';

// Services
import { TaskService } from './task/services/task.service';
import { WorkflowService } from './workflow/services/workflow.service';

// Controllers
import { TaskController } from './task/controllers/task.controller';
import { WorkflowController } from './workflow/controllers/workflow.controller';

/**
 * Task Domain Module
 *
 * Encapsulates all task management functionality including:
 * - Task CRUD operations
 * - Workflow management
 * - Task templates
 * - Comments and attachments
 * - Task dependencies
 * - Audit history
 *
 * Entities: 9 total
 * - Task (core entity)
 * - Workflow, WorkflowState, WorkflowTransition
 * - TaskTemplate
 * - TaskDependency
 * - Comment
 * - Attachment
 * - TaskHistory
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Core entities
      Task,
      Workflow,
      WorkflowState,
      WorkflowTransition,
      TaskTemplate,
      TaskDependency,
      Comment,
      Attachment,
      TaskHistory,
    ]),
  ],
  controllers: [
    TaskController,
    WorkflowController,
  ],
  providers: [
    TaskService,
    WorkflowService,
  ],
  exports: [
    TaskService,
    WorkflowService,
  ],
})
export class TaskDomainModule {}
