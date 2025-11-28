import { Controller, Get } from '@nestjs/common';
import {
    HealthCheckService,
    HealthCheck,
    PrismaHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private prismaHealth: PrismaHealthIndicator,
        private memory: MemoryHealthIndicator,
        private disk: DiskHealthIndicator,
        private prisma: PrismaService,
    ) { }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Overall health check' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    @ApiResponse({ status: 503, description: 'Service is unhealthy' })
    async check() {
        return this.health.check([
            // Database health
            () => this.prismaHealth.pingCheck('database', this.prisma),

            // Memory health (heap should not exceed 300MB)
            () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

            // Memory health (RSS should not exceed 500MB)
            () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

            // Disk health (should have at least 50% free)
            () =>
                this.disk.checkStorage('storage', {
                    path: '/',
                    thresholdPercent: 0.5,
                }),
        ]);
    }

    @Get('liveness')
    @HealthCheck()
    @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
    @ApiResponse({ status: 200, description: 'Service is alive' })
    async liveness() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }

    @Get('readiness')
    @HealthCheck()
    @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
    @ApiResponse({ status: 200, description: 'Service is ready' })
    @ApiResponse({ status: 503, description: 'Service is not ready' })
    async readiness() {
        return this.health.check([
            () => this.prismaHealth.pingCheck('database', this.prisma),
        ]);
    }
}
