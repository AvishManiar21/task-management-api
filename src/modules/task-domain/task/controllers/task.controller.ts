import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TaskService } from '../services/task.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { TaskResponseDto, TaskListResponseDto } from '../dto/task-response.dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../user-domain/decorators/current-user.decorator';
import { Priority } from '../../enums/priority.enum';

/**
 * Task Controller
 *
 * Endpoints for task management including:
 * - CRUD operations
 * - Workflow state transitions
 * - Filtering and searching
 * - Template instantiation
 *
 * @tag Tasks
 */
@ApiTags('Tasks')
@Controller('api/v1/tasks')
@ApiBearerAuth()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * Create a new task
   */
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid task data' })
  async create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: any,
  ): Promise<TaskResponseDto> {
    const task = await this.taskService.create(createTaskDto, user.id);

    const response = plainToInstance(TaskResponseDto, task, {
      excludeExtraneousValues: true,
    });

    // Add computed fields
    response.isOverdue = task.isOverdue();
    response.isCompleted = task.isCompleted();

    return response;
  }

  /**
   * Get all tasks with filters
   */
  @Get()
  @ApiOperation({ summary: 'Get all tasks with optional filters' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by assignee ID' })
  @ApiQuery({ name: 'creatorId', required: false, description: 'Filter by creator ID' })
  @ApiQuery({ name: 'workflowId', required: false, description: 'Filter by workflow ID' })
  @ApiQuery({ name: 'currentStateId', required: false, description: 'Filter by workflow state ID' })
  @ApiQuery({ name: 'priority', required: false, enum: Priority, description: 'Filter by priority' })
  @ApiQuery({ name: 'isCompleted', required: false, type: Boolean, description: 'Filter by completion status' })
  @ApiQuery({ name: 'parentTaskId', required: false, description: 'Filter by parent task ID (use "null" for root tasks)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default: 20, max: 100)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: TaskListResponseDto,
  })
  async findAll(
    @Query('assigneeId') assigneeId?: string,
    @Query('creatorId') creatorId?: string,
    @Query('workflowId') workflowId?: string,
    @Query('currentStateId') currentStateId?: string,
    @Query('priority') priority?: Priority,
    @Query('isCompleted') isCompleted?: boolean,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
  ): Promise<TaskListResponseDto> {
    const filters = {
      assigneeId,
      creatorId,
      workflowId,
      currentStateId,
      priority,
      isCompleted,
      parentTaskId,
    };

    const { tasks, total } = await this.taskService.findAll(filters, page, pageSize);

    const taskDtos = tasks.map((task) => {
      const dto = plainToInstance(TaskResponseDto, task, {
        excludeExtraneousValues: true,
      });
      dto.isOverdue = task.isOverdue();
      dto.isCompleted = task.isCompleted();
      return dto;
    });

    return {
      tasks: taskDtos,
      total,
      page: page || 1,
      pageSize: pageSize || 20,
      totalPages: Math.ceil(total / (pageSize || 20)),
    };
  }

  /**
   * Get task by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id') id: string): Promise<TaskResponseDto> {
    const task = await this.taskService.findOne(id, [
      'workflow',
      'currentState',
      'template',
    ]);

    const response = plainToInstance(TaskResponseDto, task, {
      excludeExtraneousValues: true,
    });

    response.isOverdue = task.isOverdue();
    response.isCompleted = task.isCompleted();

    return response;
  }

  /**
   * Update task
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Version conflict (task was modified)' })
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: any,
  ): Promise<TaskResponseDto> {
    const task = await this.taskService.update(id, updateTaskDto, user.id);

    const response = plainToInstance(TaskResponseDto, task, {
      excludeExtraneousValues: true,
    });

    response.isOverdue = task.isOverdue();
    response.isCompleted = task.isCompleted();

    return response;
  }

  /**
   * Transition task to new workflow state
   */
  @Patch(':id/transition')
  @ApiOperation({ summary: 'Transition task to a new workflow state' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task transitioned successfully',
    type: TaskResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 409, description: 'Version conflict (task was modified)' })
  async transition(
    @Param('id') id: string,
    @Body() transitionDto: TransitionTaskDto,
    @CurrentUser() user: any,
  ): Promise<TaskResponseDto> {
    const task = await this.taskService.transition(id, transitionDto, user.id);

    const response = plainToInstance(TaskResponseDto, task, {
      excludeExtraneousValues: true,
    });

    response.isOverdue = task.isOverdue();
    response.isCompleted = task.isCompleted();

    return response;
  }

  /**
   * Delete task (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task (soft delete)' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    await this.taskService.remove(id, user.id);
  }
}
