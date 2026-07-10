import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ConfigService } from '@common/config/config.service';
import { CacheService } from '@common/infrastructure/cache/cache.service';
import { LoggerService } from '@common/infrastructure/logging/logger.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import * as jose from 'jose';

jest.mock('jose');

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;
  let userService: jest.Mocked<UserService>;

  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    auth0Id: 'auth0|123456',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    picture: null,
    displayName: null,
    timezone: 'UTC',
    language: 'en',
    notificationPreferences: {},
    teamId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  } as User);

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    const mockRequest = {
      headers: authHeader ? { authorization: authHeader } : {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const mockConfigService = {
      getAuth0Config: jest.fn().mockReturnValue({
        domain: 'test.auth0.com',
        issuer: 'https://test.auth0.com/',
        audience: 'https://api.example.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockUserService = {
      getUserByAuth0Id: jest.fn(),
      getUserById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: UserService, useValue: mockUserService },
        { provide: LoggerService, useValue: { setContext: jest.fn(), log: jest.fn(), debug: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    configService = module.get(ConfigService);
    cacheService = module.get(CacheService);
    userService = module.get(UserService);
  });

  describe('canActivate', () => {
    it('should allow request with valid JWT', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const user = createMockUser();

      const mockPayload = { sub: user.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(user);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(jose.jwtVerify).toHaveBeenCalled();
      expect(userService.getUserByAuth0Id).toHaveBeenCalledWith(user.auth0Id);
    });

    it('should throw UnauthorizedException if no authorization header', async () => {
      // Arrange
      const context = createMockExecutionContext();

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing authorization token');
    });

    it('should throw UnauthorizedException if authorization header is malformed', async () => {
      // Arrange
      const context = createMockExecutionContext('InvalidHeader');

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing authorization token');
    });

    it('should throw UnauthorizedException if JWT verification fails', async () => {
      // Arrange
      const invalidToken = 'invalid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${invalidToken}`);

      (jose.jwtVerify as jest.Mock).mockRejectedValue(new Error('Invalid signature'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid authentication token');
    });

    it('should throw UnauthorizedException if user not found in local database', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);

      const mockPayload = { sub: 'auth0|nonexistent' };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(null);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid authentication token');
    });

    it('should throw UnauthorizedException if user is deactivated', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const deactivatedUser = createMockUser({ isActive: false });

      const mockPayload = { sub: deactivatedUser.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(deactivatedUser);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('User account is deactivated');
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const deletedUser = createMockUser({ deletedAt: new Date() });

      const mockPayload = { sub: deletedUser.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(deletedUser);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('User account is deleted');
    });

    it('should use cached user if available', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const user = createMockUser();

      const mockPayload = { sub: user.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(user);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(userService.getUserByAuth0Id).not.toHaveBeenCalled();
    });

    it('should cache user after loading from database', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const user = createMockUser();

      const mockPayload = { sub: user.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(user);

      // Act
      await guard.canActivate(context);

      // Assert
      expect(cacheService.set).toHaveBeenCalledWith(`user:auth0:${user.auth0Id}`, user, 300);
    });

    it('should attach user to request context', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const mockRequest = {
        headers: { authorization: `Bearer ${validToken}` },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;
      const user = createMockUser();

      const mockPayload = { sub: user.auth0Id };
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(user);

      // Act
      await guard.canActivate(context);

      // Assert
      expect((mockRequest as any).user).toEqual(user);
    });

    it('should verify JWT with correct configuration', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const context = createMockExecutionContext(`Bearer ${validToken}`);
      const user = createMockUser();

      const mockPayload = { sub: user.auth0Id };
      const mockJWKS = {};
      (jose.createRemoteJWKSet as jest.Mock).mockReturnValue(mockJWKS);
      (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      cacheService.get.mockResolvedValue(null);
      userService.getUserByAuth0Id.mockResolvedValue(user);

      // Act
      await guard.canActivate(context);

      // Assert
      expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://test.auth0.com/.well-known/jwks.json',
        }),
      );
      expect(jose.jwtVerify).toHaveBeenCalledWith(
        validToken,
        mockJWKS,
        expect.objectContaining({
          issuer: 'https://test.auth0.com/',
          audience: 'https://api.example.com',
          algorithms: ['RS256'],
        }),
      );
    });
  });
});
