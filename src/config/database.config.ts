import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
    url: process.env.DATABASE_URL,
    // Schema-per-tenant configuration
    defaultTenantSchema: process.env.DEFAULT_TENANT_SCHEMA || 'tenant_default',
}));
