import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to require specific roles for route access
 * @example
 * @Roles('ADMIN', 'MANAGER')
 * @Get('admin-only')
 * adminRoute() {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
