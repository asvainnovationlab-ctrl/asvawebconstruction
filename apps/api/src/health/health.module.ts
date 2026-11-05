import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ENV, isEmailConfigured, type Env } from '../config/env.js';
import { Public } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — the process is running' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — the database is reachable' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database unavailable' });
    }
    return {
      status: 'ok',
      checks: { database: 'ok', email: isEmailConfigured(this.env) ? 'configured' : 'not-configured', storage: this.env.STORAGE_PROVIDER },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
