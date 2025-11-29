import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<string>();

export const getTenantId = (): string | undefined => {
    return tenantContext.getStore();
};

export const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
    return tenantContext.run(tenantId, callback);
};
