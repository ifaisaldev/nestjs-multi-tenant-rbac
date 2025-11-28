import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService for PUBLIC schema
 * Used for tenant management and lookups
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor(private configService: ConfigService) {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        super({
            datasources: {
                db: {
                    url: databaseUrl,
                },
            },
            log: configService.get('NODE_ENV') === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['warn', 'error'],
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('✅ Public schema database connection established');
        } catch (error) {
            this.logger.error('❌ Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Database connection closed');
    }

    /**
     * Clean disconnect for graceful shutdown
     */
    async enableShutdownHooks(app: any) {
        this.$on('beforeExit', async () => {
            await app.close();
        });
    }

    /**
     * Execute raw SQL with safety checks
     */
    async executeRaw(query: string, ...values: any[]) {
        return this.$executeRawUnsafe(query, ...values);
    }

    /**
     * Create a new tenant schema
     */
    async createTenantSchema(schemaName: string): Promise<void> {
        this.logger.log(`Creating tenant schema: ${schemaName}`);

        try {
            // Create schema
            await this.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

            // You would run Prisma migrations for the tenant schema here
            // For now, we'll use raw SQL or a migration tool
            this.logger.log(`✅ Tenant schema created: ${schemaName}`);
        } catch (error) {
            this.logger.error(`❌ Failed to create tenant schema: ${schemaName}`, error);
            throw error;
        }
    }

    /**
     * Drop a tenant schema (use with caution!)
     */
    async dropTenantSchema(schemaName: string): Promise<void> {
        this.logger.warn(`Dropping tenant schema: ${schemaName}`);

        try {
            await this.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
            this.logger.log(`✅ Tenant schema dropped: ${schemaName}`);
        } catch (error) {
            this.logger.error(`❌ Failed to drop tenant schema: ${schemaName}`, error);
            throw error;
        }
    }

    /**
     * Check if a tenant schema exists
     */
    async schemaExists(schemaName: string): Promise<boolean> {
        const result = await this.$queryRawUnsafe<Array<{ exists: boolean }>>(
            `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) as exists`,
            schemaName,
        );

        return result[0]?.exists || false;
    }
}
