import { Controller, Post, Body, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { Public, CurrentUser } from './decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @Public()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    async register(
        @Body() registerDto: RegisterDto,
        @Headers('x-tenant-id') tenantId: string,
    ) {
        if (!tenantId) {
            throw new Error('X-Tenant-ID header is required');
        }

        return this.authService.register(registerDto, tenantId);
    }

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto, @Headers('x-tenant-id') tenantId: string) {
        if (!tenantId) {
            throw new Error('X-Tenant-ID header is required');
        }

        return this.authService.login(loginDto, tenantId);
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
    @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token' })
    async refresh(
        @Body() refreshTokenDto: RefreshTokenDto,
        @Headers('x-tenant-id') tenantId: string,
    ) {
        if (!tenantId) {
            throw new Error('X-Tenant-ID header is required');
        }

        return this.authService.refreshToken(refreshTokenDto.refreshToken, tenantId);
    }

    @Post('logout')
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user' })
    @ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async logout(@CurrentUser('id') userId: string, @Headers('x-tenant-id') tenantId: string) {
        if (!tenantId) {
            throw new Error('X-Tenant-ID header is required');
        }

        return this.authService.logout(userId, tenantId);
    }
}
