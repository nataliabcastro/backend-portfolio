import { Test, TestingModule } from '@nestjs/testing'

import { UsersService } from './users.service'
import { PrismaService } from '../prisma/prisma.service'

//  Mocks

const mockPrismaService = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  apiToken: {
    count: jest.fn(),
    create: jest.fn()
  }
}

// Reusable user mock
const userMock = {
  id: 'fake-id',
  email: 'test@example.com',
  password: 'hashed-password',
  createdAt: new Date(),
  updatedAt: new Date()
}

//  Main suite

describe('UsersService', () => {
  let service: UsersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService }
      ]
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  //  findAll

  describe('findAll', () => {
    it('should return a list of users', async () => {
      // Arrange
      const usersList = [userMock, { ...userMock, id: 'fake-id-2' }]
      mockPrismaService.user.findMany.mockResolvedValue(usersList)

      // Act
      const result = await service.findAll({})

      // Assert
      expect(result).toEqual(usersList)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({})
    })

    it('should return an empty list when there are no users', async () => {
      // Arrange
      mockPrismaService.user.findMany.mockResolvedValue([])

      // Act
      const result = await service.findAll({})

      // Assert
      expect(result).toEqual([])
    })
  })

  //  findOne

  describe('findOne', () => {
    it('should return a user when found', async () => {
      // Arrange
      const args = { where: { id: 'fake-id' } }
      mockPrismaService.user.findFirst.mockResolvedValue(userMock)

      // Act
      const result = await service.findOne(args)

      // Assert
      expect(result).toEqual(userMock)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(args)
    })

    it('should return null when the user is not found', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(null)

      // Act
      const result = await service.findOne({ where: { id: 'not-found' } })

      // Assert
      expect(result).toBeNull()
    })
  })

  //  create

  describe('create', () => {
    it('should create and return the new user', async () => {
      // Arrange
      const args = {
        data: { email: userMock.email, password: userMock.password }
      }
      mockPrismaService.user.create.mockResolvedValue(userMock)

      // Act
      const result = await service.create(args)

      // Assert
      expect(result).toEqual(userMock)
      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(args)
    })
  })

  //  update

  describe('update', () => {
    it('should update and return the modified user', async () => {
      // Arrange
      const updatedUser = { ...userMock, email: 'updated@example.com' }
      const args = {
        where: { id: userMock.id },
        data: { email: 'updated@example.com' }
      }
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      // Act
      const result = await service.update(args)

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(args)
    })
  })

  //  delete

  describe('delete', () => {
    it('should delete and return the removed user', async () => {
      // Arrange
      const args = { where: { id: userMock.id } }
      mockPrismaService.user.delete.mockResolvedValue(userMock)

      // Act
      const result = await service.delete(args)

      // Assert
      expect(result).toEqual(userMock)
      expect(mockPrismaService.user.delete).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith(args)
    })
  })

  //  createToken 

  describe('createToken', () => {
    it('should generate a token in the format "{sequential}|{randomString}"', async () => {
      // Arrange
      mockPrismaService.apiToken.count.mockResolvedValue(2)
      mockPrismaService.apiToken.create.mockResolvedValue({})

      // Act
      const result = await service.createToken(userMock.id)

      // Assert
      // Token must follow the pattern: number (1 + count) | random 16-char string
      expect(result).toMatch(/^3\|[a-zA-Z0-9]{16}$/)
    })

    it('should persist the token in the database with userId and expiration date', async () => {
      // Arrange
      mockPrismaService.apiToken.count.mockResolvedValue(0)
      mockPrismaService.apiToken.create.mockResolvedValue({})

      // Act
      await service.createToken(userMock.id)

      // Assert
      expect(mockPrismaService.apiToken.create).toHaveBeenCalledTimes(1)

      const callArgs = mockPrismaService.apiToken.create.mock.calls[0][0]
      expect(callArgs.data.userId).toBe(userMock.id)
      expect(callArgs.data.token).toMatch(/^1\|[a-zA-Z0-9]{16}$/)
      expect(callArgs.data.expiresAt).toBeInstanceOf(Date)
    })

    it('should increment the sequential based on the number of existing tokens', async () => {
      // Arrange
      mockPrismaService.apiToken.count.mockResolvedValue(5)
      mockPrismaService.apiToken.create.mockResolvedValue({})

      // Act
      const result = await service.createToken(userMock.id)

      // Assert
      expect(result.startsWith('6|')).toBe(true)
    })
  })
})
