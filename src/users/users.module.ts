import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RbacModule } from '@/rbac/rbac.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
    imports: [RbacModule, AuthModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
