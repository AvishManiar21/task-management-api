import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, IsNull } from 'typeorm';
import { Task } from '../task.entity';
import { Workflow } from '../../workflow/workflow.entity';
import { WorkflowState } from '../../workflow/workflow-state.entity';
import { TaskTemplate } from '../../template/task-template.entity';
import { TaskHistory } from '../../history/task-history.entity';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { Priority } from '../../enums/priority.enum';
import { ChangeType } from '../../enums/change-type.enum';

/**
 * Task Service
 *
 * Handles all business logic for task management including:
 * - CRUD operations
 * - Workflow state transitions
 * - Template instantiation
 * - Subtask management
 * - Audit trail creation
 *
 * Business Rules Enforced:
 * - Title: 1-255 characters
 * - Tags: Max 50 tags, each max 50 characters
 * - Custom fields: Max 16KB
 * - Optimistic locking: Version check on updates
 * - Workflow validation: Ensure valid transitions
 * - Assignment validation: Verify user exists and has permission
 */
@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowState)
    private readonly workflowStateRepository: Repository<WorkflowState>,
    @InjectRepository(TaskTemplate)
    private readonly taskTemplateRepository: Repository<TaskTemplate>,
    @InjectRepository(TaskHistory)
    private readonly taskHistoryRepository: Repository<TaskHistory>,
  ) {}

  /**
   * Create a new task
   *
   * @param createTaskDto - Task creation data
   * @param userId - User creating the task
   * @returns Created task
   */
  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    this.logger.log(`Creating task: ${createTaskDto.title}`);

    // Handle template instantiation
    if (createTaskDto.templateId) {
      return this.createFromTemplate(
        createTaskDto.templateId,
        createTaskDto.templateVariables || {},
        userId,
        createTaskDto,
      );
    }

    // Get default workflow if not specified
    let workflowId = createTaskDto.workflowId;
    let currentStateId = createTaskDto.currentStateId;

    if (!workflowId) {
      const defaultWorkflow = await this.workflowRepository.findOne({
        where: { isDefault: true },
        relations: ['states'],
      });

      if (!defaultWorkflow) {
        throw new NotFoundException('No default workflow found');
      }

      workflowId = defaultWorkflow.id;
      const initialState = defaultWorkflow.states.find((s) => s.isInitial);
      if (!initialState) {
        throw new BadRequestException('Default workflow has no initial state');
      }
      currentStateId = initialState.id;
    }

    // Validate current state belongs to workflow
    if (currentStateId) {
      const state = await this.workflowStateRepository.findOne({
        where: { id: currentStateId, workflowId },
      });
      if (!state) {
        throw new BadRequestException('Invalid workflow state for this workflow');
      }
    }

    // Validate parent task exists (if specified)
    if (createTaskDto.parentTaskId) {
      const parentTask = await this.taskRepository.findOne({
        where: { id: createTaskDto.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException(`Parent task ${createTaskDto.parentTaskId} not found`);
      }

      // Check subtask depth
      const depth = await this.calculateSubtaskDepth(createTaskDto.parentTaskId);
      if (depth >= 5) {
        throw new BadRequestException('Maximum subtask depth (5 levels) exceeded');
      }
    }

    // Validate custom fields size
    if (createTaskDto.customFields) {
      const size = JSON.stringify(createTaskDto.customFields).length;
      if (size > 16384) {
        throw new BadRequestException('Custom fields exceed 16KB limit');
      }
    }

    // Validate tags
    if (createTaskDto.tags && createTaskDto.tags.length > 50) {
      throw new BadRequestException('Cannot have more than 50 tags');
    }

    // Create task entity
    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      workflowId,
      currentStateId,
      priority: createTaskDto.priority || Priority.MEDIUM,
      assigneeId: createTaskDto.assigneeId,
      creatorId: userId,
      dueDate: createTaskDto.dueDate,
      tags: createTaskDto.tags,
      customFields: createTaskDto.customFields,
      parentTaskId: createTaskDto.parentTaskId,
      isRecurring: createTaskDto.isRecurring || false,
      recurrencePattern: createTaskDto.recurrencePattern,
      estimatedHours: createTaskDto.estimatedHours,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
    });

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Create audit history record
    await this.createHistoryRecord(
      savedTask.id,
      ChangeType.CREATE,
      null,
      null,
      savedTask,
      userId,
    );

    this.logger.log(`Task created: ${savedTask.id}`);
    return savedTask;
  }

  /**
   * Create task from template
   *
   * @param templateId - Template ID
   * @param variables - Template variables
   * @param userId - User creating the task
   * @param overrides - Optional overrides
   * @returns Created task
   */
  async createFromTemplate(
    templateId: string,
    variables: Record<string, any>,
    userId: string,
    overrides?: Partial<CreateTaskDto>,
  ): Promise<Task> {
    this.logger.log(`Creating task from template: ${templateId}`);

    // Load template
    const template = await this.taskTemplateRepository.findOne({
      where: { id: templateId },
      relations: ['defaultWorkflow'],
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    // Validate variables
    const validation = template.validateVariables(variables);
    if (!validation.valid) {
      throw new BadRequestException(`Template variable validation failed: ${validation.errors.join(', ')}`);
    }

    // Instantiate template
    const taskData = template.instantiate(variables);

    // Create task with template data and overrides
    const createDto: CreateTaskDto = {
      title: overrides?.title || taskData.title,
      description: overrides?.description || (taskData.description ?? undefined),
      workflowId: overrides?.workflowId || taskData.workflowId,
      priority: overrides?.priority || taskData.priority,
      tags: overrides?.tags || taskData.tags,
      estimatedHours: overrides?.estimatedHours ?? (taskData.estimatedHours ?? undefined),
      templateId: templateId,
      assigneeId: overrides?.assigneeId,
      dueDate: overrides?.dueDate,
      parentTaskId: overrides?.parentTaskId,
      customFields: overrides?.customFields,
    };

    return this.create(createDto, userId);
  }

  /**
   * Find task by ID
   *
   * @param id - Task ID
   * @param relations - Relations to load
   * @returns Task entity
   */
  async findOne(id: string, relations: string[] = []): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations,
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }

  /**
   * Find all tasks with filters and pagination
   *
   * @param filters - Query filters
   * @param page - Page number (1-based)
   * @param pageSize - Page size (default 20, max 100)
   * @returns Paginated tasks
   */
  async findAll(
    filters: {
      assigneeId?: string;
      creatorId?: string;
      workflowId?: string;
      currentStateId?: string;
      priority?: Priority;
      isOverdue?: boolean;
      isCompleted?: boolean;
      parentTaskId?: string;
      tags?: string[];
      search?: string;
    },
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ tasks: Task[]; total: number }> {
    const where: FindOptionsWhere<Task> = {};

    // Apply filters
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.creatorId) where.creatorId = filters.creatorId;
    if (filters.workflowId) where.workflowId = filters.workflowId;
    if (filters.currentStateId) where.currentStateId = filters.currentStateId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.parentTaskId !== undefined) {
      where.parentTaskId = filters.parentTaskId === 'null' ? IsNull() : filters.parentTaskId;
    }

    // Handle completed filter
    if (filters.isCompleted !== undefined) {
      where.completedAt = filters.isCompleted ? Not(IsNull()) : IsNull();
    }

    // Pagination
    const skip = (page - 1) * Math.min(pageSize, 100);
    const take = Math.min(pageSize, 100);

    const [tasks, total] = await this.taskRepository.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC' },
    });

    return { tasks, total };
  }

  /**
   * Update task
   *
   * @param id - Task ID
   * @param updateTaskDto - Update data
   * @param userId - User making the update
   * @returns Updated task
   */
  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    this.logger.log(`Updating task: ${id}`);

    // Load existing task
    const task = await this.findOne(id);

    // Optimistic locking check
    if (task.version !== updateTaskDto.version) {
      throw new ConflictException(
        `Task was modified by another user. Expected version ${updateTaskDto.version}, but current version is ${task.version}`,
      );
    }

    // Track changes for audit
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // Apply updates and track changes
    if (updateTaskDto.title !== undefined && updateTaskDto.title !== task.title) {
      changes.push({ field: 'title', oldValue: task.title, newValue: updateTaskDto.title });
      task.title = updateTaskDto.title;
    }

    if (updateTaskDto.description !== undefined && updateTaskDto.description !== task.description) {
      changes.push({ field: 'description', oldValue: task.description, newValue: updateTaskDto.description });
      task.description = updateTaskDto.description;
    }

    if (updateTaskDto.priority !== undefined && updateTaskDto.priority !== task.priority) {
      changes.push({ field: 'priority', oldValue: task.priority, newValue: updateTaskDto.priority });
      task.priority = updateTaskDto.priority;
    }

    if (updateTaskDto.assigneeId !== undefined && updateTaskDto.assigneeId !== task.assigneeId) {
      changes.push({ field: 'assigneeId', oldValue: task.assigneeId, newValue: updateTaskDto.assigneeId });
      task.assigneeId = updateTaskDto.assigneeId;
    }

    if (updateTaskDto.dueDate !== undefined) {
      const oldDate = task.dueDate?.toISOString();
      const newDate = updateTaskDto.dueDate?.toISOString();
      if (oldDate !== newDate) {
        changes.push({ field: 'dueDate', oldValue: task.dueDate, newValue: updateTaskDto.dueDate });
        task.dueDate = updateTaskDto.dueDate;
      }
    }

    if (updateTaskDto.tags !== undefined) {
      changes.push({ field: 'tags', oldValue: task.tags, newValue: updateTaskDto.tags });
      task.tags = updateTaskDto.tags;
    }

    if (updateTaskDto.customFields !== undefined) {
      changes.push({ field: 'customFields', oldValue: task.customFields, newValue: updateTaskDto.customFields });
      task.customFields = updateTaskDto.customFields;
    }

    if (updateTaskDto.estimatedHours !== undefined && updateTaskDto.estimatedHours !== task.estimatedHours) {
      changes.push({ field: 'estimatedHours', oldValue: task.estimatedHours, newValue: updateTaskDto.estimatedHours });
      task.estimatedHours = updateTaskDto.estimatedHours;
    }

    if (updateTaskDto.actualHours !== undefined && updateTaskDto.actualHours !== task.actualHours) {
      changes.push({ field: 'actualHours', oldValue: task.actualHours, newValue: updateTaskDto.actualHours });
      task.actualHours = updateTaskDto.actualHours;
    }

    if (updateTaskDto.recurrencePattern !== undefined) {
      changes.push({ field: 'recurrencePattern', oldValue: task.recurrencePattern, newValue: updateTaskDto.recurrencePattern });
      task.recurrencePattern = updateTaskDto.recurrencePattern;
    }

    // Increment version (optimistic locking)
    task.version += 1;
    task.updatedBy = userId;

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Create audit history records for each changed field
    for (const change of changes) {
      await this.createHistoryRecord(
        savedTask.id,
        ChangeType.UPDATE,
        change.field,
        change.oldValue,
        change.newValue,
        userId,
      );
    }

    this.logger.log(`Task updated: ${savedTask.id}, changes: ${changes.length}`);
    return savedTask;
  }

  /**
   * Transition task to new workflow state
   *
   * @param id - Task ID
   * @param transitionDto - Transition data
   * @param userId - User making the transition
   * @returns Updated task
   */
  async transition(id: string, transitionDto: TransitionTaskDto, userId: string): Promise<Task> {
    this.logger.log(`Transitioning task ${id} to state ${transitionDto.toStateId}`);

    // Load task with workflow
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['workflow', 'workflow.transitions'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    // Optimistic locking check
    if (task.version !== transitionDto.version) {
      throw new ConflictException('Task was modified by another user');
    }

    // Validate target state exists and belongs to same workflow
    const targetState = await this.workflowStateRepository.findOne({
      where: { id: transitionDto.toStateId, workflowId: task.workflowId },
    });

    if (!targetState) {
      throw new BadRequestException('Invalid target state for this workflow');
    }

    // Check if transition is allowed
    const canTransition = task.workflow.canTransition(task.currentStateId, transitionDto.toStateId);
    if (!canTransition) {
      throw new BadRequestException(
        `Transition from current state to target state is not allowed`,
      );
    }

    // Store old state for audit
    const oldStateId = task.currentStateId;

    // Update state
    task.currentStateId = transitionDto.toStateId;
    task.version += 1;
    task.updatedBy = userId;

    // If transitioning to terminal state, mark as completed
    if (targetState.isTerminal && !task.completedAt) {
      task.completedAt = new Date();
    }

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Create transition audit record
    await this.createHistoryRecord(
      savedTask.id,
      ChangeType.TRANSITION,
      'currentStateId',
      oldStateId,
      transitionDto.toStateId,
      userId,
    );

    this.logger.log(`Task transitioned: ${savedTask.id}`);
    return savedTask;
  }

  /**
   * Soft delete task
   *
   * @param id - Task ID
   * @param userId - User deleting the task
   */
  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id);

    // Soft delete
    await this.taskRepository.softDelete(id);

    // Create deletion audit record
    await this.createHistoryRecord(
      task.id,
      ChangeType.DELETE,
      'deletedAt',
      null,
      new Date(),
      userId,
    );

    this.logger.log(`Task soft-deleted: ${id}`);
  }

  /**
   * Calculate subtask depth
   *
   * @param parentTaskId - Parent task ID
   * @returns Depth level
   */
  private async calculateSubtaskDepth(parentTaskId: string): Promise<number> {
    let depth = 0;
    let currentId = parentTaskId;

    while (currentId && depth < 10) {
      const task = await this.taskRepository.findOne({
        where: { id: currentId },
        select: ['id', 'parentTaskId'],
      });

      if (!task || !task.parentTaskId) {
        break;
      }

      depth++;
      currentId = task.parentTaskId;
    }

    return depth;
  }

  /**
   * Create audit history record
   *
   * @param taskId - Task ID
   * @param changeType - Type of change
   * @param fieldName - Field name
   * @param oldValue - Old value
   * @param newValue - New value
   * @param userId - User making the change
   */
  private async createHistoryRecord(
    taskId: string,
    changeType: ChangeType,
    fieldName: string | null,
    oldValue: any,
    newValue: any,
    userId: string,
  ): Promise<void> {
    const history = this.taskHistoryRepository.create({
      taskId,
      changeType,
      fieldName,
      oldValue: oldValue !== null && oldValue !== undefined ? { value: oldValue } : null,
      newValue: newValue !== null && newValue !== undefined ? { value: newValue } : null,
      changedBy: userId,
    });

    await this.taskHistoryRepository.save(history);
  }
}
