import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { User as IUser } from '@prisma/client'
import request = require('supertest')

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthGuard } from '@shared/guards/auth.guard'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAuthService = {
  validateLogin: jest.fn(),
  login: jest.fn(),
  validateRegister: jest.fn(),
  register: jest.fn(),
  validateRefresh: jest.fn()
}

const userMock: IUser = {
  id: 'fake-id',
  email: 'test@example.com',
  password: 'hashed-password',
  createdAt: new Date(),
  updatedAt: new Date()
}

const tokensMock = {
  accessToken: 'mock-access-token',
  refreshToken: '1|mock-refresh-token'
}

// ─── Auth guard mock ─────────────────────────────────────────────────────────
// Passes when an Authorization header is present, blocks otherwise.
// Sets request.user so the @User() decorator works in authenticated routes.

class MockAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    if (!request.headers.authorization) {
      throw new UnauthorizedException({
        message: 'Authorization header is missing'
      })
    }

    request.user = userMock
    return true
  }
}

// ─── Main suite ───────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }]
    })
      .overrideGuard(AuthGuard)
      .useClass(MockAuthGuard)
      .compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await app.close()
  })

  // ─── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const validBody = { email: 'test@example.com', password: 'password123' }

    it('should return 200 and the tokens on success', async () => {
      // Arrange
      mockAuthService.validateLogin.mockResolvedValue(userMock)
      mockAuthService.login.mockResolvedValue(tokensMock)

      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .post('/auth/login')
        .send(validBody)
        .expect(200)

      expect(body).toEqual(tokensMock)
      expect(mockAuthService.validateLogin).toHaveBeenCalledWith(validBody)
      expect(mockAuthService.login).toHaveBeenCalledWith(userMock)
    })

    it('should return 400 when the body fails schema validation', async () => {
      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400)

      expect(body.error).toBe('A validation error occurred')
      expect(mockAuthService.validateLogin).not.toHaveBeenCalled()
    })

    it('should return 400 when required fields are missing', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400)

      expect(mockAuthService.validateLogin).not.toHaveBeenCalled()
    })

    it('should return 404 when credentials are invalid', async () => {
      // Arrange
      mockAuthService.validateLogin.mockRejectedValue(
        new NotFoundException({
          message: 'User with provided email and password does not exist'
        })
      )

      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(validBody)
        .expect(404)
    })
  })

  // ─── POST /auth/register ───────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    const validBody = { email: 'new@example.com', password: 'password123' }

    it('should return 201 and the tokens on success', async () => {
      // Arrange
      mockAuthService.validateRegister.mockResolvedValue(undefined)
      mockAuthService.register.mockResolvedValue(userMock)
      mockAuthService.login.mockResolvedValue(tokensMock)

      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validBody)
        .expect(201)

      expect(body).toEqual(tokensMock)
      expect(mockAuthService.validateRegister).toHaveBeenCalledWith(validBody)
      expect(mockAuthService.register).toHaveBeenCalledWith(validBody)
      expect(mockAuthService.login).toHaveBeenCalledWith(userMock)
    })

    it('should return 400 when the body fails schema validation', async () => {
      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400)

      expect(body.error).toBe('A validation error occurred')
      expect(mockAuthService.validateRegister).not.toHaveBeenCalled()
    })

    it('should return 422 when the email is already registered', async () => {
      // Arrange
      mockAuthService.validateRegister.mockRejectedValue(
        new UnprocessableEntityException({
          message: 'User with provided email already exists'
        })
      )

      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validBody)
        .expect(422)
    })
  })

  // ─── POST /auth/refresh ────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    const validBody = { refreshToken: '1|mock-refresh-token' }

    it('should return 200 and new tokens on success', async () => {
      // Arrange
      mockAuthService.validateRefresh.mockResolvedValue(userMock)
      mockAuthService.login.mockResolvedValue(tokensMock)

      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(validBody)
        .expect(200)

      expect(body).toEqual(tokensMock)
      expect(mockAuthService.validateRefresh).toHaveBeenCalledWith(
        validBody.refreshToken
      )
      expect(mockAuthService.login).toHaveBeenCalledWith(userMock)
    })

    it('should return 404 when the refresh token is invalid', async () => {
      // Arrange
      mockAuthService.validateRefresh.mockRejectedValue(
        new NotFoundException({
          message: 'User with provided refresh token does not exist'
        })
      )

      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(validBody)
        .expect(404)
    })
  })

  // ─── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return 200 and the authenticated user data', async () => {
      // Act & Assert
      const { body } = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer mock-token')
        .expect(200)

      expect(body.id).toBe(userMock.id)
      expect(body.email).toBe(userMock.email)
    })

    it('should return 401 when no Authorization header is provided', async () => {
      // Act & Assert
      await request(app.getHttpServer()).get('/auth/me').expect(401)
    })
  })
})
