import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
    private readonly bcryptSaltRounds: number;

    constructor(
        private prisma: TenantPrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {
        this.bcryptSaltRounds = this.configService.get<number>('app.bcryptSaltRounds', 12);
    }

    /**
     * Register a new user
     */
    async register(registerDto: RegisterDto, tenantId: string) {
        // Set tenant schema
        await this.prisma.setTenantSchema(tenantId);

        // Check if user already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: registerDto.email },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(registerDto.password, this.bcryptSaltRounds);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: registerDto.email,
                password: hashedPassword,
                firstName: registerDto.firstName,
                lastName: registerDto.lastName,
                phone: registerDto.phone,
                status: 'PENDING_VERIFICATION',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
                createdAt: true,
            },
        });

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email, tenantId);

        // Create session
        await this.createSession(user.id, tokens.refreshToken);

        return {
            user,
            ...tokens,
        };
    }

    /**
     * Login user
     */
    async login(loginDto: LoginDto, tenantId: string) {
        // Set tenant schema
        await this.prisma.setTenantSchema(tenantId);

        // Find user
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
            include: {
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
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check user status
        if (user.status === 'SUSPENDED') {
            throw new UnauthorizedException('Account has been suspended');
        }

        if (user.status === 'INACTIVE') {
            throw new UnauthorizedException('Account is inactive');
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
            },
        });

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email, tenantId);

        // Create session
        await this.createSession(user.id, tokens.refreshToken);

        // Return user without password
        const { password, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            ...tokens,
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string, tenantId: string) {
        try {
            // Verify refresh token
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
            });

            // Set tenant schema
            await this.prisma.setTenantSchema(tenantId);

            // Find session
            const session = await this.prisma.session.findUnique({
                where: { refreshToken },
                include: { user: true },
            });

            if (!session) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Check if token is expired
            if (session.expiresAt < new Date()) {
                await this.prisma.session.delete({ where: { id: session.id } });
                throw new UnauthorizedException('Refresh token expired');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(
                session.user.id,
                session.user.email,
                tenantId,
            );

            // Update session
            await this.prisma.session.update({
                where: { id: session.id },
                data: {
                    refreshToken: tokens.refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
            });

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    /**
     * Logout user
     */
    async logout(userId: string, tenantId: string) {
        await this.prisma.setTenantSchema(tenantId);

        // Delete all user sessions
        await this.prisma.session.deleteMany({
            where: { userId },
        });

        return { message: 'Logged out successfully' };
    }

    /**
     * Generate JWT tokens (access + refresh)
     */
    private async generateTokens(userId: string, email: string, tenantId: string) {
        const payload = { sub: userId, email, tenantId };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.secret'),
                expiresIn: this.configService.get<string>('jwt.expiresIn'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
            }),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.configService.get<string>('jwt.expiresIn'),
        };
    }

    /**
     * Create a new session for refresh token
     */
    private async createSession(userId: string, refreshToken: string) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        return this.prisma.session.create({
            data: {
                userId,
                refreshToken,
                expiresAt,
            },
        });
    }
}
