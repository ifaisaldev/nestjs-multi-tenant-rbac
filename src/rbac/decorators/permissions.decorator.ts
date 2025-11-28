import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface Permission {
    resource: string;
    action: string;
}

/**
 * Decorator to require specific permissions for route access
 * @example
 * @Permissions({ resource: 'users', action: 'delete' })
 * @Delete('users/:id')
 * deleteUser() {}
 * 
 * @example
 * @Permissions(
 *   { resource: 'users', action: 'read' },
 *   { resource: 'users', action: 'write' }
 * )
 * @Put('users/:id')
 * updateUser() {}
 */
export const Permissions = (...permissions: Permission[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
