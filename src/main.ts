import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);
    const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

    // Security - Helmet
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: [`'self'`],
                    styleSrc: [`'self'`, `'unsafe-inline'`],
                    imgSrc: [`'self'`, 'data:', 'https:'],
                    scriptSrc: [`'self'`, `'unsafe-inline'`],
                },
            },
        }),
    );

    // CORS
    const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
    app.enableCors({
        origin: corsOrigin.split(','),
        credentials: configService.get<boolean>('CORS_CREDENTIALS', true),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    });

    // Global prefix
    app.setGlobalPrefix(apiPrefix);

    // Validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // Strip unknown properties
            forbidNonWhitelisted: true, // Throw error for unknown properties
            transform: true, // Auto-transform payloads to DTO instances
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger/OpenAPI Documentation
    if (configService.get<boolean>('SWAGGER_ENABLED', true)) {
        const config = new DocumentBuilder()
            .setTitle(configService.get<string>('SWAGGER_TITLE', 'Multi-Tenant RBAC API'))
            .setDescription(
                configService.get<string>(
                    'SWAGGER_DESCRIPTION',
                    'Production-grade RBAC with multi-tenancy',
                ),
            )
            .setVersion(configService.get<string>('SWAGGER_VERSION', '1.0'))
            .addBearerAuth(
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    name: 'Authorization',
                    description: 'Enter JWT token',
                    in: 'header',
                },
                'access-token',
            )
            .addApiKey(
                {
                    type: 'apiKey',
                    name: 'X-Tenant-ID',
                    in: 'header',
                    description: 'Tenant identifier',
                },
                'tenant-id',
            )
            .addTag('Auth', 'Authentication endpoints')
            .addTag('Users', 'User management')
            .addTag('Roles', 'Role management')
            .addTag('Permissions', 'Permission management')
            .addTag('Tenants', 'Tenant management')
            .addTag('Health', 'Health check endpoints')
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: {
                persistAuthorization: true,
            },
        });

        logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
    }

    // Graceful shutdown
    app.enableShutdownHooks();

    await app.listen(port);

    logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
    logger.log(`🏥 Health check available at: http://localhost:${port}/health`);
    logger.log(`🎯 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

bootstrap();
