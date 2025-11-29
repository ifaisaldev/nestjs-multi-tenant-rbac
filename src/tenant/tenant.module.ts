import { Module, MiddlewareConsumer, RequestMethod, Global } from '@nestjs/common';
import { TenantMiddleware } from './middleware/tenant.middleware';

@Global()
@Module({
    providers: [TenantMiddleware],
    exports: [TenantMiddleware],
})
export class TenantModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
