import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail'
    })
  ],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService]
})
export class CircuitBreakerModule {} 