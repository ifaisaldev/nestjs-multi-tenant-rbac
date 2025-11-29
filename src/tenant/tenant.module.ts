import { Module, MiddlewareConsumer, RequestMethod, Global } from '@nestjs/common';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

@Global()
@Module({
    controllers: [TenantController],
    providers: [TenantMiddleware, TenantService],
    exports: [TenantMiddleware, TenantService],
})
export class TenantModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
