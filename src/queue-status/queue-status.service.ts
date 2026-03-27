import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import Bull, { Queue } from 'bull'

export interface QueueJobStatus {
  id: string
  status: Bull.JobStatus | 'stuck'
  data: any
  progress?: number | object
  error?: string
  timestamp: Date
}

@Injectable()
export class QueueStatusService {
  constructor(@InjectQueue('mail') private readonly mailQueue: Queue) {}

  async getJobStatus(jobId: string): Promise<QueueJobStatus | null> {
    const job = await this.mailQueue.getJob(jobId)

    if (!job) {
      return null
    }

    const state = await job.getState()
    const status: QueueJobStatus = {
      id: job.id.toString(),
      status: state,
      data: job.data,
      timestamp: job.timestamp ? new Date(job.timestamp) : new Date()
    }

    const progress = await job.progress()
    if (progress !== undefined) {
      status.progress = progress
    }

    if (job.failedReason) {
      status.error = job.failedReason
    }

    return status
  }

  async getAllJobs(): Promise<QueueJobStatus[]> {
    const jobs = await this.mailQueue.getJobs([
      'active',
      'waiting',
      'completed',
      'failed'
    ])
    const jobStatuses: QueueJobStatus[] = []

    for (const job of jobs) {
      const state = await job.getState()
      const status: QueueJobStatus = {
        id: job.id.toString(),
        status: state,
        data: job.data,
        timestamp: job.timestamp ? new Date(job.timestamp) : new Date()
      }

      const progress = await job.progress()
      if (progress !== undefined) {
        status.progress = progress
      }

      if (job.failedReason) {
        status.error = job.failedReason
      }

      jobStatuses.push(status)
    }

    return jobStatuses
  }
}
