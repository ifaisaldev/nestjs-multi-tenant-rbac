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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { RolesGuard } from '@/rbac/guards/roles.guard';
import { Roles } from '@/rbac/decorators/roles.decorator';
import { Public } from '@/auth/decorators';
import { Audit } from '@/audit/decorators/audit.decorator';
import { UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '@/audit/interceptors/audit.interceptor';

@ApiTags('Tenants')
@Controller('tenants')
@ApiBearerAuth('access-token')
@UseInterceptors(AuditInterceptor)
export class TenantController {
    constructor(private tenantService: TenantService) { }

    @Post()
    @Public() // Allow public tenant creation (you can restrict this later)
    @ApiOperation({ summary: 'Create new tenant with automatic schema setup' })
    @ApiResponse({ status: 201, description: 'Tenant created successfully' })
    @ApiResponse({ status: 409, description: 'Tenant already exists' })
    @Audit('tenants', 'create')
    async create(@Body() createTenantDto: CreateTenantDto) {
        return this.tenantService.create(createTenantDto);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN')
    @ApiOperation({ summary: 'List all tenants (SUPER_ADMIN only)' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Requires SUPER_ADMIN role' })
    async findAll(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
    ) {
        return this.tenantService.findAll(+page, +limit);
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN', 'ADMIN')
    @ApiOperation({ summary: 'Get tenant by ID' })
    @ApiResponse({ status: 200, description: 'Tenant found' })
    @ApiResponse({ status: 404, description: 'Tenant not found' })
    async findOne(@Param('id') id: string) {
        return this.tenantService.findOne(id);
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN')
    @ApiOperation({ summary: 'Update tenant (SUPER_ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
    @ApiResponse({ status: 404, description: 'Tenant not found' })
    @Audit('tenants', 'update')
    async update(
        @Param('id') id: string,
        @Body() updateTenantDto: UpdateTenantDto,
    ) {
        return this.tenantService.update(id, updateTenantDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Soft delete tenant (SUPER_ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Tenant deactivated successfully' })
    @ApiResponse({ status: 404, description: 'Tenant not found' })
    @Audit('tenants', 'delete')
    async remove(@Param('id') id: string) {
        return this.tenantService.remove(id);
    }

    @Delete(':id/hard')
    @UseGuards(RolesGuard)
    @Roles('SUPER_ADMIN')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Permanently delete tenant and drop schema (SUPER_ADMIN only - DANGEROUS!)',
        description: 'This will permanently delete the tenant and all its data. This action cannot be undone.',
    })
    @ApiResponse({ status: 200, description: 'Tenant permanently deleted' })
    @ApiResponse({ status: 404, description: 'Tenant not found' })
    @Audit('tenants', 'hard-delete')
    async hardDelete(@Param('id') id: string) {
        return this.tenantService.hardDelete(id);
    }
}
