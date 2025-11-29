import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, Permission } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // Get required permissions from decorator
        const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no permissions required, allow access
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // Get user from request (set by JwtAuthGuard)
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Get user's permissions from roles
        const userPermissions: Permission[] = user.permissions || [];
        const userRoles = user.roles?.map((role: any) => role.name) || [];

        // Allow SUPER_ADMIN to bypass permission checks
        if (userRoles.includes('SUPER_ADMIN')) {
            return true;
        }

        // Check if user has ALL required permissions (AND logic)
        const hasAllPermissions = requiredPermissions.every((required) =>
            userPermissions.some(
                (userPerm) =>
                    userPerm.resource === required.resource && userPerm.action === required.action,
            ),
        );

        if (!hasAllPermissions) {
            const missingPerms = requiredPermissions
                .filter(
                    (required) =>
                        !userPermissions.some(
                            (userPerm) =>
                                userPerm.resource === required.resource && userPerm.action === required.action,
                        ),
                )
                .map((p) => `${p.resource}:${p.action}`)
                .join(', ');

            throw new ForbiddenException(`Missing required permission(s): ${missingPerms}`);
        }

        return true;
    }
}
