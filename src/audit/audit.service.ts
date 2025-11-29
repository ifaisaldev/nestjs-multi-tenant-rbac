import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import * as crypto from 'crypto';


export interface CreateAuditLogDto {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private prisma: TenantPrismaService) { }

    /**
     * Create a new audit log entry
     */
    async create(data: CreateAuditLogDto) {
        try {
            return await this.prisma.run(async (tx) => {
                const id = crypto.randomUUID();
                const now = new Date();

                // Use raw query to avoid schema qualification issues
                await tx.$executeRawUnsafe(`
                    INSERT INTO "audit_logs" 
                    ("id", "userId", "action", "resource", "resourceId", "metadata", "ipAddress", "userAgent", "createdAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, id, data.userId, data.action, data.resource, data.resourceId, data.metadata || {}, data.ipAddress, data.userAgent, now);

                return { id };
            });
        } catch (error) {
            this.logger.error(`Failed to persist audit log: ${error.message}`);
            // We don't throw here to avoid failing the main request
        }
    }

    async findAll(params: {
        page: number;
        limit: number;
        userId?: string;
        action?: string;
        resource?: string;
    }) {
        const { page, limit, userId, action, resource } = params;
        const skip = (page - 1) * limit;

        return this.prisma.run(async (tx) => {
            // Build WHERE conditions
            const conditions: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (userId) {
                conditions.push(`"userId" = $${paramIndex++}`);
                values.push(userId);
            }
            if (action) {
                conditions.push(`"action" = $${paramIndex++}`);
                values.push(action);
            }
            if (resource) {
                conditions.push(`"resource" = $${paramIndex++}`);
                values.push(resource);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get logs with user data
            const logs: any[] = await tx.$queryRawUnsafe(`
                SELECT 
                    al.*,
                    json_build_object(
                        'id', u.id,
                        'firstName', u."firstName",
                        'lastName', u."lastName",
                        'email', u.email
                    ) as user
                FROM "audit_logs" al
                LEFT JOIN "users" u ON al."userId" = u.id
                ${whereClause}
                ORDER BY al."createdAt" DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex}
            `, ...values, limit, skip);

            // Get total count
            const countResult: any[] = await tx.$queryRawUnsafe(`
                SELECT COUNT(*)::int as count
                FROM "audit_logs"
                ${whereClause}
            `, ...values);

            const total = countResult[0]?.count || 0;

            return {
                data: logs,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        });
    }

    /**
     * Get logs for a specific user (My Logs)
     */
    async findByUser(userId: string, page = 1, limit = 10) {
        return this.findAll({ page, limit, userId });
    }

    /**
     * Get single log entry
     */
    async findOne(id: string) {
        return this.prisma.run(async (tx) => {
            const logs: any[] = await tx.$queryRawUnsafe(`
                SELECT 
                    al.*,
                    json_build_object(
                        'id', u.id,
                        'firstName', u."firstName",
                        'lastName', u."lastName",
                        'email', u.email
                    ) as user
                FROM "audit_logs" al
                LEFT JOIN "users" u ON al."userId" = u.id
                WHERE al.id = $1
            `, id);

            return logs[0] || null;
        });
    }
}
