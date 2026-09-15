import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job, Queue } from 'bull'

import {
  CircuitBreakerService,
  CircuitBreakerOptions
} from './circuit-breaker.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJobMock(overrides: Partial<Job> = {}): jest.Mocked<Job> {
  return {
    id: 'job-1',
    attemptsMade: 0,
    queue: { name: 'mail' } as Queue,
    retry: jest.fn(),
    ...overrides
  } as unknown as jest.Mocked<Job>
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMailQueue = {
  name: 'mail',
  getFailed: jest.fn()
}

// ─── Main suite ───────────────────────────────────────────────────────────────

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: getQueueToken('mail'), useValue: mockMailQueue }
      ]
    }).compile()

    service = module.get<CircuitBreakerService>(CircuitBreakerService)

    // Silence logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // ─── handleFailedJob ────────────────────────────────────────────────────────

  describe('handleFailedJob', () => {
    it('should increment the failure counter with each failed job', async () => {
      // Arrange
      const job = makeJobMock()
      const options: Partial<CircuitBreakerOptions> = { failureThreshold: 5 }
      mockMailQueue.getFailed.mockResolvedValue([])

      // Act
      await service.handleFailedJob(job, new Error('failure'), options)
      await service.handleFailedJob(job, new Error('failure'), options)

      // Assert — circuit is still closed (below the threshold)
      const isOpen = await service.checkCircuit('mail')
      expect(isOpen).toBe(true)
    })

    it('should open the circuit when the failureThreshold is reached', async () => {
      // Arrange
      const job = makeJobMock()
      const options: Partial<CircuitBreakerOptions> = { failureThreshold: 2 }
      mockMailQueue.getFailed.mockResolvedValue([])

      // Act — fires failures until the threshold
      await service.handleFailedJob(job, new Error('failure'), options)
      await service.handleFailedJob(job, new Error('failure'), options)

      // Assert — circuit is open, checkCircuit should return false
      const isOpen = await service.checkCircuit('mail')
      expect(isOpen).toBe(false)
    })

    it('should log a warning when the circuit opens', async () => {
      // Arrange
      const job = makeJobMock()
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      const options: Partial<CircuitBreakerOptions> = { failureThreshold: 1 }

      // Act
      await service.handleFailedJob(job, new Error('failure'), options)

      // Assert
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened for queue mail')
      )
    })

    it('should log an error when the circuit is open and the job is not retried', async () => {
      // Arrange
      const job = makeJobMock()
      const errorSpy = jest.spyOn(Logger.prototype, 'error')
      const options: Partial<CircuitBreakerOptions> = { failureThreshold: 1 }

      // Act — opens the circuit and fires another failure
      await service.handleFailedJob(job, new Error('failure'), options)
      await service.handleFailedJob(job, new Error('failure'), options)

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker is open for queue mail')
      )
    })

    it('should log an error when maxRetries is reached with a closed circuit', async () => {
      // Arrange
      const job = makeJobMock({ attemptsMade: 3 })
      const errorSpy = jest.spyOn(Logger.prototype, 'error')
      const options: Partial<CircuitBreakerOptions> = {
        failureThreshold: 10,
        maxRetries: 3
      }

      // Act
      await service.handleFailedJob(job, new Error('failure'), options)

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max retries (3) reached for job job-1')
      )
    })
  })

  // ─── checkCircuit ───────────────────────────────────────────────────────────

  describe('checkCircuit', () => {
    it('should return true when the circuit is closed', async () => {
      // Arrange
      mockMailQueue.getFailed.mockResolvedValue([])

      // Act
      const result = await service.checkCircuit('mail')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when the circuit is open and the timeout has not elapsed', async () => {
      // Arrange — opens the circuit
      const job = makeJobMock()
      await service.handleFailedJob(job, new Error('failure'), {
        failureThreshold: 1
      })

      // Act
      const result = await service.checkCircuit('mail')

      // Assert
      expect(result).toBe(false)
    })

    it('should reset the circuit and return true after the resetTimeout has elapsed', async () => {
      // Arrange — opens the circuit
      const job = makeJobMock()
      await service.handleFailedJob(job, new Error('failure'), {
        failureThreshold: 1
      })
      mockMailQueue.getFailed.mockResolvedValue([])

      // Simulates resetTimeout (30s) passing by mocking Date
      const futureTime = Date.now() + 31_000
      jest.spyOn(Date, 'now').mockReturnValue(futureTime)

      // Act
      const result = await service.checkCircuit('mail')

      // Assert
      expect(result).toBe(true)
    })

    it('should reprocess failed jobs when the circuit resets', async () => {
      // Arrange — opens the circuit
      const job = makeJobMock()
      await service.handleFailedJob(job, new Error('failure'), {
        failureThreshold: 1
      })

      const failedJob = makeJobMock({ id: 'failed-job-1' })
      mockMailQueue.getFailed.mockResolvedValue([failedJob])

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000)

      // Act
      await service.checkCircuit('mail')

      // Assert
      expect(failedJob.retry).toHaveBeenCalledTimes(1)
    })

    it('should reprocess failed jobs even when the circuit is closed', async () => {
      // Arrange
      const failedJob = makeJobMock({ id: 'failed-job-1' })
      mockMailQueue.getFailed.mockResolvedValue([failedJob])

      // Act
      await service.checkCircuit('mail')

      // Assert
      expect(failedJob.retry).toHaveBeenCalledTimes(1)
    })
  })
})
