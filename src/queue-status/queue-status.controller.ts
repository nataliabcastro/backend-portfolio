import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { QueueStatusService, QueueJobStatus } from './queue-status.service'

@Controller('queue-status')
export class QueueStatusController {
  constructor(private readonly queueStatusService: QueueStatusService) {}

  @Get()
  async getAllJobs(): Promise<QueueJobStatus[]> {
    return this.queueStatusService.getAllJobs()
  }

  @Get(':jobId')
  async getJobStatus(@Param('jobId') jobId: string): Promise<QueueJobStatus> {
    const status = await this.queueStatusService.getJobStatus(jobId)

    if (!status) {
      throw new NotFoundException(`Job with ID ${jobId} not found`)
    }

    return status
  }
}
