import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { runWithTenant } from '../tenant-context';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const headerName = this.configService.get<string>('TENANT_HEADER_NAME') || 'X-Tenant-ID';
        const tenantSlug = req.headers[headerName.toLowerCase()] as string;

        if (!tenantSlug) {
            return next();
        }

        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: { schema: true },
            });

            if (!tenant) {
                throw new NotFoundException(`Tenant '${tenantSlug}' not found`);
            }

            runWithTenant(tenant.schema, () => {
                next();
            });
        } catch (error) {
            next(error);
        }
    }
}
