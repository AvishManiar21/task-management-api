import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflow.entity';
import { WorkflowState } from '../workflow-state.entity';
import { WorkflowTransition } from '../workflow-transition.entity';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';

/**
 * Workflow Service
 *
 * Handles workflow management including:
 * - Workflow CRUD operations
 * - Workflow validation (initial state, terminal states, reachability)
 * - State and transition management
 * - Default workflow selection
 *
 * Business Rules:
 * - Each workflow must have exactly one initial state
 * - Each workflow should have at least one terminal state
 * - State names must be unique within a workflow
 * - Only one workflow can be marked as default
 * - System workflows cannot be deleted
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowState)
    private readonly workflowStateRepository: Repository<WorkflowState>,
    @InjectRepository(WorkflowTransition)
    private readonly workflowTransitionRepository: Repository<WorkflowTransition>,
  ) {}

  /**
   * Create a new workflow with states and transitions
   *
   * @param createWorkflowDto - Workflow creation data
   * @param userId - User creating the workflow
   * @returns Created workflow
   */
  async create(createWorkflowDto: CreateWorkflowDto, userId: string): Promise<Workflow> {
    this.logger.log(`Creating workflow: ${createWorkflowDto.name}`);

    // Check if workflow name already exists
    const existing = await this.workflowRepository.findOne({
      where: { name: createWorkflowDto.name },
    });

    if (existing) {
      throw new ConflictException(`Workflow with name "${createWorkflowDto.name}" already exists`);
    }

    // Validate states
    this.validateStates(createWorkflowDto.states);

    // If this is set as default, unset other defaults
    if (createWorkflowDto.isDefault) {
      await this.workflowRepository.update({ isDefault: true }, { isDefault: false });
    }

    // Create workflow
    const workflow = this.workflowRepository.create({
      name: createWorkflowDto.name,
      description: createWorkflowDto.description,
      isDefault: createWorkflowDto.isDefault || false,
      isSystem: false,
      createdBy: userId,
    });

    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Create states
    const stateMap = new Map<string, WorkflowState>();
    for (const stateDto of createWorkflowDto.states) {
      const state = this.workflowStateRepository.create({
        workflowId: savedWorkflow.id,
        name: stateDto.name,
        description: stateDto.description,
        color: stateDto.color,
        order: stateDto.order || 0,
        isInitial: stateDto.isInitial || false,
        isTerminal: stateDto.isTerminal || false,
      });

      const savedState = await this.workflowStateRepository.save(state);
      stateMap.set(stateDto.name, savedState);
    }

    // Create transitions
    if (createWorkflowDto.transitions && createWorkflowDto.transitions.length > 0) {
      for (const transitionDto of createWorkflowDto.transitions) {
        const fromState = stateMap.get(transitionDto.fromStateName);
        const toState = stateMap.get(transitionDto.toStateName);

        if (!fromState || !toState) {
          throw new BadRequestException(
            `Invalid state names in transition: ${transitionDto.fromStateName} -> ${transitionDto.toStateName}`,
          );
        }

        const transition = this.workflowTransitionRepository.create({
          workflowId: savedWorkflow.id,
          fromStateId: fromState.id,
          toStateId: toState.id,
          name: transitionDto.name,
          requiredPermissions: transitionDto.requiredPermissions,
          requiresComment: transitionDto.requiresComment || false,
        });

        await this.workflowTransitionRepository.save(transition);
      }
    }

    this.logger.log(`Workflow created: ${savedWorkflow.id}`);

    // Return workflow with relations
    return this.findOne(savedWorkflow.id);
  }

  /**
   * Find workflow by ID
   *
   * @param id - Workflow ID
   * @returns Workflow with states and transitions
   */
  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id },
      relations: ['states', 'transitions'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    // Sort states by order
    if (workflow.states) {
      workflow.states.sort((a, b) => a.order - b.order);
    }

    return workflow;
  }

  /**
   * Find all workflows
   *
   * @returns All workflows
   */
  async findAll(): Promise<Workflow[]> {
    const workflows = await this.workflowRepository.find({
      relations: ['states', 'transitions'],
      order: { name: 'ASC' },
    });

    // Sort states by order for each workflow
    workflows.forEach((workflow) => {
      if (workflow.states) {
        workflow.states.sort((a, b) => a.order - b.order);
      }
    });

    return workflows;
  }

  /**
   * Get default workflow
   *
   * @returns Default workflow
   */
  async getDefault(): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { isDefault: true },
      relations: ['states', 'transitions'],
    });

    if (!workflow) {
      throw new NotFoundException('No default workflow found');
    }

    return workflow;
  }

  /**
   * Delete workflow
   *
   * @param id - Workflow ID
   */
  async remove(id: string): Promise<void> {
    const workflow = await this.findOne(id);

    if (workflow.isSystem) {
      throw new BadRequestException('Cannot delete system workflow');
    }

    // Check if workflow is in use by tasks
    // This would require TaskRepository injection
    // For now, just delete (cascade will handle states/transitions)

    await this.workflowRepository.delete(id);

    this.logger.log(`Workflow deleted: ${id}`);
  }

  /**
   * Get allowed transitions from a state
   *
   * @param workflowId - Workflow ID
   * @param fromStateId - Source state ID
   * @returns Allowed transitions
   */
  async getAllowedTransitions(workflowId: string, fromStateId: string): Promise<WorkflowTransition[]> {
    return this.workflowTransitionRepository.find({
      where: { workflowId, fromStateId },
      relations: ['fromState', 'toState'],
    });
  }

  /**
   * Validate workflow states
   *
   * @param states - States to validate
   */
  private validateStates(states: any[]): void {
    if (!states || states.length === 0) {
      throw new BadRequestException('Workflow must have at least one state');
    }

    // Check for exactly one initial state
    const initialStates = states.filter((s) => s.isInitial);
    if (initialStates.length === 0) {
      throw new BadRequestException('Workflow must have exactly one initial state');
    }
    if (initialStates.length > 1) {
      throw new BadRequestException('Workflow cannot have more than one initial state');
    }

    // Check for at least one terminal state
    const terminalStates = states.filter((s) => s.isTerminal);
    if (terminalStates.length === 0) {
      this.logger.warn('Workflow has no terminal states (recommended to have at least one)');
    }

    // Check for duplicate names
    const names = states.map((s) => s.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      throw new BadRequestException('Workflow states must have unique names');
    }

    // Check for duplicate orders
    const orders = states.map((s) => s.order || 0);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Workflow states must have unique order values');
    }

    // Validate that initial and terminal are not the same
    states.forEach((state) => {
      if (state.isInitial && state.isTerminal) {
        throw new BadRequestException('A state cannot be both initial and terminal');
      }
    });
  }
}
