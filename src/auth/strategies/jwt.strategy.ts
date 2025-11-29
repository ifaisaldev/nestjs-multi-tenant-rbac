import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';

export interface JwtPayload {
    sub: string; // User ID
    email: string;
    tenantId: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        configService: ConfigService,
        private prisma: TenantPrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.secret') || 'secret',
        });
    }

    async validate(payload: JwtPayload) {
        return this.prisma.run(async (tx) => {
            // Find user in tenant database using raw query
            const users: any[] = await tx.$queryRaw`SELECT * FROM "users" WHERE id = ${payload.sub}`;
            const user = users[0];

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            if (user.status !== 'ACTIVE') {
                throw new UnauthorizedException('User account is not active');
            }

            // Fetch roles
            const roles: any[] = await tx.$queryRaw`
                SELECT r.* 
                FROM "roles" r 
                JOIN "user_roles" ur ON ur."roleId" = r.id 
                WHERE ur."userId" = ${user.id}
            `;

            // Fetch permissions
            const permissions: any[] = [];
            for (const role of roles) {
                const rolePerms: any[] = await tx.$queryRaw`
                    SELECT p.* 
                    FROM "permissions" p 
                    JOIN "role_permissions" rp ON rp."permissionId" = p.id 
                    WHERE rp."roleId" = ${role.id}
                 `;
                permissions.push(...rolePerms);
            }

            // Attach user to request object
            return {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                status: user.status,
                tenantId: payload.tenantId,
                roles: roles,
                permissions: permissions,
            };
        });
    }
}
