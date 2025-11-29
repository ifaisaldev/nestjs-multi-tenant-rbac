
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/tenant/tenant.service';

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const tenantService = app.get(TenantService);

    const tenantDto = {
        name: 'Audit Verification Corp',
        slug: 'audit-verification-tenant',
        domain: 'audit.test.local',
        adminEmail: 'admin@audit.test',
        adminPassword: 'Password123!',
        adminFirstName: 'Audit',
        adminLastName: 'Admin',
    };

    try {
        console.log('Creating tenant...');
        const tenant = await tenantService.create(tenantDto);
        console.log('✅ Tenant created:', tenant);
    } catch (error) {
        if (error.status === 409) {
            console.log('⚠️ Tenant already exists, skipping creation.');
        } else {
            console.error('❌ Failed to create tenant:', error);
            process.exit(1);
        }
    }

    await app.close();
}

main();
