import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { UserCreatedEvent } from './events/user-created.event'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}))

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsersService = {
  findOne: jest.fn(),
  create: jest.fn(),
  createToken: jest.fn()
}

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-secret')
}

const mockEventEmitter = {
  emit: jest.fn()
}

// Reusable user mock
const userMock: User = {
  id: 'fake-id',
  email: 'test@example.com',
  password: 'hashed-password',
  createdAt: new Date(),
  updatedAt: new Date()
}

// ─── Main suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter }
      ]
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // ─── validateLogin ──────────────────────────────────────────────────────────

  describe('validateLogin', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'plain-password'
    }

    it('should return the user when email and password are valid', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(userMock)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      // Act
      const result = await service.validateLogin(loginDto)

      // Assert
      expect(result).toEqual(userMock)
      expect(mockUsersService.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email }
      })
    })

    it('should throw NotFoundException when email does not exist', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        NotFoundException
      )
    })

    it('should throw NotFoundException when password is invalid', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(userMock)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        NotFoundException
      )
    })
  })

  // ─── validateRegister ───────────────────────────────────────────────────────

  describe('validateRegister', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'plain-password'
    }

    it('should complete without errors when email is not yet registered', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.validateRegister(registerDto)
      ).resolves.toBeUndefined()
    })

    it('should throw UnprocessableEntityException when email is already registered', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(userMock)

      // Act & Assert
      await expect(service.validateRegister(registerDto)).rejects.toThrow(
        UnprocessableEntityException
      )
    })
  })

  // ─── validateRefresh ────────────────────────────────────────────────────────

  describe('validateRefresh', () => {
    const refreshToken = '1|randomstring'

    it('should return the user when the refresh token is valid', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(userMock)

      // Act
      const result = await service.validateRefresh(refreshToken)

      // Assert
      expect(result).toEqual(userMock)
      expect(mockUsersService.findOne).toHaveBeenCalledWith({
        where: { ApiToken: { some: { token: refreshToken } } }
      })
    })

    it('should throw NotFoundException when no user owns the token', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.validateRefresh(refreshToken)).rejects.toThrow(
        NotFoundException
      )
    })
  })

  // ─── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'plain-password'
    }

    it('should create the user with a hashed password', async () => {
      // Arrange
      const hashedPassword = 'hashed-password'
      ;(bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)
      mockUsersService.create.mockResolvedValue({
        ...userMock,
        email: registerDto.email
      })

      // Act
      await service.register(registerDto)

      // Assert
      expect(mockUsersService.create).toHaveBeenCalledWith({
        data: { email: registerDto.email, password: hashedPassword }
      })
    })

    it('should emit the user.created event after registration', async () => {
      // Arrange
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password')
      mockUsersService.create.mockResolvedValue({
        ...userMock,
        email: registerDto.email
      })

      // Act
      await service.register(registerDto)

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.created',
        new UserCreatedEvent(registerDto.email)
      )
    })

    it('should return the created user', async () => {
      // Arrange
      const createdUser = { ...userMock, email: registerDto.email }
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password')
      mockUsersService.create.mockResolvedValue(createdUser)

      // Act
      const result = await service.register(registerDto)

      // Assert
      expect(result).toEqual(createdUser)
    })
  })

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return accessToken and refreshToken', async () => {
      // Arrange
      const fakeRefreshToken = '1|randomstring'
      mockUsersService.createToken.mockResolvedValue(fakeRefreshToken)

      // Act
      const result = await service.login(userMock)

      // Assert
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken', fakeRefreshToken)
    })

    it('should generate a valid JWT accessToken with the correct payload', async () => {
      // Arrange
      mockUsersService.createToken.mockResolvedValue('1|randomstring')

      // Act
      const { accessToken } = await service.login(userMock)

      // Assert
      const decoded = jwt.verify(accessToken, 'test-secret') as jwt.JwtPayload
      expect(decoded.sub).toBe(userMock.id)
      expect(decoded.email).toBe(userMock.email)
    })
  })
})
