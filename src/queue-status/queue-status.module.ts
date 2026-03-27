import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { QueueStatusService } from './queue-status.service'
import { QueueStatusController } from './queue-status.controller'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail'
    })
  ],
  providers: [QueueStatusService],
  controllers: [QueueStatusController],
  exports: [QueueStatusService]
})
export class QueueStatusModule {} 