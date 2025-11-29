import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/rbac/guards/roles.guard';
import { Roles } from '@/rbac/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'List all audit logs' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'userId', required: false })
    @ApiQuery({ name: 'action', required: false })
    @ApiQuery({ name: 'resource', required: false })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('userId') userId?: string,
        @Query('action') action?: string,
        @Query('resource') resource?: string,
    ) {
        return this.auditService.findAll({ page, limit, userId, action, resource });
    }

    @Get('my-logs')
    @ApiOperation({ summary: 'Get logs for current user' })
    async findMyLogs(
        @CurrentUser('id') userId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.auditService.findByUser(userId, page, limit);
    }

    @Get(':id')
    @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Get audit log details' })
    async findOne(@Param('id') id: string) {
        return this.auditService.findOne(id);
    }
}
