import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { runWithTenant } from '../tenant-context';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private configService: ConfigService) { }

    use(req: Request, res: Response, next: NextFunction) {
        const headerName = this.configService.get<string>('TENANT_HEADER_NAME') || 'X-Tenant-ID';
        const tenantId = req.headers[headerName.toLowerCase()] as string;

        if (!tenantId) {
            // For public routes, we might not need a tenant, but for now let's enforce it or handle it gracefully
            // If it's a health check or public route, maybe skip?
            // But middleware runs before guards.
            // Let's allow missing tenant for now, but TenantPrismaService will fail if used.
            return next();
        }

        runWithTenant(tenantId, () => {
            next();
        });
    }
}
