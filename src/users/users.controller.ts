import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Headers,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiHeader,
    ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser } from '@/auth/decorators';
import { RolesGuard } from '@/rbac/guards/roles.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { Roles } from '@/rbac/decorators/roles.decorator';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { Audit } from '@/audit/decorators/audit.decorator';
import { AuditInterceptor } from '@/audit/interceptors/audit.interceptor';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
@UseInterceptors(AuditInterceptor)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    @UseGuards(PermissionsGuard)
    @Permissions({ resource: 'users', action: 'read' })
    @ApiOperation({ summary: 'List all users (requires users:read permission)' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
    async findAll(
        @Headers('x-tenant-id') tenantId: string,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
    ) {
        return this.usersService.findAll(tenantId, { page: +page, limit: +limit });
    }

    @Get(':id')
    @UseGuards(PermissionsGuard)
    @Permissions({ resource: 'users', action: 'read' })
    @ApiOperation({ summary: 'Get user by ID (requires users:read permission)' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true })
    @ApiResponse({ status: 200, description: 'User found' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
    async findOne(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
        return this.usersService.findOne(tenantId, id);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'SUPER_ADMIN')
    @ApiOperation({ summary: 'Create new user (requires ADMIN or SUPER_ADMIN role)' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Missing required role' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    @Audit('users', 'create')
    async create(@Headers('x-tenant-id') tenantId: string, @Body() createUserDto: CreateUserDto) {
        return this.usersService.create(tenantId, createUserDto);
    }

    @Put(':id')
    @UseGuards(PermissionsGuard)
    @Permissions({ resource: 'users', action: 'update' })
    @ApiOperation({ summary: 'Update user (requires users:update permission)' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true })
    @ApiResponse({ status: 200, description: 'User updated successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
    @Audit('users', 'update')
    async update(
        @Headers('x-tenant-id') tenantId: string,
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return this.usersService.update(tenantId, id, updateUserDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard, PermissionsGuard)
    @Roles('SUPER_ADMIN')
    @Permissions({ resource: 'users', action: 'delete' })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete user (requires SUPER_ADMIN role + users:delete permission)',
    })
    @ApiHeader({ name: 'X-Tenant-ID', required: true })
    @ApiResponse({ status: 204, description: 'User deleted successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Forbidden - Missing role or permission' })
    @Audit('users', 'delete')
    async remove(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
        return this.usersService.remove(tenantId, id);
    }

    @Get('me/profile')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Current user profile' })
    async getProfile(@CurrentUser() user: any) {
        return user;
    }
}
