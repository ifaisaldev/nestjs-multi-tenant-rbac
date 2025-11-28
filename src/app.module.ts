import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Joi from 'joi';

// Configuration
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { rabbitmqConfig } from './config/rabbitmq.config';

// Modules
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            load: [appConfig, databaseConfig, jwtConfig, redisConfig, rabbitmqConfig],
            validationSchema: Joi.object({
                NODE_ENV: Joi.string()
                    .valid('development', 'production', 'test')
                    .default('development'),
                PORT: Joi.number().default(3000),
                DATABASE_URL: Joi.string().required(),
                JWT_SECRET: Joi.string().required(),
                JWT_EXPIRES_IN: Joi.string().default('15m'),
                JWT_REFRESH_SECRET: Joi.string().required(),
                JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
                REDIS_HOST: Joi.string().default('localhost'),
                REDIS_PORT: Joi.number().default(6379),
                RABBITMQ_URL: Joi.string().required(),
            }),
        }),

        // Rate Limiting
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 1000, // 1 second
                limit: 10, // 10 requests
            },
            {
                name: 'medium',
                ttl: 60000, // 1 minute
                limit: 100, // 100 requests
            },
            {
                name: 'long',
                ttl: 900000, // 15 minutes
                limit: 1000, // 1000 requests
            },
        ]),

        // Caching - Will be configured with Redis in CacheModule
        CacheModule.register({
            isGlobal: true,
            ttl: 3600, // 1 hour default TTL
        }),

        // Event Emitter for CQRS and domain events
        EventEmitterModule.forRoot({
            wildcard: true,
            delimiter: '.',
            maxListeners: 10,
            verboseMemoryLeak: true,
            ignoreErrors: false,
        }),

        // Core modules
        PrismaModule,
        HealthModule,

        // Will add more modules:
        // AuthModule,
        // TenantModule,
        // RbacModule,
        // UsersModule,
        // GraphQLModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
