import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '@/audit/audit.service';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditInterceptor.name);

    constructor(
        private reflector: Reflector,
        private auditService: AuditService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const auditMetadata = this.reflector.get<AuditMetadata>(AUDIT_KEY, context.getHandler());

        if (!auditMetadata) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const { user, ip, method, url } = request;
        const userAgent = request.get('user-agent');

        return next.handle().pipe(
            tap({
                next: async (data) => {
                    try {
                        // Only log if user is authenticated
                        if (user && user.id) {
                            await this.auditService.create({
                                userId: user.id,
                                action: auditMetadata.action.toUpperCase(),
                                resource: auditMetadata.resource,
                                resourceId: data?.id || null, // Try to get ID from response
                                ipAddress: ip,
                                userAgent: userAgent,
                                metadata: {
                                    method,
                                    url,
                                    statusCode: context.switchToHttp().getResponse().statusCode,
                                },
                            });
                        }
                    } catch (error) {
                        this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
                        // Don't block the response if logging fails
                    }
                },
                error: (error) => {
                    // Optional: Log failed attempts
                },
            }),
        );
    }
}
