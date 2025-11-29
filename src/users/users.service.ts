import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
    constructor(private prisma: TenantPrismaService) { }

    async findAll(tenantId: string, pagination: { page: number; limit: number }) {
        return this.prisma.run(async (tx) => {
            const { page, limit } = pagination;
            const offset = (page - 1) * limit;

            // Get users with raw query
            const users: any[] = await tx.$queryRaw`
                SELECT u.id, u.email, u."firstName", u."lastName", u.status, u."createdAt"
                FROM "users" u
                ORDER BY u."createdAt" DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            // Get total count
            const countResult: any[] = await tx.$queryRaw`SELECT COUNT(*)::int as count FROM "users"`;
            const total = countResult[0]?.count || 0;

            // Get roles for each user
            for (const user of users) {
                const roles: any[] = await tx.$queryRaw`
                    SELECT r.name, r."displayName"
                    FROM "roles" r
                    JOIN "user_roles" ur ON ur."roleId" = r.id
                    WHERE ur."userId" = ${user.id}
                `;
                user.roles = roles.map(r => ({ role: { name: r.name, displayName: r.displayName } }));
            }

            return {
                data: users,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        });
    }

    async findOne(tenantId: string, id: string) {
        return this.prisma.run(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id },
                include: {
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            const { password, ...result } = user;
            return result;
        });
    }

    async create(tenantId: string, createUserDto: CreateUserDto) {
        return this.prisma.run(async (tx) => {
            // Check if user exists
            const existing = await tx.user.findUnique({
                where: { email: createUserDto.email },
            });

            if (existing) {
                throw new ConflictException('User with this email already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

            // Create user
            const user = await tx.user.create({
                data: {
                    ...createUserDto,
                    password: hashedPassword,
                    status: 'PENDING_VERIFICATION',
                },
            });

            const { password, ...result } = user;
            return result;
        });
    }

    async update(tenantId: string, id: string, updateUserDto: UpdateUserDto) {
        return this.prisma.run(async (tx) => {
            // Check if user exists
            const existing = await tx.user.findUnique({ where: { id } });
            if (!existing) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            if (updateUserDto.password) {
                updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
            }

            const user = await tx.user.update({
                where: { id },
                data: updateUserDto,
            });

            const { password, ...result } = user;
            return result;
        });
    }

    async remove(tenantId: string, id: string) {
        return this.prisma.run(async (tx) => {
            // Check if user exists
            const existing = await tx.user.findUnique({ where: { id } });
            if (!existing) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            await tx.user.delete({
                where: { id },
            });

            return { message: 'User deleted successfully' };
        });
    }
}
