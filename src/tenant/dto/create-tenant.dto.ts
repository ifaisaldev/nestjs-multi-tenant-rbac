import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
    @ApiProperty({ example: 'Acme Corporation', description: 'Tenant name' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: 'acme-corp', description: 'Unique tenant slug (lowercase, alphanumeric, hyphens)' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase alphanumeric with hyphens only',
    })
    @MinLength(3)
    @MaxLength(50)
    slug: string;

    @ApiProperty({ example: 'acme.example.com', description: 'Optional custom domain', required: false })
    @IsString()
    @IsOptional()
    domain?: string;

    @ApiProperty({ example: 'admin@acme.com', description: 'Admin email for the tenant' })
    @IsEmail()
    @IsNotEmpty()
    adminEmail: string;

    @ApiProperty({ example: 'Admin', description: 'Admin first name' })
    @IsString()
    @IsNotEmpty()
    adminFirstName: string;

    @ApiProperty({ example: 'User', description: 'Admin last name' })
    @IsString()
    @IsNotEmpty()
    adminLastName: string;

    @ApiProperty({ example: 'SecureP@ss123', description: 'Admin password' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    adminPassword: string;
}
