import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
    constructor(private prisma: TenantPrismaService) { }

    async findAll(tenantId: string, pagination: { page: number; limit: number }) {
        await this.prisma.setTenantSchema(tenantId);

        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    status: true,
                    emailVerified: true,
                    createdAt: true,
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count(),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(tenantId: string, id: string) {
        await this.prisma.setTenantSchema(tenantId);

        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return user;
    }

    async create(tenantId: string, createUserDto: CreateUserDto) {
        await this.prisma.setTenantSchema(tenantId);

        // Check if user exists
        const existing = await this.prisma.user.findUnique({
            where: { email: createUserDto.email },
        });

        if (existing) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: createUserDto.email,
                password: hashedPassword,
                firstName: createUserDto.firstName,
                lastName: createUserDto.lastName,
                phone: createUserDto.phone,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                createdAt: true,
            },
        });

        return user;
    }

    async update(tenantId: string, id: string, updateUserDto: UpdateUserDto) {
        await this.prisma.setTenantSchema(tenantId);

        // Check if user exists
        await this.findOne(tenantId, id);

        // Update user
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...updateUserDto,
                password: updateUserDto.password
                    ? await bcrypt.hash(updateUserDto.password, 12)
                    : undefined,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                updatedAt: true,
            },
        });

        return user;
    }

    async remove(tenantId: string, id: string) {
        await this.prisma.setTenantSchema(tenantId);

        // Check if user exists
        await this.findOne(tenantId, id);

        // Soft delete (update status to INACTIVE)
        await this.prisma.user.update({
            where: { id },
            data: { status: 'INACTIVE' },
        });

        return { message: 'User deleted successfully' };
    }
}
