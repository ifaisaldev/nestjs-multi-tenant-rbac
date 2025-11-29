import {
    Injectable,
    UnauthorizedException,
    ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
        return this.prisma.run(async (tx) => {
            // Tenant schema is set by middleware

            // Check if user already exists
            const existingUser = await tx.user.findUnique({
                where: { email: registerDto.email },
            });

            if (existingUser) {
                throw new ConflictException('User with this email already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(registerDto.password, this.bcryptSaltRounds);

            // Create user
            const user = await tx.user.create({
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
            await this.createSession(tx, user.id, tokens.refreshToken);

            return {
                user,
                ...tokens,
            };
        });
    }

    /**
     * Login user
     */
    async login(loginDto: LoginDto, tenantId: string) {
        return this.prisma.run(async (tx) => {
            // Tenant schema is set by middleware

            // Find user using raw query to bypass schema qualification
            const users: any[] = await tx.$queryRaw`SELECT * FROM "users" WHERE email = ${loginDto.email}`;
            const user = users[0];

            if (!user) {
                throw new UnauthorizedException('Invalid credentials');
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

            if (!isPasswordValid) {
                throw new UnauthorizedException('Invalid credentials');
            }

            // Update last login
            await tx.$executeRaw`UPDATE "users" SET "lastLoginAt" = NOW() WHERE id = ${user.id}`;

            // Generate tokens
            const tokens = await this.generateTokens(user.id, user.email, tenantId);

            // Create session
            await this.createSession(tx, user.id, tokens.refreshToken);

            // Return user without password
            const { password, ...userWithoutPassword } = user;

            return {
                user: userWithoutPassword,
                ...tokens,
            };
        });
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

            return this.prisma.run(async (tx) => {
                // Find session
                const sessions: any[] = await tx.$queryRaw`SELECT * FROM "sessions" WHERE "refreshToken" = ${refreshToken}`;
                const session = sessions[0];

                if (!session) {
                    throw new UnauthorizedException('Invalid refresh token');
                }

                // Fetch user to get email
                const users: any[] = await tx.$queryRaw`SELECT * FROM "users" WHERE id = ${session.userId}`;
                const user = users[0];

                if (!user) {
                    throw new UnauthorizedException('User not found');
                }

                // Check if token is expired
                if (new Date(session.expiresAt) < new Date()) {
                    await tx.$executeRaw`DELETE FROM "sessions" WHERE id = ${session.id}`;
                    throw new UnauthorizedException('Refresh token expired');
                }

                // Generate new tokens
                const tokens = await this.generateTokens(
                    session.userId,
                    user.email,
                    tenantId,
                );

                // Update session
                const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                await tx.$executeRaw`UPDATE "sessions" SET "refreshToken" = ${tokens.refreshToken}, "expiresAt" = ${newExpiresAt} WHERE id = ${session.id}`;

                return tokens;
            });
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    /**
     * Logout user
     */
    async logout(userId: string, tenantId: string) {
        return this.prisma.run(async (tx) => {
            // Delete all user sessions
            await tx.$executeRaw`DELETE FROM "sessions" WHERE "userId" = ${userId}`;

            return { message: 'Logged out successfully' };
        });
    }

    /**
     * Generate JWT tokens (access + refresh)
     */
    private async generateTokens(userId: string, email: string, tenantId: string) {
        const payload = { sub: userId, email, tenantId };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.secret') || 'secret',
                expiresIn: (this.configService.get<string>('jwt.expiresIn') || '15m') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret',
                expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') || '7d') as any,
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
    private async createSession(tx: any, userId: string, refreshToken: string) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        // Use raw insert
        const id = crypto.randomUUID();

        await tx.$executeRaw`INSERT INTO "sessions" ("id", "userId", "refreshToken", "expiresAt", "createdAt") VALUES (${id}, ${userId}, ${refreshToken}, ${expiresAt}, NOW())`;
    }
}
