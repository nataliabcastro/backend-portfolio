import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, Job } from 'bull'

export interface CircuitBreakerOptions {
  maxRetries: number
  retryDelay: number
  failureThreshold: number
  resetTimeout: number
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name)
  private readonly circuitStates: Map<
    string,
    {
      failures: number
      lastFailureTime: number
      isOpen: boolean
    }
  > = new Map()

  private readonly defaultOptions: CircuitBreakerOptions = {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    failureThreshold: 5,
    resetTimeout: 30000 // 30 seconds
  }

  constructor(@InjectQueue('mail') private readonly mailQueue: Queue) {}

  async handleFailedJob(
    job: Job,
    error: Error,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<void> {
    const mergedOptions = { ...this.defaultOptions, ...options }
    const queueName = job.queue.name
    const circuitState = this.getCircuitState(queueName)

    // Update circuit state
    circuitState.failures++
    circuitState.lastFailureTime = Date.now()

    // Check if circuit should open
    if (circuitState.failures >= mergedOptions.failureThreshold) {
      circuitState.isOpen = true
      this.logger.warn(
        `Circuit breaker opened for queue ${queueName} after ${circuitState.failures} failures`
      )
    }

    // Log the failure
    const attemptsMade = job.attemptsMade
    if (circuitState.isOpen) {
      this.logger.error(
        `Circuit breaker is open for queue ${queueName}, job ${job.id} not retried`
      )
    } else if (attemptsMade >= mergedOptions.maxRetries) {
      this.logger.error(
        `Max retries (${mergedOptions.maxRetries}) reached for job ${job.id}`
      )
    }
  }

  async checkCircuit(queueName: string): Promise<boolean> {
    const circuitState = this.getCircuitState(queueName)

    if (!circuitState.isOpen) {
      // Even when circuit is closed, check if there are failed jobs to reprocess
      const queue = this.getQueueByName(queueName)
      if (queue) {
        const failedJobs = await queue.getFailed()
        if (failedJobs.length > 0) {
          this.logger.log(
            `Found ${failedJobs.length} failed jobs to reprocess in closed circuit`
          )
          await this.reprocessFailedJobs(queueName)
        }
      }
      return true
    }

    // Check if reset timeout has passed
    const timeSinceLastFailure = Date.now() - circuitState.lastFailureTime
    if (timeSinceLastFailure >= this.defaultOptions.resetTimeout) {
      await this.resetCircuit(queueName)
      return true
    }

    return false
  }

  private getCircuitState(queueName: string) {
    if (!this.circuitStates.has(queueName)) {
      this.circuitStates.set(queueName, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.circuitStates.get(queueName)!
  }

  private async reprocessFailedJobs(queueName: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName)
      if (!queue) {
        this.logger.warn(`Queue ${queueName} not found for reprocessing`)
        return
      }

      const failedJobs = await queue.getFailed()
      this.logger.log(
        `Found ${failedJobs.length} failed jobs to reprocess in queue ${queueName}`
      )

      for (const job of failedJobs) {
        try {
          await job.retry()
          this.logger.log(`Successfully queued job ${job.id} for reprocessing`)
        } catch (error) {
          this.logger.error(`Failed to retry job ${job.id}: ${error.message}`)
        }
      }
    } catch (error) {
      this.logger.error(`Error reprocessing failed jobs: ${error.message}`)
    }
  }

  private getQueueByName(queueName: string): Queue | null {
    switch (queueName) {
      case 'mail':
        return this.mailQueue
      default:
        return null
    }
  }

  private async resetCircuit(queueName: string): Promise<void> {
    const circuitState = this.getCircuitState(queueName)
    circuitState.failures = 0
    circuitState.isOpen = false
    this.logger.log(`Circuit breaker reset for queue ${queueName}`)

    // Reprocess failed jobs when circuit is reset
    await this.reprocessFailedJobs(queueName)
  }
}
