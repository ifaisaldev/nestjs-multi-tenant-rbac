import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum TenantStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    INACTIVE = 'INACTIVE',
}

export class UpdateTenantDto {
    @ApiProperty({ example: 'Acme Corporation Updated', required: false })
    @IsString()
    @IsOptional()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @ApiProperty({ example: 'acme.example.com', required: false })
    @IsString()
    @IsOptional()
    domain?: string;

    @ApiProperty({ enum: TenantStatus, required: false })
    @IsEnum(TenantStatus)
    @IsOptional()
    status?: TenantStatus;
}
