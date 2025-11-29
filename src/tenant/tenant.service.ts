import { Injectable, ConflictException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Create a new tenant with automatic schema creation
     */
    async create(createTenantDto: CreateTenantDto) {
        this.logger.log(`Creating tenant: ${createTenantDto.slug}`);

        // Check if slug already exists
        const existingTenant = await this.prisma.tenant.findUnique({
            where: { slug: createTenantDto.slug },
        });

        if (existingTenant) {
            throw new ConflictException(`Tenant with slug '${createTenantDto.slug}' already exists`);
        }

        // Generate schema name from slug
        const schemaName = `tenant_${createTenantDto.slug.replace(/-/g, '_')}`;

        // Check if schema already exists
        const schemaExists = await this.prisma.schemaExists(schemaName);
        if (schemaExists) {
            throw new ConflictException(`Schema '${schemaName}' already exists`);
        }

        try {
            // Create tenant record in public schema
            const tenant = await this.prisma.tenant.create({
                data: {
                    name: createTenantDto.name,
                    slug: createTenantDto.slug,
                    domain: createTenantDto.domain,
                    schema: schemaName,
                    status: 'ACTIVE',
                },
            });

            this.logger.log(`✅ Tenant record created: ${tenant.id}`);

            // Create PostgreSQL schema
            await this.prisma.createTenantSchema(schemaName);

            // Apply migrations to tenant schema
            await this.applyMigrationsToTenantSchema(schemaName);

            // Create admin user in tenant schema
            await this.createTenantAdmin(
                schemaName,
                createTenantDto.adminEmail,
                createTenantDto.adminPassword,
                createTenantDto.adminFirstName,
                createTenantDto.adminLastName,
            );

            this.logger.log(`✅ Tenant setup complete: ${tenant.slug}`);

            return {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                domain: tenant.domain,
                schema: tenant.schema,
                status: tenant.status,
                createdAt: tenant.createdAt,
            };
        } catch (error) {
            this.logger.error(`Failed to create tenant: ${error.message}`, error.stack);

            // Cleanup on failure
            try {
                await this.prisma.tenant.deleteMany({
                    where: { slug: createTenantDto.slug },
                });
                await this.prisma.dropTenantSchema(schemaName);
            } catch (cleanupError) {
                this.logger.error(`Cleanup failed: ${cleanupError.message}`);
            }

            throw error;
        }
    }

    /**
     * Get all tenants
     */
    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [tenants, total] = await Promise.all([
            this.prisma.tenant.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    domain: true,
                    schema: true,
                    status: true,
                    maxUsers: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            this.prisma.tenant.count(),
        ]);

        return {
            data: tenants,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get tenant by ID
     */
    async findOne(id: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                schema: true,
                status: true,
                config: true,
                maxUsers: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!tenant) {
            throw new NotFoundException(`Tenant with ID ${id} not found`);
        }

        return tenant;
    }

    /**
     * Get tenant by slug
     */
    async findBySlug(slug: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { slug },
        });

        if (!tenant) {
            throw new NotFoundException(`Tenant with slug '${slug}' not found`);
        }

        return tenant;
    }

    /**
     * Update tenant
     */
    async update(id: string, updateTenantDto: UpdateTenantDto) {
        const tenant = await this.findOne(id);

        const updated = await this.prisma.tenant.update({
            where: { id },
            data: updateTenantDto,
            select: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                schema: true,
                status: true,
                updatedAt: true,
            },
        });

        this.logger.log(`✅ Tenant updated: ${updated.slug}`);
        return updated;
    }

    /**
     * Delete tenant (soft delete by setting status to INACTIVE)
     */
    async remove(id: string) {
        const tenant = await this.findOne(id);

        // Soft delete - set status to INACTIVE
        await this.prisma.tenant.update({
            where: { id },
            data: { status: 'INACTIVE' },
        });

        this.logger.warn(`⚠️ Tenant soft-deleted: ${tenant.slug}`);

        return { message: `Tenant '${tenant.slug}' has been deactivated` };
    }

    /**
     * Permanently delete tenant and drop schema (DANGEROUS!)
     */
    async hardDelete(id: string) {
        const tenant = await this.findOne(id);

        // Drop PostgreSQL schema
        await this.prisma.dropTenantSchema(tenant.schema);

        // Delete tenant record
        await this.prisma.tenant.delete({
            where: { id },
        });

        this.logger.warn(`🗑️ Tenant permanently deleted: ${tenant.slug}`);

        return { message: `Tenant '${tenant.slug}' and its schema have been permanently deleted` };
    }

    /**
     * Apply database migrations to tenant schema
     */
    private async applyMigrationsToTenantSchema(schemaName: string) {
        this.logger.log(`Applying migrations to schema: ${schemaName}`);

        // Set search path
        await this.prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

        // Create users table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "email" TEXT UNIQUE NOT NULL,
                "password" TEXT NOT NULL,
                "firstName" TEXT NOT NULL,
                "lastName" TEXT NOT NULL,
                "phone" TEXT,
                "avatar" TEXT,
                "status" TEXT DEFAULT 'ACTIVE',
                "emailVerified" BOOLEAN DEFAULT false,
                "emailVerifiedAt" TIMESTAMP,
                "lastLoginAt" TIMESTAMP,
                "lastLoginIp" TEXT,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create roles table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "roles" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "name" TEXT UNIQUE NOT NULL,
                "displayName" TEXT NOT NULL,
                "description" TEXT,
                "isSystem" BOOLEAN DEFAULT false,
                "priority" INTEGER DEFAULT 0,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create permissions table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "permissions" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "resource" TEXT NOT NULL,
                "action" TEXT NOT NULL,
                "description" TEXT,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                UNIQUE("resource", "action")
            )
        `);

        // Create user_roles table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "user_roles" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                "assignedBy" TEXT,
                "assignedAt" TIMESTAMP DEFAULT NOW(),
                UNIQUE("userId", "roleId")
            )
        `);

        // Create role_permissions table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "role_permissions" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                "permissionId" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                UNIQUE("roleId", "permissionId")
            )
        `);

        // Create sessions table
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "sessions" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "refreshToken" TEXT UNIQUE NOT NULL,
                "ipAddress" TEXT,
                "userAgent" TEXT,
                "expiresAt" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create audit_logs table
        await this.prisma.$executeRawUnsafe(`
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

        // Reset search path
        await this.prisma.$executeRawUnsafe(`RESET search_path`);

        this.logger.log(`✅ Migrations applied to: ${schemaName}`);
    }

    /**
     * Create admin user for new tenant
     */
    private async createTenantAdmin(
        schemaName: string,
        email: string,
        password: string,
        firstName: string,
        lastName: string,
    ) {
        this.logger.log(`Creating admin user for schema: ${schemaName}`);

        const hashedPassword = await bcrypt.hash(password, 12);

        // Set search path
        await this.prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);

        // Create SUPER_ADMIN role
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "roles" ("id", "name", "displayName", "description", "isSystem", "priority")
            VALUES (gen_random_uuid()::text, 'SUPER_ADMIN', 'Super Administrator', 'Full system access', true, 100)
            ON CONFLICT (name) DO NOTHING
        `);

        // Create admin user and assign role
        const userId = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `INSERT INTO "users" ("id", "email", "password", "firstName", "lastName", "status")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'ACTIVE')
             RETURNING "id"`,
            email,
            hashedPassword,
            firstName,
            lastName,
        );

        // Assign SUPER_ADMIN role to user
        await this.prisma.$executeRawUnsafe(`
            INSERT INTO "user_roles" ("id", "userId", "roleId", "assignedBy")
            SELECT gen_random_uuid()::text, '${userId[0].id}', r.id, '${userId[0].id}'
            FROM "roles" r
            WHERE r.name = 'SUPER_ADMIN'
        `);

        // Reset search path
        await this.prisma.$executeRawUnsafe(`RESET search_path`);

        this.logger.log(`✅ Admin user created: ${email}`);
    }
}
