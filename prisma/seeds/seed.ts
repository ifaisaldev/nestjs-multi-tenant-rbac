import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
    const tenantId = process.env.SEED_TENANT_ID || 'tenant_test';

    console.log(`🌱 Seeding tenant: ${tenantId}`);

    // Set search path to tenant schema
    await prisma.$executeRawUnsafe(`SET search_path TO ${tenantId}`);

    // 1. Create Roles
    console.log('Creating roles...');

    const superAdminRole = await prisma.$queryRawUnsafe(
        `INSERT INTO roles (id, name, display_name, description, is_system, priority, created_at, updated_at)
     VALUES (gen_random_uuid(), 'SUPER_ADMIN', 'Super Administrator', 'Full system access with all permissions', true, 100, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING *`
    );

    const adminRole = await prisma.$queryRawUnsafe(
        `INSERT INTO roles (id, name, display_name, description, is_system, priority, created_at, updated_at)
     VALUES (gen_random_uuid(), 'ADMIN', 'Administrator', 'Tenant administration and user management', true, 80, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING *`
    );

    const managerRole = await prisma.$queryRawUnsafe(
        `INSERT INTO roles (id, name, display_name, description, is_system, priority, created_at, updated_at)
     VALUES (gen_random_uuid(), 'MANAGER', 'Manager', 'Team and resource management', true, 50, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING *`
    );

    const userRole = await prisma.$queryRawUnsafe(
        `INSERT INTO roles (id, name, display_name, description, is_system, priority, created_at, updated_at)
     VALUES (gen_random_uuid(), 'USER', 'User', 'Basic user access', true, 10, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING *`
    );

    console.log('✓ Roles created');

    // 2. Create Permissions
    console.log('Creating permissions...');

    const permissions = [
        // Users
        { resource: 'users', action: 'create', description: 'Create new users' },
        { resource: 'users', action: 'read', description: 'View user details' },
        { resource: 'users', action: 'update', description: 'Update user information' },
        { resource: 'users', action: 'delete', description: 'Delete users' },
        { resource: 'users', action: 'list', description: 'List all users' },

        // Roles
        { resource: 'roles', action: 'create', description: 'Create new roles' },
        { resource: 'roles', action: 'read', description: 'View role details' },
        { resource: 'roles', action: 'update', description: 'Update roles' },
        { resource: 'roles', action: 'delete', description: 'Delete roles' },
        { resource: 'roles', action: 'assign', description: 'Assign roles to users' },

        // Permissions
        { resource: 'permissions', action: 'create', description: 'Create new permissions' },
        { resource: 'permissions', action: 'read', description: 'View permissions' },
        { resource: 'permissions', action: 'update', description: 'Update permissions' },
        { resource: 'permissions', action: 'delete', description: 'Delete permissions' },
        { resource: 'permissions', action: 'assign', description: 'Assign permissions to roles' },
    ];

    for (const perm of permissions) {
        await prisma.$queryRawUnsafe(
            `INSERT INTO permissions (id, resource, action, description, created_at, updated_at)
       VALUES (gen_random_uuid(), '${perm.resource}', '${perm.action}', '${perm.description}', NOW(), NOW())
       ON CONFLICT (resource, action) DO UPDATE SET description = '${perm.description}', updated_at = NOW()`
        );
    }

    console.log('✓ Permissions created');

    // 3. Assign Permissions to Roles
    console.log('Assigning permissions to roles...');

    // SUPER_ADMIN gets all permissions
    await prisma.$queryRawUnsafe(`
    INSERT INTO role_permissions (id, role_id, permission_id, created_at)
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'SUPER_ADMIN'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

    // ADMIN gets most permissions except system-level
    await prisma.$queryRawUnsafe(`
    INSERT INTO role_permissions (id, role_id, permission_id, created_at)
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'ADMIN' 
    AND p.action IN ('create', 'read', 'update', 'list', 'assign')
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

    // MANAGER gets read and update permissions
    await prisma.$queryRawUnsafe(`
    INSERT INTO role_permissions (id, role_id, permission_id, created_at)
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'MANAGER' 
    AND p.action IN ('read', 'update', 'list')
    AND p.resource = 'users'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

    // USER gets only read permissions
    await prisma.$queryRawUnsafe(`
    INSERT INTO role_permissions (id, role_id, permission_id, created_at)
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'USER' 
    AND p.action = 'read'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

    console.log('✓ Permissions assigned to roles');

    // 4. Create Test Users
    console.log('Creating test users...');

    const hashedPassword = await bcrypt.hash('Test@123', 12);

    const testUsers = [
        {
            email: 'superadmin@test.com',
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
        },
        {
            email: 'admin@test.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
        },
        {
            email: 'manager@test.com',
            firstName: 'Manager',
            lastName: 'User',
            role: 'MANAGER',
        },
        {
            email: 'user@test.com',
            firstName: 'Regular',
            lastName: 'User',
            role: 'USER',
        },
    ];

    for (const testUser of testUsers) {
        // Create user
        const userResult: any = await prisma.$queryRawUnsafe(
            `INSERT INTO users (id, email, password, first_name, last_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), '${testUser.email}', '${hashedPassword}', '${testUser.firstName}', '${testUser.lastName}', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`
        );

        const userId = userResult[0].id;

        // Assign role to user
        await prisma.$queryRawUnsafe(`
      INSERT INTO user_roles (id, user_id, role_id, assigned_by, assigned_at, created_at)
      SELECT gen_random_uuid(), '${userId}', r.id, '${userId}', NOW(), NOW()
      FROM roles r
      WHERE r.name = '${testUser.role}'
      ON CONFLICT (user_id, role_id) DO NOTHING
    `);

        console.log(`  ✓ Created ${testUser.email} with role ${testUser.role}`);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📝 Test Users Created:');
    console.log('  superadmin@test.com - Password: Test@123 (SUPER_ADMIN)');
    console.log('  admin@test.com - Password: Test@123 (ADMIN)');
    console.log('  manager@test.com - Password: Test@123 (MANAGER)');
    console.log('  user@test.com - Password: Test@123 (USER)');
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
