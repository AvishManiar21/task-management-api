import {
  Controller,
  Get,
  Post,
  Put,
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
import { ApiKeyService } from '../services/api-key.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../user-domain/decorators/current-user.decorator';

/**
 * API Key Controller
 *
 * Endpoints for API key management:
 * - Create API keys for external integrations
 * - List and manage API keys
 * - Revoke keys
 * - Track key usage
 *
 * Security:
 * - All endpoints require authentication (JWT Bearer token)
 * - Users can only manage their own API keys
 * - Plain text keys only shown once at creation
 * - Keys are stored as hashed values (bcrypt)
 *
 * API Key Format:
 * - Production: tmsk_live_<random-64-chars>
 * - Testing: tmsk_test_<random-64-chars>
 *
 * @tag API Keys
 */
@ApiTags('API Keys')
@Controller('api/v1/api-keys')
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Create a new API key
   */
  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: ApiKeyCreatedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid API key data' })
  async createApiKey(
    @Body() createDto: CreateApiKeyDto,
    @CurrentUser() user: any,
  ): Promise<ApiKeyCreatedResponseDto> {
    const { plainKey, apiKey } = await this.apiKeyService.createApiKey(createDto, user.id);

    // Return response with plain key (only time it's shown)
    const response = plainToInstance(ApiKeyCreatedResponseDto, apiKey, {
      excludeExtraneousValues: true,
    }) as ApiKeyCreatedResponseDto;
    response.key = plainKey; // Add plain key to response

    return response;
  }

  /**
   * List all API keys for current user
   */
  @Get()
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({
    status: 200,
    description: 'API keys retrieved successfully',
    type: [ApiKeyResponseDto],
  })
  async listApiKeys(@CurrentUser() user: any): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.apiKeyService.listApiKeys(user.id);

    return apiKeys.map((key) =>
      plainToInstance(ApiKeyResponseDto, key, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Get a specific API key
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get an API key by ID' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key retrieved successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getApiKey(@Param('id') id: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeyService.getApiKey(id);

    return plainToInstance(ApiKeyResponseDto, apiKey, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Update an API key
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateApiKey(
    @Param('id') id: string,
    @Body() updateDto: UpdateApiKeyDto,
    @CurrentUser() user: any,
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.apiKeyService.updateApiKey(id, updateDto, user.id);

    return plainToInstance(ApiKeyResponseDto, apiKey, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Revoke an API key
   */
  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key revoked successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    await this.apiKeyService.revokeApiKey(id, user.id);
  }

  /**
   * Delete an API key
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 204,
    description: 'API key deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deleteApiKey(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    await this.apiKeyService.deleteApiKey(id, user.id);
  }

  /**
   * Get expiring API keys
   */
  @Get('expiring/:days')
  @ApiOperation({ summary: 'Get API keys expiring within specified days' })
  @ApiParam({ name: 'days', description: 'Number of days to look ahead (default: 30)' })
  @ApiResponse({
    status: 200,
    description: 'Expiring API keys retrieved successfully',
    type: [ApiKeyResponseDto],
  })
  async getExpiringKeys(@Param('days') days: string): Promise<ApiKeyResponseDto[]> {
    const daysNumber = parseInt(days, 10) || 30;
    const apiKeys = await this.apiKeyService.findExpiringKeys(daysNumber);

    return apiKeys.map((key) =>
      plainToInstance(ApiKeyResponseDto, key, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Get unused API keys
   */
  @Get('unused/:days')
  @ApiOperation({ summary: 'Get API keys not used for specified days' })
  @ApiParam({ name: 'days', description: 'Number of days to look back (default: 90)' })
  @ApiResponse({
    status: 200,
    description: 'Unused API keys retrieved successfully',
    type: [ApiKeyResponseDto],
  })
  async getUnusedKeys(@Param('days') days: string): Promise<ApiKeyResponseDto[]> {
    const daysNumber = parseInt(days, 10) || 90;
    const apiKeys = await this.apiKeyService.findUnusedKeys(daysNumber);

    return apiKeys.map((key) =>
      plainToInstance(ApiKeyResponseDto, key, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
