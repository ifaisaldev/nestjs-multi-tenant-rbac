import { Injectable, Scope, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { getTenantId } from '../tenant/tenant-context';

/**
 * Tenant-Scoped Prisma Service
 * Creates a Prisma client instance connected to a specific tenant's schema
 * Scope: REQUEST - each request gets its own instance
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService extends PrismaClient implements OnModuleInit {
    private readonly logger = new Logger(TenantPrismaService.name);
    private tenantSchema: string;

    constructor(private configService: ConfigService) {
        super({
            log: configService.get('NODE_ENV') === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['warn', 'error'],
        });
    }

    async onModuleInit() {
        // We can't set schema here because it's too early for request scope? 
        // Actually onModuleInit is called when the module is initialized, but for REQUEST scope it might be different.
        // However, we should try to set it when we connect.
    }

    /**
     * Execute a function within the tenant context (transaction with search_path set)
     */
    async run<T>(fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
        const tenantId = getTenantId();
        if (!tenantId) {
            throw new Error('Tenant ID not found in context');
        }

        return this.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET search_path TO "${tenantId}"`);
            return fn(tx as any);
        });
    }

    /**
     * Override connect - no longer needed to set schema here as we use transactions
     */
    async $connect() {
        await super.$connect();
    }
}
