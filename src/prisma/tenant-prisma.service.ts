import { Injectable, Scope, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Tenant-Scoped Prisma Service
 * Creates a Prisma client instance connected to a specific tenant's schema
 * Scope: REQUEST - each request gets its own instance
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService extends PrismaClient {
    private readonly logger = new Logger(TenantPrismaService.name);
    private tenantSchema: string;

    constructor(private configService: ConfigService) {
        super({
            log: configService.get('NODE_ENV') === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['warn', 'error'],
        });
    }

    /**
     * Set the tenant schema for this request
     * Must be called before any database operations
     */
    async setTenantSchema(schemaName: string): Promise<void> {
        if (!schemaName) {
            throw new Error('Tenant schema name is required');
        }

        this.tenantSchema = schemaName;

        // Set the PostgreSQL search_path to the tenant schema
        await this.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

        this.logger.debug(`🔄 Switched to tenant schema: ${schemaName}`);
    }

    /**
     * Get current tenant schema
     */
    getTenantSchema(): string {
        return this.tenantSchema;
    }

    /**
     * Override connect to ensure schema is set
     */
    async $connect() {
        await super.$connect();

        if (this.tenantSchema) {
            await this.$executeRawUnsafe(`SET search_path TO "${this.tenantSchema}"`);
        }
    }
}
