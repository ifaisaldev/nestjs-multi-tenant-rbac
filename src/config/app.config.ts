import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    name: process.env.APP_NAME || 'NestJS Multi-Tenant RBAC',

    // Security
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || '*',
    corsCredentials: process.env.CORS_CREDENTIALS === 'true',

    // Logging
    logLevel: process.env.LOG_LEVEL || 'debug',
    logPrettyPrint: process.env.LOG_PRETTY_PRINT === 'true',
}));
