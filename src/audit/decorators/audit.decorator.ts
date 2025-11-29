import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
    resource: string;
    action: string;
}

export const Audit = (resource: string, action: string) =>
    SetMetadata(AUDIT_KEY, { resource, action });
