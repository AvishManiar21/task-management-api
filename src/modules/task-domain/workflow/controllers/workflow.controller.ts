import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../user-domain/decorators/current-user.decorator';

/**
 * Workflow Controller
 *
 * Endpoints for managing workflows, states, and transitions.
 *
 * @tag Workflows
 */
@ApiTags('Workflows')
@Controller('api/v1/workflows')
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Create a new workflow
   */
  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({
    status: 201,
    description: 'Workflow created successfully',
    type: WorkflowResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid workflow data' })
  @ApiResponse({ status: 409, description: 'Workflow name already exists' })
  async create(
    @Body() createWorkflowDto: CreateWorkflowDto,
    @CurrentUser() user: any,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.create(createWorkflowDto, user.id);
    return plainToInstance(WorkflowResponseDto, workflow, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get all workflows
   */
  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiResponse({
    status: 200,
    description: 'Workflows retrieved successfully',
    type: [WorkflowResponseDto],
  })
  async findAll(): Promise<WorkflowResponseDto[]> {
    const workflows = await this.workflowService.findAll();
    return plainToInstance(WorkflowResponseDto, workflows, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get default workflow
   */
  @Get('default')
  @ApiOperation({ summary: 'Get the default workflow' })
  @ApiResponse({
    status: 200,
    description: 'Default workflow retrieved successfully',
    type: WorkflowResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No default workflow found' })
  async getDefault(): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.getDefault();
    return plainToInstance(WorkflowResponseDto, workflow, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get workflow by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({
    status: 200,
    description: 'Workflow retrieved successfully',
    type: WorkflowResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findOne(@Param('id') id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.findOne(id);
    return plainToInstance(WorkflowResponseDto, workflow, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get allowed transitions from a state
   */
  @Get(':workflowId/states/:stateId/transitions')
  @ApiOperation({ summary: 'Get allowed transitions from a workflow state' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  @ApiParam({ name: 'stateId', description: 'Source state ID' })
  @ApiResponse({
    status: 200,
    description: 'Transitions retrieved successfully',
  })
  async getAllowedTransitions(
    @Param('workflowId') workflowId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.workflowService.getAllowedTransitions(workflowId, stateId);
  }

  /**
   * Delete workflow
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 204, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete system workflow' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.workflowService.remove(id);
  }
}
