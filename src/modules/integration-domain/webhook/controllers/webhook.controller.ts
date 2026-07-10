import {
  Controller,
  Get,
  Post,
  Put,
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
import { WebhookService } from '../services/webhook.service';
import {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionResponseDto,
  WebhookCreatedResponseDto,
  WebhookDeliveryResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../user-domain/decorators/current-user.decorator';

/**
 * Webhook Controller
 *
 * Endpoints for webhook subscription management:
 * - Create webhook subscriptions
 * - List and manage subscriptions
 * - View delivery history
 * - Regenerate secrets
 *
 * Security:
 * - All endpoints require authentication (JWT Bearer token)
 * - Users can only manage their own webhook subscriptions
 * - Secrets only shown once at creation
 *
 * @tag Webhooks
 */
@ApiTags('Webhooks')
@Controller('api/v1/webhooks')
@ApiBearerAuth()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Create a new webhook subscription
   */
  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a new webhook subscription' })
  @ApiResponse({
    status: 201,
    description: 'Webhook subscription created successfully',
    type: WebhookCreatedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  async createSubscription(
    @Body() createDto: CreateWebhookSubscriptionDto,
    @CurrentUser() user: any,
  ): Promise<WebhookCreatedResponseDto> {
    const subscription = await this.webhookService.createSubscription(createDto, user.id);

    // Return subscription with secret (only time it's shown)
    return plainToInstance(WebhookCreatedResponseDto, subscription, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * List all webhook subscriptions for current user
   */
  @Get('subscriptions')
  @ApiOperation({ summary: 'List all webhook subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscriptions retrieved successfully',
    type: [WebhookSubscriptionResponseDto],
  })
  async listSubscriptions(@CurrentUser() user: any): Promise<WebhookSubscriptionResponseDto[]> {
    const subscriptions = await this.webhookService.listSubscriptions(user.id);

    return subscriptions.map((sub) =>
      plainToInstance(WebhookSubscriptionResponseDto, sub, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Get a specific webhook subscription
   */
  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get a webhook subscription by ID' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription retrieved successfully',
    type: WebhookSubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async getSubscription(@Param('id') id: string): Promise<WebhookSubscriptionResponseDto> {
    const subscription = await this.webhookService.getSubscription(id);

    return plainToInstance(WebhookSubscriptionResponseDto, subscription, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Update a webhook subscription
   */
  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription updated successfully',
    type: WebhookSubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookSubscriptionDto,
    @CurrentUser() user: any,
  ): Promise<WebhookSubscriptionResponseDto> {
    const subscription = await this.webhookService.updateSubscription(id, updateDto, user.id);

    return plainToInstance(WebhookSubscriptionResponseDto, subscription, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Delete a webhook subscription
   */
  @Delete('subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiResponse({
    status: 204,
    description: 'Webhook subscription deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async deleteSubscription(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    await this.webhookService.deleteSubscription(id, user.id);
  }

  /**
   * Regenerate webhook secret
   */
  @Post('subscriptions/:id/regenerate-secret')
  @ApiOperation({ summary: 'Regenerate webhook secret for a subscription' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook secret regenerated successfully',
    type: WebhookCreatedResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async regenerateSecret(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<WebhookCreatedResponseDto> {
    const subscription = await this.webhookService.regenerateSecret(id, user.id);

    // Return subscription with new secret (only time it's shown)
    return plainToInstance(WebhookCreatedResponseDto, subscription, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get webhook delivery history for a subscription
   */
  @Get('subscriptions/:id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiParam({ name: 'id', description: 'Webhook subscription ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of deliveries to return (default: 50, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook deliveries retrieved successfully',
    type: [WebhookDeliveryResponseDto],
  })
  async getDeliveryHistory(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<WebhookDeliveryResponseDto[]> {
    // Validate limit
    const validLimit = Math.min(Math.max(limit, 1), 100);

    const deliveries = await this.webhookService.getDeliveryHistory(id, validLimit);

    return deliveries.map((delivery) =>
      plainToInstance(WebhookDeliveryResponseDto, delivery, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Get a specific webhook delivery
   */
  @Get('deliveries/:id')
  @ApiOperation({ summary: 'Get a webhook delivery by ID' })
  @ApiParam({ name: 'id', description: 'Webhook delivery ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook delivery retrieved successfully',
    type: WebhookDeliveryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook delivery not found' })
  async getDelivery(@Param('id') id: string): Promise<WebhookDeliveryResponseDto> {
    const delivery = await this.webhookService.getDelivery(id);

    return plainToInstance(WebhookDeliveryResponseDto, delivery, {
      excludeExtraneousValues: true,
    });
  }
}
