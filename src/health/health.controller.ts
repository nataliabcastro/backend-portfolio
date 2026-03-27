import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Redis health check
      () => this.redis.isHealthy('redis'),
      // Memory health check - alert if heap usage is above 200MB
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      // Disk health check - alert if storage usage is above 90%
      () => this.disk.checkStorage('disk', { thresholdPercent: 0.9, path: 'C:\\' }),
    ]);
  }
} 