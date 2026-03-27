import { Process, Processor, OnQueueFailed } from '@nestjs/bull'
import { Job } from 'bull'

import { MailerService } from './mailer.service'
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service'

import { MailOptions } from './interfaces/mail-options.interface'

@Processor('mail')
export class MailerProcessor {
  constructor(
    private readonly mailerService: MailerService,
    private readonly circuitBreakerService: CircuitBreakerService
  ) {}

  /**
   * Process the mail job.
   *
   * @param job The job with the mail options
   */
  @Process('sendMail')
  async sendMail(job: Job<MailOptions>): Promise<void> {
    const isCircuitOpen = await this.circuitBreakerService.checkCircuit('mail')
    if (!isCircuitOpen) {
      throw new Error('Circuit breaker is open for mail queue')
    }

    return this.mailerService.sendMailFromQueue(job.data)
  }

  @OnQueueFailed()
  async handleFailedJob(job: Job<MailOptions>, error: Error): Promise<void> {
    await this.circuitBreakerService.handleFailedJob(job, error)
  }
}
