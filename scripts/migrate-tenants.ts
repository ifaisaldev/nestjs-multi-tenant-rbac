
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Tenant Migration...');

    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
        console.log(`\nMigrating tenant: ${tenant.slug} (Schema: ${tenant.schema})`);

        try {
            // Set search path
            await prisma.$executeRawUnsafe(`SET search_path TO "${tenant.schema}"`);

            // Create audit_logs table if not exists
            console.log('Creating audit_logs table...');
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "audit_logs" (
                    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                    "action" TEXT NOT NULL,
                    "resource" TEXT NOT NULL,
                    "resourceId" TEXT,
                    "metadata" JSONB,
                    "ipAddress" TEXT,
                    "userAgent" TEXT,
                    "createdAt" TIMESTAMP DEFAULT NOW(),
                    "createdBy" TEXT REFERENCES "users"("id") ON DELETE SET NULL
                )
            `);

            console.log(`✅ Migration successful for ${tenant.slug}`);
        } catch (error) {
            console.error(`❌ Migration failed for ${tenant.slug}:`, error.message);
        } finally {
            // Reset search path
            await prisma.$executeRawUnsafe(`RESET search_path`);
        }
    }

    console.log('\n🎉 All migrations completed!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
